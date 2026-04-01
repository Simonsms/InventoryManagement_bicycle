import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Inventory } from '../entities/Inventory';
import { Transfer } from '../entities/Transfer';
import { StockMovement } from '../entities/StockMovement';
import { Product } from '../entities/Product';
import { Store } from '../entities/Store';
import { authenticate } from '../middleware/auth';
import { storeScope } from '../middleware/storeScope';

const router = Router();

// GET /api/v1/dashboard — 仪表盘统计摘要
router.get('/', authenticate, storeScope, async (req: Request, res: Response) => {
  const invRepo = AppDataSource.getRepository(Inventory);
  const transferRepo = AppDataSource.getRepository(Transfer);
  const productRepo = AppDataSource.getRepository(Product);
  const storeRepo = AppDataSource.getRepository(Store);

  // 构建门店过滤条件
  const storeFilter = req.scopedStoreId ? { storeId: req.scopedStoreId } : {};

  // 1. 总活跃 SKU 数
  const totalSkus = await productRepo.count({ where: { isActive: true } });

  // 2. 低库存预警数
  const lowStockQb = invRepo
    .createQueryBuilder('inv')
    .leftJoin('inv.product', 'p')
    .where('p.isActive = true')
    .andWhere('inv.quantity <= p.lowStockThreshold');
  if (req.scopedStoreId) {
    lowStockQb.andWhere('inv.storeId = :sid', { sid: req.scopedStoreId });
  }
  const lowStockCount = await lowStockQb.getCount();

  // 3. 待审批调拨数
  const pendingTransferQb = transferRepo
    .createQueryBuilder('t')
    .where('t.status = :status', { status: 'pending' });
  if (req.scopedStoreId) {
    pendingTransferQb.andWhere(
      '(t.fromStoreId = :sid OR t.toStoreId = :sid)',
      { sid: req.scopedStoreId }
    );
  }
  const pendingTransferCount = await pendingTransferQb.getCount();

  // 4. 各门店库存总量（店长看全部，其他人看本店）
  const storeStatsQb = invRepo
    .createQueryBuilder('inv')
    .leftJoin('inv.store', 's')
    .select('s.id', 'storeId')
    .addSelect('s.name', 'storeName')
    .addSelect('SUM(inv.quantity)', 'totalQty')
    .addSelect('COUNT(DISTINCT inv.productId)', 'skuCount')
    .groupBy('s.id')
    .addGroupBy('s.name')
    .orderBy('s.id', 'ASC');
  if (req.scopedStoreId) {
    storeStatsQb.andWhere('inv.storeId = :sid', { sid: req.scopedStoreId });
  }
  const storeStats = await storeStatsQb.getRawMany();

  // 5. 低库存预警列表（最多 5 条）
  const lowStockItems = await invRepo
    .createQueryBuilder('inv')
    .leftJoinAndSelect('inv.product', 'p')
    .leftJoinAndSelect('inv.store', 's')
    .where('p.isActive = true')
    .andWhere('inv.quantity <= p.lowStockThreshold')
    .andWhere(req.scopedStoreId ? 'inv.storeId = :sid' : '1=1', { sid: req.scopedStoreId })
    .orderBy('inv.quantity', 'ASC')
    .limit(5)
    .getMany();

  // 6. 待审批调拨列表（最多 5 条）
  const pendingTransfers = await transferRepo
    .createQueryBuilder('t')
    .leftJoinAndSelect('t.fromStore', 'fs')
    .leftJoinAndSelect('t.toStore', 'ts')
    .leftJoinAndSelect('t.requester', 'req')
    .where('t.status = :status', { status: 'pending' })
    .andWhere(
      req.scopedStoreId
        ? '(t.fromStoreId = :sid OR t.toStoreId = :sid)'
        : '1=1',
      { sid: req.scopedStoreId }
    )
    .orderBy('t.createdAt', 'DESC')
    .limit(5)
    .getMany();

  return res.json({
    totalSkus,
    lowStockCount,
    pendingTransferCount,
    storeStats: storeStats.map(s => ({
      storeId: parseInt(s.storeId, 10),
      storeName: s.storeName,
      totalQty: parseInt(s.totalQty || '0', 10),
      skuCount: parseInt(s.skuCount || '0', 10),
    })),
    lowStockItems,
    pendingTransfers,
  });
});

export default router;
