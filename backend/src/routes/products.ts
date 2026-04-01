import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const repo = () => AppDataSource.getRepository(Product);

// GET /api/v1/products — 所有人可查看，支持 ?category_id=&brand=&keyword= 过滤
router.get('/', authenticate, async (req: Request, res: Response) => {
  const qb = repo()
    .createQueryBuilder('p')
    .leftJoinAndSelect('p.category', 'c')
    .where('p.isActive = true');

  if (req.query.category_id) {
    qb.andWhere('p.categoryId = :cid', { cid: parseInt(req.query.category_id as string, 10) });
  }
  if (req.query.brand) {
    qb.andWhere('p.brand ILIKE :brand', { brand: `%${req.query.brand}%` });
  }
  if (req.query.keyword) {
    qb.andWhere('(p.name ILIKE :kw OR p.modelNumber ILIKE :kw)', { kw: `%${req.query.keyword}%` });
  }

  const products = await qb.orderBy('p.id', 'ASC').getMany();
  return res.json(products);
});

// GET /api/v1/products/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const product = await repo().findOne({
    where: { id: parseInt(String(req.params.id), 10), isActive: true },
    relations: ['category'],
  });
  if (!product) return res.status(404).json({ message: '商品不存在' });
  return res.json(product);
});

// POST /api/v1/products — 仅店长/管理员
router.post('/', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const { categoryId, name, brand, modelNumber, specs, warrantyMonths, lowStockThreshold } = req.body;
  if (!categoryId || !name || !brand) {
    return res.status(400).json({ message: '分类、名称、品牌不能为空' });
  }

  const product = repo().create({
    categoryId,
    name,
    brand,
    modelNumber: modelNumber ?? null,
    specs: specs ?? {},
    warrantyMonths: warrantyMonths ?? null,
    lowStockThreshold: lowStockThreshold ?? 2,
  });
  const saved = await repo().save(product);
  return res.status(201).json(saved);
});

// PUT /api/v1/products/:id — 仅店长/管理员
router.put('/:id', authenticate, requireRole('shop_owner', 'store_admin'), async (req: Request, res: Response) => {
  const product = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!product) return res.status(404).json({ message: '商品不存在' });

  const fields = ['categoryId', 'name', 'brand', 'modelNumber', 'specs', 'warrantyMonths', 'lowStockThreshold'] as const;
  for (const field of fields) {
    if (req.body[field] !== undefined) (product as any)[field] = req.body[field];
  }

  const saved = await repo().save(product);
  return res.json(saved);
});

// DELETE /api/v1/products/:id — 仅店长（软删除）
router.delete('/:id', authenticate, requireRole('shop_owner'), async (req: Request, res: Response) => {
  const product = await repo().findOneBy({ id: parseInt(String(req.params.id), 10) });
  if (!product) return res.status(404).json({ message: '商品不存在' });

  product.isActive = false;
  await repo().save(product);
  return res.json({ message: '已停用' });
});

export default router;
