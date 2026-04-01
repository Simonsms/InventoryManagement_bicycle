import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Stocktake } from '../entities/Stocktake';
import { StocktakeItem } from '../entities/StocktakeItem';
import { Inventory } from '../entities/Inventory';
import { StockMovement } from '../entities/StockMovement';
import { authenticate, requireRole } from '../middleware/auth';
import { storeScope } from '../middleware/storeScope';

const router = Router();

// GET /api/v1/stocktakes — 盘点列表
router.get('/', authenticate, storeScope, async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Stocktake);
  const qb = repo
    .createQueryBuilder('st')
    .leftJoinAndSelect('st.store', 's')
    .leftJoinAndSelect('st.creator', 'c');

  if (req.scopedStoreId) {
    qb.andWhere('st.storeId = :sid', { sid: req.scopedStoreId });
  }
  if (req.query.status) {
    qb.andWhere('st.status = :status', { status: req.query.status });
  }

  const list = await qb.orderBy('st.createdAt', 'DESC').getMany();
  return res.json(list);
});

// POST /api/v1/stocktakes — 新建盘点单（快照当前库存数量）
router.post('/', authenticate, requireRole('shop_owner', 'store_admin'), storeScope, async (req: Request, res: Response) => {
  const storeId = req.scopedStoreId;
  if (!storeId) return res.status(400).json({ message: '请指定门店' });

  await AppDataSource.transaction(async (em) => {
    const stocktake = em.create(Stocktake, {
      storeId,
      status: 'open',
      createdBy: req.user!.id,
    });
    await em.save(stocktake);

    // 对该门店所有有库存的商品做快照
    const invList = await em.find(Inventory, { where: { storeId } });
    for (const inv of invList) {
      const item = em.create(StocktakeItem, {
        stocktakeId: stocktake.id,
        productId: inv.productId,
        systemQty: inv.quantity,
        actualQty: null,
      });
      await em.save(item);
    }
  });

  return res.status(201).json({ message: '盘点单已创建' });
});

// GET /api/v1/stocktakes/:id/items — 盘点明细
router.get('/:id/items', authenticate, storeScope, async (req: Request, res: Response) => {
  const stocktakeId = parseInt(String(req.params.id), 10);
  const stRepo = AppDataSource.getRepository(Stocktake);
  const stocktake = await stRepo.findOne({ where: { id: stocktakeId } });

  if (!stocktake) return res.status(404).json({ message: '盘点单不存在' });
  if (req.scopedStoreId && stocktake.storeId !== req.scopedStoreId) {
    return res.status(403).json({ message: '无权访问该盘点单' });
  }

  const items = await AppDataSource.getRepository(StocktakeItem).find({
    where: { stocktakeId },
    relations: ['product', 'product.category'],
    order: { productId: 'ASC' },
  });

  return res.json(items.map(item => ({
    ...item,
    difference: item.actualQty !== null ? item.actualQty - item.systemQty : null,
  })));
});

// PUT /api/v1/stocktakes/:id/items — 批量填写实际数量
// body: [{ productId, actualQty, note }]
router.put('/:id/items', authenticate, storeScope, async (req: Request, res: Response) => {
  const stocktakeId = parseInt(String(req.params.id), 10);
  const stRepo = AppDataSource.getRepository(Stocktake);
  const itemRepo = AppDataSource.getRepository(StocktakeItem);

  const stocktake = await stRepo.findOne({ where: { id: stocktakeId } });
  if (!stocktake) return res.status(404).json({ message: '盘点单不存在' });
  if (stocktake.status !== 'open') return res.status(400).json({ message: '只有进行中的盘点单可以填写' });
  if (req.scopedStoreId && stocktake.storeId !== req.scopedStoreId) {
    return res.status(403).json({ message: '无权操作该盘点单' });
  }

  const updates: { productId: number; actualQty: number; note?: string }[] = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: '请提供盘点数据' });
  }

  for (const update of updates) {
    await itemRepo.update(
      { stocktakeId, productId: update.productId },
      { actualQty: update.actualQty, note: update.note ?? undefined },
    );
  }

  return res.json({ message: '盘点数据已保存' });
});

// POST /api/v1/stocktakes/:id/complete — 提交盘点，差异写 adjust 流水
router.post('/:id/complete', authenticate, requireRole('shop_owner', 'store_admin'), storeScope, async (req: Request, res: Response) => {
  const stocktakeId = parseInt(String(req.params.id), 10);
  const stRepo = AppDataSource.getRepository(Stocktake);
  const stocktake = await stRepo.findOne({ where: { id: stocktakeId } });

  if (!stocktake) return res.status(404).json({ message: '盘点单不存在' });
  if (stocktake.status !== 'open') return res.status(400).json({ message: '盘点单已关闭' });
  if (req.scopedStoreId && stocktake.storeId !== req.scopedStoreId) {
    return res.status(403).json({ message: '无权操作该盘点单' });
  }

  const items = await AppDataSource.getRepository(StocktakeItem).find({
    where: { stocktakeId },
  });

  const unfilled = items.filter(i => i.actualQty === null);
  if (unfilled.length > 0) {
    return res.status(400).json({ message: `还有 ${unfilled.length} 条明细未填写实际数量` });
  }

  await AppDataSource.transaction(async (em) => {
    const invRepo = em.getRepository(Inventory);

    for (const item of items) {
      const diff = item.actualQty! - item.systemQty;
      if (diff === 0) continue;

      // 更新库存聚合
      const inv = await invRepo.findOne({ where: { storeId: stocktake.storeId, productId: item.productId } });
      if (inv) {
        inv.quantity += diff;
        await em.save(inv);
      }

      // 写 adjust 流水
      await em.save(em.create(StockMovement, {
        storeId: stocktake.storeId,
        productId: item.productId,
        type: 'adjust',
        quantity: diff,
        referenceNo: `ST-${stocktakeId}`,
        note: item.note ?? `盘点调整`,
        operatedBy: req.user!.id,
      }));
    }

    stocktake.status = 'completed';
    stocktake.completedBy = req.user!.id;
    stocktake.completedAt = new Date();
    await em.save(stocktake);
  });

  return res.json({ message: '盘点已完成，库存已调整' });
});

export default router;
