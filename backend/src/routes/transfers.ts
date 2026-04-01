import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transfer } from '../entities/Transfer';
import { TransferItem } from '../entities/TransferItem';
import { Inventory } from '../entities/Inventory';
import { InventoryBatch } from '../entities/InventoryBatch';
import { StockMovement } from '../entities/StockMovement';
import { authenticate, requireRole } from '../middleware/auth';
import { storeScope } from '../middleware/storeScope';

const router = Router();

// GET /api/v1/transfers — 调拨列表
router.get('/', authenticate, storeScope, async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Transfer);
  const qb = repo
    .createQueryBuilder('t')
    .leftJoinAndSelect('t.fromStore', 'fs')
    .leftJoinAndSelect('t.toStore', 'ts')
    .leftJoinAndSelect('t.requester', 'req')
    .leftJoinAndSelect('t.approver', 'app');

  // 非店长只能看与自己门店相关的调拨
  if (req.scopedStoreId) {
    qb.andWhere('(t.fromStoreId = :sid OR t.toStoreId = :sid)', { sid: req.scopedStoreId });
  }
  if (req.query.status) {
    qb.andWhere('t.status = :status', { status: req.query.status });
  }

  const list = await qb.orderBy('t.createdAt', 'DESC').getMany();
  return res.json(list);
});

// POST /api/v1/transfers — 发起调拨申请（管理员+店长）
router.post('/', authenticate, requireRole('shop_owner', 'store_admin'), storeScope, async (req: Request, res: Response) => {
  const { toStoreId, items, note } = req.body;
  // items: [{ productId, quantity }]

  if (!toStoreId || !items?.length) {
    return res.status(400).json({ message: '目标门店和调拨明细不能为空' });
  }

  const fromStoreId = req.scopedStoreId;
  if (!fromStoreId) {
    return res.status(400).json({ message: '请指定发出门店' });
  }
  if (fromStoreId === toStoreId) {
    return res.status(400).json({ message: '调出和调入门店不能相同' });
  }

  // 验证库存是否充足
  const invRepo = AppDataSource.getRepository(Inventory);
  for (const item of items) {
    const inv = await invRepo.findOne({ where: { storeId: fromStoreId, productId: item.productId } });
    if (!inv || inv.quantity < item.quantity) {
      return res.status(400).json({ message: `商品 ${item.productId} 库存不足` });
    }
  }

  await AppDataSource.transaction(async (em) => {
    const transfer = em.create(Transfer, {
      fromStoreId,
      toStoreId,
      status: 'pending',
      requestedBy: req.user!.id,
      note: note ?? null,
    });
    await em.save(transfer);

    for (const item of items) {
      const ti = em.create(TransferItem, {
        transferId: transfer.id,
        productId: item.productId,
        quantity: item.quantity,
      });
      await em.save(ti);
    }
  });

  return res.status(201).json({ message: '调拨申请已提交' });
});

// PUT /api/v1/transfers/:id/approve — 审批通过（仅店长）
router.put('/:id/approve', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const repo = AppDataSource.getRepository(Transfer);
  const transfer = await repo.findOne({ where: { id }, relations: ['items'] });

  if (!transfer) return res.status(404).json({ message: '调拨单不存在' });
  if (transfer.status !== 'pending') return res.status(400).json({ message: '只有待审批的调拨单可以审批' });

  transfer.status = 'approved';
  transfer.approvedBy = req.user!.id;
  await repo.save(transfer);

  return res.json({ message: '已审批通过' });
});

// PUT /api/v1/transfers/:id/reject — 审批拒绝（仅店长）
router.put('/:id/reject', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const repo = AppDataSource.getRepository(Transfer);
  const transfer = await repo.findOne({ where: { id } });

  if (!transfer) return res.status(404).json({ message: '调拨单不存在' });
  if (transfer.status !== 'pending') return res.status(400).json({ message: '只有待审批的调拨单可以拒绝' });

  transfer.status = 'rejected';
  transfer.approvedBy = req.user!.id;
  await repo.save(transfer);

  return res.json({ message: '已拒绝' });
});

// PUT /api/v1/transfers/:id/complete — 确认收货（管理员+店长）
// 触发：调出门店 transfer_out 流水 + 库存减少；调入门店 transfer_in 流水 + 库存增加
router.put('/:id/complete', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const repo = AppDataSource.getRepository(Transfer);
  const transfer = await repo.findOne({ where: { id }, relations: ['items'] });

  if (!transfer) return res.status(404).json({ message: '调拨单不存在' });
  if (transfer.status !== 'approved') return res.status(400).json({ message: '只有审批通过的调拨单可以确认收货' });

  await AppDataSource.transaction(async (em) => {
    const invRepo = em.getRepository(Inventory);

    for (const item of transfer.items) {
      const { productId, quantity } = item;

      // 调出门店：FIFO 扣减库存 + 记流水
      const fromInv = await invRepo.findOne({ where: { storeId: transfer.fromStoreId, productId } });
      if (!fromInv || fromInv.quantity < quantity) {
        throw new Error(`调出门店商品 ${productId} 库存不足`);
      }

      const batches = await em.find(InventoryBatch, {
        where: { inventoryId: fromInv.id },
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

        await em.save(em.create(StockMovement, {
          storeId: transfer.fromStoreId,
          productId,
          batchId: batch.id,
          type: 'transfer_out',
          quantity: -deduct,
          referenceNo: `TF-${transfer.id}`,
          operatedBy: req.user!.id,
        }));
      }
      fromInv.quantity -= quantity;
      await em.save(fromInv);

      // 调入门店：增加库存 + 记流水
      let toInv = await invRepo.findOne({ where: { storeId: transfer.toStoreId, productId } });
      if (!toInv) {
        toInv = em.create(Inventory, { storeId: transfer.toStoreId, productId, quantity: 0 });
      }
      toInv.quantity += quantity;
      await em.save(toInv);

      await em.save(em.create(StockMovement, {
        storeId: transfer.toStoreId,
        productId,
        type: 'transfer_in',
        quantity,
        referenceNo: `TF-${transfer.id}`,
        operatedBy: req.user!.id,
      }));
    }

    transfer.status = 'completed';
    await em.save(transfer);
  });

  return res.json({ message: '收货确认成功，库存已更新' });
});

export default router;
