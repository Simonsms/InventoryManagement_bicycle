import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const ext = isProd ? 'js' : 'ts';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bicycle_inventory',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  synchronize: false,
  logging: !isProd,
  entities: [__dirname + `/../entities/*.${ext}`],
  migrations: [__dirname + `/../migrations/*.${ext}`],
});
