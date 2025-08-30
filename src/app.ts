import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './core/middlewares';
import { register, login } from './modules/auth/auth.controller';
import { createTestCase, listTestCases } from './modules/qa/qa.controller';
import userRouter from './modules/users/user.routes';
import inventoryRoutes from './modules/inventory/inventory.controller';
import salesRoutes, { getSaleItems } from './modules/sales/sales.controller';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// Health check
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'backend', ts: Date.now() })
);

// Root route (para probar rápido en el navegador)
app.get('/', (_req, res) => {
  res.json({
    message: 'API up',
    endpoints: [
      'GET /health',
      'POST /auth/register',
      'POST /auth/login',
      'POST /users',
      'GET/POST /inventory',
    ],
  });
});

// Auth
app.post('/auth/register', register);
app.post('/auth/login', login);

// QA
app.get('/qa/test-cases', listTestCases);
app.post('/qa/test-cases', createTestCase);

// Users
app.use(userRouter);

// Inventory
app.use('/inventory', inventoryRoutes);

// Sales
app.use('/sales', salesRoutes);
// Alias en español
app.use('/ventas', salesRoutes);
app.use('/venta', salesRoutes);
// Compatibilidad con endpoints alternos de items
app.get('/sale-items', getSaleItems);
app.get('/items', getSaleItems);

// error handler (siempre al final)
app.use(errorHandler);
export default app;
