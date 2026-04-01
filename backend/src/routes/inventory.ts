import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Inventory } from '../entities/Inventory';
import { InventoryBatch } from '../entities/InventoryBatch';
import { authenticate, requireRole } from '../middleware/auth';
import { storeScope } from '../middleware/storeScope';

const router = Router();

// GET /api/v1/inventory — 库存列表，支持门店/分类/品牌过滤
router.get('/', authenticate, storeScope, async (req: Request, res: Response) => {
  const invRepo = AppDataSource.getRepository(Inventory);
  const qb = invRepo
    .createQueryBuilder('inv')
    .leftJoinAndSelect('inv.product', 'p')
    .leftJoinAndSelect('p.category', 'c')
    .leftJoinAndSelect('inv.store', 's')
    .where('p.isActive = true');

  // storeScope 已注入 scopedStoreId（店长可为空表示所有门店）
  if (req.scopedStoreId) {
    qb.andWhere('inv.storeId = :storeId', { storeId: req.scopedStoreId });
  }
  if (req.query.category_id) {
    qb.andWhere('p.categoryId = :cid', { cid: parseInt(req.query.category_id as string, 10) });
  }
  if (req.query.brand) {
    qb.andWhere('p.brand ILIKE :brand', { brand: `%${req.query.brand}%` });
  }
  if (req.query.keyword) {
    qb.andWhere('(p.name ILIKE :kw OR p.modelNumber ILIKE :kw)', { kw: `%${req.query.keyword}%` });
  }

  const list = await qb.orderBy('s.id', 'ASC').addOrderBy('p.id', 'ASC').getMany();
  return res.json(list);
});

// GET /api/v1/inventory/:id/batches — 某库存记录的批次明细（FIFO 顺序）
router.get('/:id/batches', authenticate, storeScope, async (req: Request, res: Response) => {
  const invRepo = AppDataSource.getRepository(Inventory);
  const batchRepo = AppDataSource.getRepository(InventoryBatch);

  const inv = await invRepo.findOne({
    where: { id: parseInt(String(req.params.id), 10) },
    relations: ['store'],
  });
  if (!inv) return res.status(404).json({ message: '库存记录不存在' });

  // 门店隔离：非店长只能查看自己门店
  if (req.scopedStoreId && inv.storeId !== req.scopedStoreId) {
    return res.status(403).json({ message: '无权访问该库存' });
  }

  const batches = await batchRepo.find({
    where: { inventoryId: inv.id, quantity: 0 },  // 排除已耗尽批次需改写
    order: { purchaseDate: 'ASC', id: 'ASC' },
  });

  // 实际返回所有批次（含耗尽的历史批次）
  const allBatches = await batchRepo.find({
    where: { inventoryId: inv.id },
    order: { purchaseDate: 'ASC', id: 'ASC' },
  });

  return res.json(allBatches);
});

// GET /api/v1/inventory/alerts — 低库存预警列表
router.get('/alerts', authenticate, storeScope, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const invRepo = AppDataSource.getRepository(Inventory);
  const qb = invRepo
    .createQueryBuilder('inv')
    .leftJoinAndSelect('inv.product', 'p')
    .leftJoinAndSelect('inv.store', 's')
    .where('p.isActive = true')
    // quantity <= lowStockThreshold
    .andWhere('inv.quantity <= p.lowStockThreshold');

  if (req.scopedStoreId) {
    qb.andWhere('inv.storeId = :storeId', { storeId: req.scopedStoreId });
  }

  const alerts = await qb.orderBy('inv.quantity', 'ASC').getMany();
  return res.json(alerts);
});

// GET /api/v1/inventory/stale — 滞销品列表，?days=90（默认90天无出库流水）
router.get('/stale', authenticate, storeScope, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const days = parseInt((req.query.days as string) || '90', 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const invRepo = AppDataSource.getRepository(Inventory);
  // 找出 inventory 中，对应 stock_movements 中最近一次 out 流水在 cutoff 之前（或从未出库）的记录
  const qb = invRepo
    .createQueryBuilder('inv')
    .leftJoinAndSelect('inv.product', 'p')
    .leftJoinAndSelect('inv.store', 's')
    .where('p.isActive = true')
    .andWhere('inv.quantity > 0')
    .andWhere(`
      NOT EXISTS (
        SELECT 1 FROM stock_movements sm
        WHERE sm.store_id = inv.store_id
          AND sm.product_id = inv.product_id
          AND sm.type IN ('out', 'transfer_out')
          AND sm.created_at >= :cutoff
      )
    `, { cutoff });

  if (req.scopedStoreId) {
    qb.andWhere('inv.storeId = :storeId', { storeId: req.scopedStoreId });
  }

  const stale = await qb.orderBy('inv.updatedAt', 'ASC').getMany();
  return res.json(stale);
});

export default router;
