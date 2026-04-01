import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Store } from '../entities/Store';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const repo = () => AppDataSource.getRepository(Store);

// GET /api/v1/stores — 门店列表（所有已认证用户可查，用于下拉选择）
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const stores = await repo().find({
    where: { isActive: true },
    order: { id: 'ASC' },
  });
  return res.json(stores);
});

// POST /api/v1/stores — 新增门店（仅店长）
router.post('/', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ message: '门店名称不能为空' });

  const store = repo().create({ name, address: address ?? null, phone: phone ?? null });
  const saved = await repo().save(store);
  return res.status(201).json(saved);
});

// PUT /api/v1/stores/:id — 编辑门店（仅店长）
router.put('/:id', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const store = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!store) return res.status(404).json({ message: '门店不存在' });

  const { name, address, phone } = req.body;
  if (name !== undefined) store.name = name;
  if (address !== undefined) store.address = address;
  if (phone !== undefined) store.phone = phone;

  const saved = await repo().save(store);
  return res.json(saved);
});

// DELETE /api/v1/stores/:id — 停用门店（仅店长，软删除）
router.delete('/:id', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const store = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!store) return res.status(404).json({ message: '门店不存在' });

  store.isActive = false;
  await repo().save(store);
  return res.json({ message: '门店已停用' });
});

export default router;
