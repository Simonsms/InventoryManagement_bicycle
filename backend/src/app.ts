import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import categoriesRouter from './routes/categories';
import productsRouter from './routes/products';
import inventoryRouter from './routes/inventory';
import movementsRouter from './routes/movements';
import transfersRouter from './routes/transfers';
import stocktakesRouter from './routes/stocktakes';
import storesRouter from './routes/stores';
import usersRouter from './routes/users';
import importRouter from './routes/import';
import dashboardRouter from './routes/dashboard';
import settingsRouter from './routes/settings';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/movements', movementsRouter);
app.use('/api/v1/transfers', transfersRouter);
app.use('/api/v1/stocktakes', stocktakesRouter);
app.use('/api/v1/stores', storesRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/import', importRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/settings', settingsRouter);

export default app;
