import { Router, Request, Response } from 'express';
import { redisClient } from '../config/redis';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const SETTINGS_KEY = 'app:settings';

// 默认系统参数
const DEFAULT_SETTINGS = {
  staleDays: 90,         // 滞销品判断天数
  lowStockDefault: 2,    // 新商品默认低库存阈值
};

// GET /api/v1/settings
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const raw = await redisClient.get(SETTINGS_KEY);
  if (!raw) {
    return res.json(DEFAULT_SETTINGS);
  }
  try {
    const saved = JSON.parse(raw) as typeof DEFAULT_SETTINGS;
    return res.json({ ...DEFAULT_SETTINGS, ...saved });
  } catch {
    return res.json(DEFAULT_SETTINGS);
  }
});

// PUT /api/v1/settings — 仅店长可改
router.put('/', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const { staleDays, lowStockDefault } = req.body as Partial<typeof DEFAULT_SETTINGS>;

  const current = await redisClient.get(SETTINGS_KEY);
  const existing = current ? (JSON.parse(current) as typeof DEFAULT_SETTINGS) : { ...DEFAULT_SETTINGS };

  if (staleDays !== undefined) {
    if (typeof staleDays !== 'number' || staleDays < 1 || staleDays > 365) {
      return res.status(400).json({ error: '滞销天数必须在 1-365 之间' });
    }
    existing.staleDays = staleDays;
  }
  if (lowStockDefault !== undefined) {
    if (typeof lowStockDefault !== 'number' || lowStockDefault < 0 || lowStockDefault > 9999) {
      return res.status(400).json({ error: '默认低库存阈值必须在 0-9999 之间' });
    }
    existing.lowStockDefault = lowStockDefault;
  }

  await redisClient.set(SETTINGS_KEY, JSON.stringify(existing));
  return res.json(existing);
});

export default router;
