import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { Category } from '../entities/Category';
import { Inventory } from '../entities/Inventory';
import { InventoryBatch } from '../entities/InventoryBatch';
import { StockMovement } from '../entities/StockMovement';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 商品 Excel 导入模板：分类名称 | 品牌 | 商品名称 | 型号 | 规格(JSON) | 质保月数 | 预警阈值
// POST /api/v1/import/products
router.post(
  '/products',
  authenticate,
  requireRole('shop_owner', 'store_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 Excel 文件' });
    }

    try {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, string>[];

      const categoryRepo = AppDataSource.getRepository(Category);
      const productRepo = AppDataSource.getRepository(Product);

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const [idx, row] of rows.entries()) {
        try {
          const categoryName = row['分类名称'] || row['category'];
          const brand = row['品牌'] || row['brand'];
          const name = row['商品名称'] || row['name'];
          const modelNumber = row['型号'] || row['modelNumber'] || null;
          const specsStr = row['规格'] || row['specs'] || '{}';
          const warrantyMonths = row['质保月数'] || row['warrantyMonths'];
          const lowStockThreshold = row['预警阈值'] || row['lowStockThreshold'] || 2;

          if (!categoryName || !brand || !name) {
            results.failed++;
            results.errors.push(`第 ${idx + 2} 行：分类、品牌、商品名称为必填项`);
            continue;
          }

          // 查找或创建分类
          let category = await categoryRepo.findOne({ where: { name: categoryName } });
          if (!category) {
            category = categoryRepo.create({ name: categoryName, parentId: null });
            category = await categoryRepo.save(category);
          }

          // 解析规格 JSON
          let specs: Record<string, unknown> = {};
          try {
            specs = typeof specsStr === 'string' ? JSON.parse(specsStr) : specsStr;
          } catch {
            specs = {};
          }

          const product = productRepo.create({
            categoryId: category.id,
            name,
            brand,
            modelNumber,
            specs,
            warrantyMonths: warrantyMonths ? parseInt(String(warrantyMonths), 10) : null,
            lowStockThreshold: parseInt(String(lowStockThreshold), 10) || 2,
            isActive: true,
          });
          await productRepo.save(product);
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push(`第 ${idx + 2} 行：${err instanceof Error ? err.message : '未知错误'}`);
        }
      }

      return res.json(results);
    } catch (err) {
      return res.status(500).json({ error: 'Excel 解析失败', details: err instanceof Error ? err.message : '未知错误' });
    }
  }
);

// 库存批量入库 Excel 导入模板：商品名称 | 品牌 | 数量 | 进货日期 | 成本价 | 批次号(可选)
// POST /api/v1/import/inventory
router.post(
  '/inventory',
  authenticate,
  requireRole('shop_owner', 'store_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 Excel 文件' });
    }

    // 获取门店ID：店长从用户信息获取，店主从请求参数获取
    let storeId: number | undefined;
    if (req.user?.role === 'shop_owner') {
      storeId = req.query.store_id ? parseInt(req.query.store_id as string, 10) : undefined;
      if (!storeId) {
        return res.status(400).json({ error: '店主请指定门店ID（store_id参数）' });
      }
    } else {
      storeId = req.user?.storeId ?? undefined;
      if (!storeId) {
        return res.status(400).json({ error: '当前用户未绑定门店' });
      }
    }

    try {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, string>[];

      const productRepo = AppDataSource.getRepository(Product);
      const inventoryRepo = AppDataSource.getRepository(Inventory);
      const batchRepo = AppDataSource.getRepository(InventoryBatch);

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const [idx, row] of rows.entries()) {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const productName = row['商品名称'] || row['productName'];
          const brand = row['品牌'] || row['brand'];
          const quantity = row['数量'] || row['quantity'];
          const purchaseDate = row['进货日期'] || row['purchaseDate'];
          const costPrice = row['成本价'] || row['costPrice'];
          const batchNo = row['批次号'] || row['batchNo'];

          if (!productName || !brand || !quantity || !purchaseDate) {
            results.failed++;
            results.errors.push(`第 ${idx + 2} 行：商品名称、品牌、数量、进货日期为必填项`);
            await queryRunner.rollbackTransaction();
            continue;
          }

          // 查找商品
          const product = await productRepo.findOne({
            where: { name: productName, brand, isActive: true },
          });
          if (!product) {
            results.failed++;
            results.errors.push(`第 ${idx + 2} 行：未找到商品 ${productName} (${brand})`);
            await queryRunner.rollbackTransaction();
            continue;
          }

          const qty = parseInt(String(quantity), 10);
          if (qty <= 0) {
            results.failed++;
            results.errors.push(`第 ${idx + 2} 行：数量必须大于 0`);
            await queryRunner.rollbackTransaction();
            continue;
          }

          // 查找或创建库存汇总
          let inventory = await inventoryRepo.findOne({
            where: { storeId, productId: product.id },
          });
          if (!inventory) {
            inventory = inventoryRepo.create({ storeId, productId: product.id, quantity: 0 });
          }

          // 先保存/更新库存汇总，确保有 ID
          inventory.quantity += qty;
          const savedInventory = await queryRunner.manager.save(Inventory, inventory);

          // 创建批次（inventoryId 已有）
          const batch = batchRepo.create({
            inventoryId: savedInventory.id,
            batchNo: batchNo || `BATCH-${Date.now()}-${idx}`,
            quantity: qty,
            purchaseDate,
            expiryDate: null,
            costPrice: costPrice ? parseFloat(String(costPrice)) : null,
          });
          const savedBatch = await queryRunner.manager.save(InventoryBatch, batch);

          // 记录移动日志
          await queryRunner.manager.save(StockMovement, {
            storeId,
            productId: product.id,
            batchId: savedBatch.id,
            type: 'in',
            quantity: qty,
            referenceNo: savedBatch.batchNo,
            note: 'Excel 批量导入',
            operatedBy: req.user!.id,
          });

          await queryRunner.commitTransaction();
          results.success++;
        } catch (err) {
          await queryRunner.rollbackTransaction();
          results.failed++;
          results.errors.push(`第 ${idx + 2} 行：${err instanceof Error ? err.message : '未知错误'}`);
        } finally {
          await queryRunner.release();
        }
      }

      return res.json(results);
    } catch (err) {
      return res.status(500).json({ error: 'Excel 解析失败', details: err instanceof Error ? err.message : '未知错误' });
    }
  }
);

export default router;
