import { Router, Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Transfer, TransferStatus, TransferType } from '../entities/Transfer';
import { TransferItem } from '../entities/TransferItem';
import { Inventory } from '../entities/Inventory';
import { InventoryBatch } from '../entities/InventoryBatch';
import { StockMovement } from '../entities/StockMovement';
import { User } from '../entities/User';
import { authenticate, requireRole } from '../middleware/auth';
import { storeScope } from '../middleware/storeScope';

const router = Router();

const VALID_TRANSFER_TYPES: TransferType[] = ['physical_transfer', 'book_adjustment'];
const VALID_TRANSFER_STATUSES: TransferStatus[] = ['pending', 'approved', 'in_transit', 'rejected', 'completed'];

type BatchAllocation = {
  batchId: number;
  batchNo: string;
  purchaseDate: string;
  expiryDate: string | null;
  costPrice: number | null;
  quantity: number;
};

function getTransferReferenceNo(transferId: number) {
  return `TF-${transferId}`;
}

function isValidTransferType(value: unknown): value is TransferType {
  return typeof value === 'string' && VALID_TRANSFER_TYPES.includes(value as TransferType);
}

function isValidTransferStatus(value: unknown): value is TransferStatus {
  return typeof value === 'string' && VALID_TRANSFER_STATUSES.includes(value as TransferStatus);
}

function canOperatePhysicalTransfer(user: Request['user'], storeId: number) {
  if (!user) {
    return false;
  }

  return user.role === 'shop_owner' || (user.role === 'store_admin' && user.storeId === storeId);
}

async function countOtherOwners(currentUserId: number) {
  return AppDataSource.getRepository(User)
    .createQueryBuilder('u')
    .leftJoin('u.role', 'r')
    .where('u.isActive = true')
    .andWhere('r.name = :roleName', { roleName: 'shop_owner' })
    .andWhere('u.id != :currentUserId', { currentUserId })
    .getCount();
}

async function deductSourceInventory(
  em: EntityManager,
  transferId: number,
  fromStoreId: number,
  productId: number,
  quantity: number,
  operatedBy: number,
  note: string | null,
): Promise<BatchAllocation[]> {
  const invRepo = em.getRepository(Inventory);
  const fromInv = await invRepo.findOne({ where: { storeId: fromStoreId, productId } });

  if (!fromInv || fromInv.quantity < quantity) {
    throw new Error(`调出门店商品 ${productId} 库存不足`);
  }

  const batches = await em.find(InventoryBatch, {
    where: { inventoryId: fromInv.id },
    order: { purchaseDate: 'ASC', id: 'ASC' },
  });

  const allocations: BatchAllocation[] = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }
    if (batch.quantity <= 0) {
      continue;
    }

    const deductQuantity = Math.min(batch.quantity, remaining);
    batch.quantity -= deductQuantity;
    remaining -= deductQuantity;
    await em.save(batch);

    allocations.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      purchaseDate: batch.purchaseDate,
      expiryDate: batch.expiryDate,
      costPrice: batch.costPrice,
      quantity: deductQuantity,
    });

    await em.save(em.create(StockMovement, {
      storeId: fromStoreId,
      productId,
      batchId: batch.id,
      type: 'transfer_out',
      quantity: -deductQuantity,
      referenceNo: getTransferReferenceNo(transferId),
      note,
      operatedBy,
    }));
  }

  if (remaining > 0) {
    throw new Error(`调出门店商品 ${productId} 批次数量不足`);
  }

  fromInv.quantity -= quantity;
  await em.save(fromInv);

  return allocations;
}

async function receiveTargetInventory(
  em: EntityManager,
  transferId: number,
  toStoreId: number,
  productId: number,
  allocations: BatchAllocation[],
  operatedBy: number,
  note: string | null,
) {
  const invRepo = em.getRepository(Inventory);
  let toInv = await invRepo.findOne({ where: { storeId: toStoreId, productId } });

  if (!toInv) {
    toInv = em.create(Inventory, { storeId: toStoreId, productId, quantity: 0 });
    toInv = await em.save(toInv);
  }

  const totalQuantity = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  toInv.quantity += totalQuantity;
  await em.save(toInv);

  for (const allocation of allocations) {
    const newBatch = em.create(InventoryBatch, {
      inventoryId: toInv.id,
      batchNo: `${allocation.batchNo}-TF-${transferId}`,
      quantity: allocation.quantity,
      purchaseDate: allocation.purchaseDate,
      expiryDate: allocation.expiryDate,
      costPrice: allocation.costPrice,
    });
    const savedBatch = await em.save(newBatch);

    await em.save(em.create(StockMovement, {
      storeId: toStoreId,
      productId,
      batchId: savedBatch.id,
      type: 'transfer_in',
      quantity: allocation.quantity,
      referenceNo: getTransferReferenceNo(transferId),
      note,
      operatedBy,
    }));
  }
}

async function loadOutboundAllocations(
  em: EntityManager,
  transferId: number,
  fromStoreId: number,
  productId: number,
  expectedQuantity: number,
): Promise<BatchAllocation[]> {
  const movements = await em.getRepository(StockMovement).find({
    where: {
      storeId: fromStoreId,
      productId,
      type: 'transfer_out',
      referenceNo: getTransferReferenceNo(transferId),
    },
    relations: ['batch'],
    order: { id: 'ASC' },
  });

  const allocations = movements
    .filter((movement) => movement.batch)
    .map((movement) => ({
      batchId: movement.batchId!,
      batchNo: movement.batch!.batchNo,
      purchaseDate: movement.batch!.purchaseDate,
      expiryDate: movement.batch!.expiryDate,
      costPrice: movement.batch!.costPrice,
      quantity: Math.abs(movement.quantity),
    }));

  const totalQuantity = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  if (!allocations.length || totalQuantity !== expectedQuantity) {
    throw new Error(`调拨单 ${transferId} 的出库批次记录不完整`);
  }

  return allocations;
}

async function shipTransfer(transfer: Transfer, operatedBy: number) {
  await AppDataSource.transaction(async (em) => {
    for (const item of transfer.items) {
      await deductSourceInventory(
        em,
        transfer.id,
        transfer.fromStoreId,
        item.productId,
        item.quantity,
        operatedBy,
        transfer.note,
      );
    }

    transfer.status = 'in_transit';
    transfer.shippedBy = operatedBy;
    transfer.shippedAt = new Date();
    await em.save(transfer);
  });
}

async function receiveTransfer(transfer: Transfer, operatedBy: number) {
  await AppDataSource.transaction(async (em) => {
    for (const item of transfer.items) {
      const allocations = await loadOutboundAllocations(
        em,
        transfer.id,
        transfer.fromStoreId,
        item.productId,
        item.quantity,
      );

      await receiveTargetInventory(
        em,
        transfer.id,
        transfer.toStoreId,
        item.productId,
        allocations,
        operatedBy,
        transfer.note,
      );
    }

    transfer.status = 'completed';
    transfer.receivedBy = operatedBy;
    transfer.receivedAt = new Date();
    transfer.completedBy = operatedBy;
    transfer.completedAt = new Date();
    await em.save(transfer);
  });
}

async function executeAdjustment(transfer: Transfer, operatedBy: number) {
  await AppDataSource.transaction(async (em) => {
    for (const item of transfer.items) {
      const allocations = await deductSourceInventory(
        em,
        transfer.id,
        transfer.fromStoreId,
        item.productId,
        item.quantity,
        operatedBy,
        transfer.note,
      );

      await receiveTargetInventory(
        em,
        transfer.id,
        transfer.toStoreId,
        item.productId,
        allocations,
        operatedBy,
        transfer.note,
      );
    }

    transfer.status = 'completed';
    transfer.completedBy = operatedBy;
    transfer.completedAt = new Date();
    await em.save(transfer);
  });
}

// GET /api/v1/transfers — 调拨列表
router.get('/', authenticate, storeScope, async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Transfer);
  const qb = repo
    .createQueryBuilder('t')
    .leftJoinAndSelect('t.fromStore', 'fs')
    .leftJoinAndSelect('t.toStore', 'ts')
    .leftJoinAndSelect('t.requester', 'req')
    .leftJoinAndSelect('t.approver', 'app');

  if (req.scopedStoreId) {
    qb.andWhere('(t.from_store_id = :storeId OR t.to_store_id = :storeId)', { storeId: req.scopedStoreId });
  }
  if (req.query.status) {
    if (!isValidTransferStatus(req.query.status)) {
      return res.status(400).json({ message: '调拨状态不合法' });
    }
    qb.andWhere('t.status = :status', { status: req.query.status });
  }
  if (req.query.type) {
    if (!isValidTransferType(req.query.type)) {
      return res.status(400).json({ message: '调拨类型不合法' });
    }
    qb.andWhere('t.type = :type', { type: req.query.type });
  }

  const list = await qb.orderBy('t.createdAt', 'DESC').getMany();
  return res.json(list);
});

// POST /api/v1/transfers — 创建门店间库存单据
router.post('/', authenticate, requireRole('shop_owner', 'store_admin'), storeScope, async (req: Request, res: Response) => {
  const { toStoreId, fromStoreId, items, note, reasonCode } = req.body;
  const type = isValidTransferType(req.body.type) ? req.body.type : 'physical_transfer';

  if (type === 'book_adjustment' && req.user?.role !== 'shop_owner') {
    return res.status(403).json({ message: '账面划转仅允许店主发起' });
  }
  if (!toStoreId || !items?.length) {
    return res.status(400).json({ message: '目标门店和调拨明细不能为空' });
  }
  if (!reasonCode) {
    return res.status(400).json({ message: '请填写调拨原因' });
  }

  let actualFromStoreId: number;
  if (req.user?.role === 'shop_owner') {
    actualFromStoreId = fromStoreId ? parseInt(String(fromStoreId), 10) : req.scopedStoreId!;
    if (!actualFromStoreId) {
      return res.status(400).json({ message: '店主请指定调出门店' });
    }
  } else {
    actualFromStoreId = req.scopedStoreId!;
  }

  if (actualFromStoreId === toStoreId) {
    return res.status(400).json({ message: '调出和调入门店不能相同' });
  }

  const invRepo = AppDataSource.getRepository(Inventory);
  for (const item of items) {
    const inv = await invRepo.findOne({ where: { storeId: actualFromStoreId, productId: item.productId } });
    if (!inv || inv.quantity < item.quantity) {
      return res.status(400).json({ message: `商品 ${item.productId} 库存不足` });
    }
  }

  const savedTransfer = await AppDataSource.transaction(async (em) => {
    const transfer = em.create(Transfer, {
      fromStoreId: actualFromStoreId,
      toStoreId,
      type,
      status: 'pending',
      requestedBy: req.user!.id,
      reasonCode,
      note: note ?? null,
      approvedBy: null,
      approvedAt: null,
      shippedBy: null,
      shippedAt: null,
      receivedBy: null,
      receivedAt: null,
      completedBy: null,
      completedAt: null,
      selfApprovedException: false,
    });
    await em.save(transfer);

    for (const item of items) {
      const transferItem = em.create(TransferItem, {
        transferId: transfer.id,
        productId: item.productId,
        quantity: item.quantity,
      });
      await em.save(transferItem);
    }

    return transfer;
  });

  return res.status(201).json({ message: '单据已提交', id: savedTransfer.id });
});

// PUT /api/v1/transfers/:id/approve — 审批通过
router.put('/:id/approve', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const repo = AppDataSource.getRepository(Transfer);
  const transfer = await repo.findOne({ where: { id }, relations: ['items'] });

  if (!transfer) {
    return res.status(404).json({ message: '调拨单不存在' });
  }
  if (transfer.status !== 'pending') {
    return res.status(400).json({ message: '只有待审批单据可以审批' });
  }

  let selfApprovedException = false;
  if (transfer.requestedBy === req.user!.id) {
    const otherOwnerCount = await countOtherOwners(req.user!.id);
    if (otherOwnerCount > 0) {
      return res.status(400).json({ message: '存在其他店主时，不允许自己审批自己的单据' });
    }
    selfApprovedException = true;
  }

  transfer.status = 'approved';
  transfer.approvedBy = req.user!.id;
  transfer.approvedAt = new Date();
  transfer.selfApprovedException = selfApprovedException;
  await repo.save(transfer);

  return res.json({ message: '已审批通过' });
});

// PUT /api/v1/transfers/:id/reject — 审批拒绝
router.put('/:id/reject', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const repo = AppDataSource.getRepository(Transfer);
  const transfer = await repo.findOne({ where: { id } });

  if (!transfer) {
    return res.status(404).json({ message: '调拨单不存在' });
  }
  if (transfer.status !== 'pending') {
    return res.status(400).json({ message: '只有待审批单据可以拒绝' });
  }

  transfer.status = 'rejected';
  transfer.approvedBy = req.user!.id;
  transfer.approvedAt = new Date();
  await repo.save(transfer);

  return res.json({ message: '已拒绝' });
});

// PUT /api/v1/transfers/:id/ship — 实物调拨发货
router.put('/:id/ship', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const transfer = await AppDataSource.getRepository(Transfer).findOne({ where: { id }, relations: ['items'] });

  if (!transfer) {
    return res.status(404).json({ message: '调拨单不存在' });
  }
  if (transfer.type !== 'physical_transfer') {
    return res.status(400).json({ message: '只有实物调拨支持发货' });
  }
  if (transfer.status !== 'approved') {
    return res.status(400).json({ message: '只有已审批的实物调拨可以发货' });
  }
  if (!canOperatePhysicalTransfer(req.user, transfer.fromStoreId)) {
    return res.status(403).json({ message: '当前用户无权发起该门店的发货操作' });
  }

  await shipTransfer(transfer, req.user!.id);
  return res.json({ message: '发货成功，库存已转为在途' });
});

// PUT /api/v1/transfers/:id/receive — 实物调拨收货
router.put('/:id/receive', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const transfer = await AppDataSource.getRepository(Transfer).findOne({ where: { id }, relations: ['items'] });

  if (!transfer) {
    return res.status(404).json({ message: '调拨单不存在' });
  }
  if (transfer.type !== 'physical_transfer') {
    return res.status(400).json({ message: '只有实物调拨支持收货' });
  }
  if (transfer.status !== 'in_transit') {
    return res.status(400).json({ message: '只有在途中的实物调拨可以确认收货' });
  }
  if (!canOperatePhysicalTransfer(req.user, transfer.toStoreId)) {
    return res.status(403).json({ message: '当前用户无权确认该门店的收货操作' });
  }

  await receiveTransfer(transfer, req.user!.id);
  return res.json({ message: '收货成功，调拨已完成' });
});

// PUT /api/v1/transfers/:id/execute-adjustment — 执行账面划转
router.put('/:id/execute-adjustment', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const transfer = await AppDataSource.getRepository(Transfer).findOne({ where: { id }, relations: ['items'] });

  if (!transfer) {
    return res.status(404).json({ message: '调拨单不存在' });
  }
  if (transfer.type !== 'book_adjustment') {
    return res.status(400).json({ message: '只有账面划转支持执行划转' });
  }
  if (transfer.status !== 'approved') {
    return res.status(400).json({ message: '只有已审批的账面划转可以执行' });
  }

  await executeAdjustment(transfer, req.user!.id);
  return res.json({ message: '账面划转执行成功' });
});

export default router;
