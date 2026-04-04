import request from 'supertest';
import app from '../src/app';
import { AppDataSource } from '../src/config/database';
import { redisClient } from '../src/config/redis';
import { Inventory } from '../src/entities/Inventory';
import { Product } from '../src/entities/Product';
import { StockMovement } from '../src/entities/StockMovement';
import { Stocktake } from '../src/entities/Stocktake';
import { StocktakeItem } from '../src/entities/StocktakeItem';
import { Store } from '../src/entities/Store';

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  await redisClient.quit();
});

async function loginOwner() {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@bicycle.com', password: 'Admin@123456' });

  expect(loginRes.status).toBe(200);
  return loginRes.body.accessToken as string;
}

async function getStoreFixture() {
  const stores = await AppDataSource.getRepository(Store).find({
    order: { id: 'ASC' },
  });
  const store = stores[0];

  const inventory = await AppDataSource.getRepository(Inventory).findOne({
    where: { storeId: store.id },
    order: { quantity: 'DESC' },
  });

  const product = await AppDataSource.getRepository(Product).findOne({
    where: { id: inventory!.productId },
  });

  if (!store || !inventory || !product) {
    throw new Error('测试所需的门店、库存或商品数据不存在');
  }

  return {
    storeId: store.id,
    productId: product.id,
    categoryId: product.categoryId,
  };
}

async function getColumnNames(tableName: string) {
  const rows = await AppDataSource.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  return rows.map((row: { column_name: string }) => row.column_name);
}

describe('Stocktake and product schema cleanup regression', () => {
  it('商品和分类接口在按分类过滤时仍可正常访问', async () => {
    const token = await loginOwner();
    const fixture = await getStoreFixture();

    const categoriesRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(categoriesRes.status).toBe(200);
    expect(Array.isArray(categoriesRes.body)).toBe(true);

    const productsRes = await request(app)
      .get('/api/v1/products')
      .query({ category_id: fixture.categoryId })
      .set('Authorization', `Bearer ${token}`);

    expect(productsRes.status).toBe(200);
    expect(Array.isArray(productsRes.body)).toBe(true);
    expect(productsRes.body.some((item: { id: number }) => item.id === fixture.productId)).toBe(true);
  });

  it('盘点链路可以创建、填写并完成，且实体关系可正常读取', async () => {
    const token = await loginOwner();
    const fixture = await getStoreFixture();

    const createRes = await request(app)
      .post('/api/v1/stocktakes')
      .query({ store_id: fixture.storeId })
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/stocktakes')
      .query({ store_id: fixture.storeId, status: 'open' })
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const stocktakeId = listRes.body[0].id as number;

    const itemsRes = await request(app)
      .get(`/api/v1/stocktakes/${stocktakeId}/items`)
      .query({ store_id: fixture.storeId })
      .set('Authorization', `Bearer ${token}`);

    expect(itemsRes.status).toBe(200);
    expect(Array.isArray(itemsRes.body)).toBe(true);

    const targetItem = itemsRes.body.find((item: { productId: number }) => item.productId === fixture.productId);
    expect(targetItem).toBeDefined();

    const saveRes = await request(app)
      .put(`/api/v1/stocktakes/${stocktakeId}/items`)
      .query({ store_id: fixture.storeId })
      .set('Authorization', `Bearer ${token}`)
      .send(itemsRes.body.map((item: { productId: number; systemQty: number }) => ({
        productId: item.productId,
        actualQty: item.productId === fixture.productId ? item.systemQty + 1 : item.systemQty,
        note: item.productId === fixture.productId ? '测试-盘点调整' : '测试-盘点无差异',
      })));

    expect(saveRes.status).toBe(200);

    const completeRes = await request(app)
      .post(`/api/v1/stocktakes/${stocktakeId}/complete`)
      .query({ store_id: fixture.storeId })
      .set('Authorization', `Bearer ${token}`);

    expect(completeRes.status).toBe(200);

    const savedStocktake = await AppDataSource.getRepository(Stocktake).findOne({
      where: { id: stocktakeId },
      relations: ['store', 'creator', 'completer'],
    });

    expect(savedStocktake).toBeTruthy();
    expect(savedStocktake!.status).toBe('completed');
    expect(savedStocktake!.completedBy).not.toBeNull();

    const savedItem = await AppDataSource.getRepository(StocktakeItem).findOne({
      where: { stocktakeId, productId: fixture.productId },
      relations: ['product'],
    });

    expect(savedItem).toBeTruthy();
    expect(savedItem!.actualQty).toBe(targetItem.systemQty + 1);
    expect(savedItem!.product.id).toBe(fixture.productId);

    const adjustMovements = await AppDataSource.getRepository(StockMovement).find({
      where: { referenceNo: `ST-${stocktakeId}` },
    });

    expect(adjustMovements.length).toBeGreaterThan(0);
  });

  it('第二批清理完成后不应再保留剩余驼峰列', async () => {
    const productColumns = await getColumnNames('products');
    const categoryColumns = await getColumnNames('categories');
    const stocktakeColumns = await getColumnNames('stocktakes');
    const stocktakeItemColumns = await getColumnNames('stocktake_items');

    expect(productColumns).not.toContain('categoryId');
    expect(categoryColumns).not.toContain('parentId');
    expect(stocktakeColumns).not.toContain('storeId');
    expect(stocktakeColumns).not.toContain('createdBy');
    expect(stocktakeColumns).not.toContain('completedBy');
    expect(stocktakeItemColumns).not.toContain('stocktakeId');
    expect(stocktakeItemColumns).not.toContain('productId');
  });
});
