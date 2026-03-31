import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { AppDataSource } from '../config/database';
import { Role } from '../entities/Role';
import { Store } from '../entities/Store';
import { User } from '../entities/User';
import bcrypt from 'bcryptjs';

async function seed() {
  await AppDataSource.initialize();

  const roleRepo = AppDataSource.getRepository(Role);
  const storeRepo = AppDataSource.getRepository(Store);
  const userRepo = AppDataSource.getRepository(User);

  const roles = await roleRepo.save([
    { name: 'shop_owner' as const, permissions: {} },
    { name: 'store_admin' as const, permissions: {} },
    { name: 'staff' as const, permissions: {} },
  ]);

  const ownerRole = roles.find(r => r.name === 'shop_owner')!;

  await storeRepo.save({ name: '旗舰店', address: '北京市朝阳区', phone: '010-12345678' });

  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  await userRepo.save({
    name: '管理员',
    email: 'admin@bicycle.com',
    passwordHash,
    roleId: ownerRole.id,
    storeId: null,
  });

  console.log('✅ 种子数据写入完成');
  console.log('   初始账号：admin@bicycle.com / Admin@123456');
  await AppDataSource.destroy();
}

seed().catch(console.error);
