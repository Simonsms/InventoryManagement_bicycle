import { Request, Response, NextFunction } from 'express';

export function storeScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: '未认证' });

  if (req.user.role === 'shop_owner') {
    req.scopedStoreId = req.query.store_id
      ? parseInt(req.query.store_id as string, 10)
      : undefined;
  } else {
    if (!req.user.storeId) {
      return res.status(403).json({ message: '用户未绑定门店' });
    }
    req.scopedStoreId = req.user.storeId;
  }

  next();
}
