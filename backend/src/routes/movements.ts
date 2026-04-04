import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Inventory } from '../entities/Inventory';
import { InventoryBatch } from '../entities/InventoryBatch';
import { StockMovement } from '../entities/StockMovement';
import { authenticate } from '../middleware/auth';
import { storeScope } from '../middleware/storeScope';

const router = Router();

// POST /api/v1/movements/in — 采购入库
// 创建批次 → 更新库存聚合 → 记录流水，三步在事务中完成
router.post('/in', authenticate, storeScope, async (req: Request, res: Response) => {
  const { productId, quantity, batchNo, purchaseDate, costPrice } = req.body;

  if (!productId || !quantity || !batchNo || !purchaseDate) {
    return res.status(400).json({ message: '商品、数量、批次号、入库日期不能为空' });
  }
  if (quantity <= 0) {
    return res.status(400).json({ message: '数量必须为正数' });
  }

  // 非店长必须有 scopedStoreId
  const storeId = req.scopedStoreId;
  if (!storeId) {
    return res.status(400).json({ message: '请指定门店' });
  }

  await AppDataSource.transaction(async (em) => {
    // 1. 查找或创建库存聚合记录
    let inv = await em.findOne(Inventory, { where: { storeId, productId } });
    if (!inv) {
      inv = em.create(Inventory, { storeId, productId, quantity: 0 });
    }
    inv.quantity += quantity;
    await em.save(inv);

    // 2. 创建批次记录
    const batch = em.create(InventoryBatch, {
      inventoryId: inv.id,
      batchNo,
      quantity,
      purchaseDate,
      costPrice: costPrice ?? null,
      expiryDate: null,
    });
    await em.save(batch);

    // 3. 记录流水
    const movement = em.create(StockMovement, {
      storeId,
      productId,
      batchId: batch.id,
      type: 'in',
      quantity,
      referenceNo: batchNo,
      note: req.body.note ?? null,
      operatedBy: req.user!.id,
    });
    await em.save(movement);
  });

  return res.status(201).json({ message: '入库成功' });
});

// POST /api/v1/movements/out — 销售出库（FIFO）
router.post('/out', authenticate, storeScope, async (req: Request, res: Response) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({ message: '商品、数量不能为空' });
  }
  if (quantity <= 0) {
    return res.status(400).json({ message: '数量必须为正数' });
  }

  const storeId = req.scopedStoreId;
  if (!storeId) {
    return res.status(400).json({ message: '请指定门店' });
  }

  await AppDataSource.transaction(async (em) => {
    const inv = await em.findOne(Inventory, { where: { storeId, productId } });
    if (!inv || inv.quantity < quantity) {
      throw new Error('库存不足');
    }

    // FIFO：按 purchaseDate ASC、id ASC 扣减批次
    const batches = await em.find(InventoryBatch, {
      where: { inventoryId: inv.id },
      order: { purchaseDate: 'ASC', id: 'ASC' },
    });

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      if (batch.quantity <= 0) continue;

      const deduct = Math.min(batch.quantity, remaining);
      batch.quantity -= deduct;
      remaining -= deduct;
      await em.save(batch);

      // 每个批次单独记一条流水
      const movement = em.create(StockMovement, {
        storeId,
        productId,
        batchId: batch.id,
        type: 'out',
        quantity: -deduct,
        referenceNo: req.body.referenceNo ?? null,
        note: req.body.note ?? null,
        operatedBy: req.user!.id,
      });
      await em.save(movement);
    }

    inv.quantity -= quantity;
    await em.save(inv);
  });

  return res.status(201).json({ message: '出库成功' });
});

// GET /api/v1/movements — 流水列表，支持多维度过滤
router.get('/', authenticate, storeScope, async (req: Request, res: Response) => {
  const movRepo = AppDataSource.getRepository(StockMovement);
  const qb = movRepo
    .createQueryBuilder('m')
    .leftJoinAndSelect('m.product', 'p')
    .leftJoinAndSelect('m.store', 's')
    .leftJoinAndSelect('m.operator', 'u');

  if (req.scopedStoreId) {
    qb.andWhere('m.store_id = :storeId', { storeId: req.scopedStoreId });
  }
  if (req.query.product_id) {
    qb.andWhere('m.product_id = :pid', { pid: parseInt(req.query.product_id as string, 10) });
  }
  if (req.query.type) {
    qb.andWhere('m.type = :type', { type: req.query.type });
  }
  if (req.query.start_date) {
    qb.andWhere('m.createdAt >= :start', { start: req.query.start_date });
  }
  if (req.query.end_date) {
    qb.andWhere('m.createdAt <= :end', { end: req.query.end_date });
  }

  const page = parseInt((req.query.page as string) || '1', 10);
  const pageSize = parseInt((req.query.page_size as string) || '50', 10);

  const [list, total] = await qb
    .orderBy('m.createdAt', 'DESC')
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .getManyAndCount();

  return res.json({ list, total, page, pageSize });
});

export default router;
