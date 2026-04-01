import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Category } from '../entities/Category';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const repo = () => AppDataSource.getRepository(Category);

// GET /api/v1/categories — 所有人可查看
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const categories = await repo().find({ order: { id: 'ASC' } });
  return res.json(categories);
});

// POST /api/v1/categories — 仅店长/管理员
router.post('/', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ message: '分类名称不能为空' });

  const category = repo().create({ name, parentId: parentId ?? null });
  const saved = await repo().save(category);
  return res.status(201).json(saved);
});

// PUT /api/v1/categories/:id — 仅店长/管理员
router.put('/:id', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const category = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!category) return res.status(404).json({ message: '分类不存在' });

  const { name, parentId } = req.body;
  if (name !== undefined) category.name = name;
  if (parentId !== undefined) category.parentId = parentId;

  const saved = await repo().save(category);
  return res.json(saved);
});

// DELETE /api/v1/categories/:id — 仅店长
router.delete('/:id', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const category = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!category) return res.status(404).json({ message: '分类不存在' });

  await repo().remove(category);
  return res.json({ message: '已删除' });
});

export default router;
