import request from 'supertest';
import app from '../src/app';
import { AppDataSource } from '../src/config/database';
import { redisClient } from '../src/config/redis';
import { Inventory } from '../src/entities/Inventory';
import { Store } from '../src/entities/Store';
import { Transfer } from '../src/entities/Transfer';
import { StockMovement } from '../src/entities/StockMovement';

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

async function getTransferFixture() {
  const stores = await AppDataSource.getRepository(Store).find({
    order: { id: 'ASC' },
  });
  const [fromStore, toStore] = stores;
  const inventory = await AppDataSource.getRepository(Inventory).findOne({
    where: { storeId: fromStore.id },
    order: { quantity: 'DESC' },
  });

  if (!fromStore || !toStore || !inventory) {
    throw new Error('测试所需的门店和库存数据不存在');
  }

  return {
    fromStoreId: fromStore.id,
    toStoreId: toStore.id,
    productId: inventory.productId,
    quantity: 1,
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

describe('Transfer redesign workflow', () => {
  it('创建实物调拨后列表返回 type 字段', async () => {
    const token = await loginOwner();
    const fixture = await getTransferFixture();

    const createRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'physical_transfer',
        fromStoreId: fixture.fromStoreId,
        toStoreId: fixture.toStoreId,
        items: [{ productId: fixture.productId, quantity: fixture.quantity }],
        reasonCode: 'store_replenishment',
        note: '测试-实物调拨',
      });

    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/transfers')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body[0]).toHaveProperty('type', 'physical_transfer');
  });

  it('实物调拨需要经过发货和收货两个动作', async () => {
    const token = await loginOwner();
    const fixture = await getTransferFixture();

    const createRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'physical_transfer',
        fromStoreId: fixture.fromStoreId,
        toStoreId: fixture.toStoreId,
        items: [{ productId: fixture.productId, quantity: fixture.quantity }],
        reasonCode: 'store_replenishment',
        note: '测试-发货收货',
      });

    expect(createRes.status).toBe(201);

    const pendingListRes = await request(app)
      .get('/api/v1/transfers')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${token}`);

    const transferId = pendingListRes.body[0].id as number;

    const approveRes = await request(app)
      .put(`/api/v1/transfers/${transferId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveRes.status).toBe(200);

    const shipRes = await request(app)
      .put(`/api/v1/transfers/${transferId}/ship`)
      .set('Authorization', `Bearer ${token}`);

    expect(shipRes.status).toBe(200);

    const receiveRes = await request(app)
      .put(`/api/v1/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`);

    expect(receiveRes.status).toBe(200);

    const completedListRes = await request(app)
      .get('/api/v1/transfers')
      .query({ status: 'completed', type: 'physical_transfer' })
      .set('Authorization', `Bearer ${token}`);

    expect(completedListRes.status).toBe(200);
    expect(completedListRes.body.some((item: { id: number }) => item.id === transferId)).toBe(true);

    const savedTransfer = await AppDataSource.getRepository(Transfer).findOne({
      where: { id: transferId },
      relations: ['items'],
    });

    expect(savedTransfer).toBeTruthy();
    expect(savedTransfer!.items.length).toBeGreaterThan(0);

    const savedMovements = await AppDataSource.getRepository(StockMovement).find({
      where: { referenceNo: `TF-${transferId}` },
      relations: ['batch'],
    });

    expect(savedMovements.length).toBeGreaterThan(0);
    expect(savedMovements.every((movement) => movement.batch)).toBe(true);
  });

  it('账面划转允许单店主例外审批并执行', async () => {
    const token = await loginOwner();
    const fixture = await getTransferFixture();

    const createRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'book_adjustment',
        fromStoreId: fixture.fromStoreId,
        toStoreId: fixture.toStoreId,
        items: [{ productId: fixture.productId, quantity: fixture.quantity }],
        reasonCode: 'bookkeeping_fix',
        note: '测试-账面划转',
      });

    expect(createRes.status).toBe(201);

    const pendingListRes = await request(app)
      .get('/api/v1/transfers')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${token}`);

    const transfer = pendingListRes.body.find((item: { note: string }) => item.note === '测试-账面划转');
    expect(transfer).toBeDefined();

    const approveRes = await request(app)
      .put(`/api/v1/transfers/${transfer.id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveRes.status).toBe(200);

    const executeRes = await request(app)
      .put(`/api/v1/transfers/${transfer.id}/execute-adjustment`)
      .set('Authorization', `Bearer ${token}`);

    expect(executeRes.status).toBe(200);
  });

  it('清理完成后主链路表不应再保留旧驼峰列', async () => {
    const transferItemColumns = await getColumnNames('transfer_items');
    const stockMovementColumns = await getColumnNames('stock_movements');
    const inventoryBatchColumns = await getColumnNames('inventory_batches');

    expect(transferItemColumns).not.toContain('transferId');
    expect(transferItemColumns).not.toContain('productId');
    expect(stockMovementColumns).not.toContain('storeId');
    expect(stockMovementColumns).not.toContain('productId');
    expect(stockMovementColumns).not.toContain('batchId');
    expect(stockMovementColumns).not.toContain('operatedBy');
    expect(inventoryBatchColumns).not.toContain('inventoryId');
  });
});
