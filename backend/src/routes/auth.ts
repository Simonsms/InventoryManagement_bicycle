import { Router, Request, Response } from 'express';
import { login, logout, refreshAccessToken, getUserById } from '../services/authService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码不能为空' });
  }

  try {
    const result = await login(email, password);
    if (!result) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }
    return res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: '服务器错误', error: String(err) });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await getUserById((req as any).user.id);
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }
  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    storeId: user.storeId ?? null,
    storeName: user.store?.name ?? null,
  });
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const token = req.headers.authorization!.slice(7);
  await logout(token);
  return res.json({ message: '已登出' });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: '缺少 refreshToken' });
  }

  const result = await refreshAccessToken(refreshToken);
  if (!result) {
    return res.status(401).json({ message: 'refreshToken 无效或已过期' });
  }

  return res.json(result);
});

export default router;
