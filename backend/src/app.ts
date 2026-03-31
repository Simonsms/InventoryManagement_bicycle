import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { AppDataSource } from './config/database';
import authRouter from './routes/auth';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/auth', authRouter);

AppDataSource.initialize()
  .then(() => console.log('Database connected'))
  .catch((err) => { console.error('Database connection failed:', err); process.exit(1); });

export default app;
