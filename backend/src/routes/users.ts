import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const repo = () => AppDataSource.getRepository(User);

// GET /api/v1/users — 用户列表（仅店长）
router.get('/', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const qb = repo()
    .createQueryBuilder('u')
    .leftJoinAndSelect('u.role', 'r')
    .leftJoinAndSelect('u.store', 's')
    .where('u.isActive = true');

  if (req.query.store_id) {
    qb.andWhere('u.storeId = :sid', { sid: parseInt(req.query.store_id as string, 10) });
  }

  // 不返回 passwordHash
  const users = await qb.select([
    'u.id', 'u.name', 'u.email', 'u.storeId', 'u.roleId', 'u.isActive', 'u.createdAt',
    'r.id', 'r.name',
    's.id', 's.name',
  ]).getMany();

  return res.json(users);
});

// POST /api/v1/users — 新增用户（仅店长）
router.post('/', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const { name, email, password, roleId, storeId } = req.body;
  if (!name || !email || !password || !roleId) {
    return res.status(400).json({ message: '姓名、邮箱、密码、角色不能为空' });
  }

  const existing = await repo().findOneBy({ email });
  if (existing) return res.status(400).json({ message: '该邮箱已被注册' });

  const role = await AppDataSource.getRepository(Role).findOneBy({ id: roleId });
  if (!role) return res.status(400).json({ message: '角色不存在' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = repo().create({
    name,
    email,
    passwordHash,
    roleId,
    storeId: storeId ?? null,
  });
  const saved = await repo().save(user);

  return res.status(201).json({
    id: saved.id,
    name: saved.name,
    email: saved.email,
    roleId: saved.roleId,
    storeId: saved.storeId,
  });
});

// PUT /api/v1/users/:id — 编辑用户（仅店长）
router.put('/:id', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const user = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!user) return res.status(404).json({ message: '用户不存在' });

  const { name, roleId, storeId, password } = req.body;
  if (name !== undefined) user.name = name;
  if (roleId !== undefined) user.roleId = roleId;
  if (storeId !== undefined) user.storeId = storeId;
  if (password) user.passwordHash = await bcrypt.hash(password, 10);

  const saved = await repo().save(user);
  return res.json({ id: saved.id, name: saved.name, email: saved.email, roleId: saved.roleId, storeId: saved.storeId });
});

// DELETE /api/v1/users/:id — 停用用户（仅店长，软删除）
router.delete('/:id', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const user = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (user.id === req.user!.id) return res.status(400).json({ message: '不能停用自己的账号' });

  user.isActive = false;
  await repo().save(user);
  return res.json({ message: '用户已停用' });
});

export default router;
