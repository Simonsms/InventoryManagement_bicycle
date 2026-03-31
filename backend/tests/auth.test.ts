import request from 'supertest';
import app from '../src/app';
import { AppDataSource } from '../src/config/database';
import { redisClient } from '../src/config/redis';

beforeAll(async () => {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  await redisClient.quit();
});

describe('POST /api/v1/auth/login', () => {
  it('正确账号密码返回 token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@bicycle.com', password: 'Admin@123456' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('shop_owner');
  });

  it('错误密码返回 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@bicycle.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('缺少字段返回 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@bicycle.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('登出后 token 进入黑名单', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@bicycle.com', password: 'Admin@123456' });

    const { accessToken } = loginRes.body;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);

    const retryRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(retryRes.status).toBe(401);
  });
});
