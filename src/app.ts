import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, authenticate, requireRoles } from './core/middlewares';
import { register, login, me } from './modules/auth/auth.controller';
import { createTestCase, listTestCases } from './modules/qa/qa.controller';
import userRouter from './modules/users/user.routes';
import { listUsers, getUserById, createUser, updateUser, changePassword, setUserRoles, setUserStatus, deleteUser } from './modules/users/user.controller';
import inventoryRoutes from './modules/inventory/inventory.controller';
import salesRoutes, { getSaleItems } from './modules/sales/sales.controller';
import { summaryReport, overviewReport, salesByDayReport, topProductsReport, salesBySellerReport, lowStockReport } from './modules/reports/reports.controller';
import warehouseRoutes from './modules/warehouse/warehouse.routes';
import { prisma } from './core/db';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// Log simple de rutas para diagnosticar 404/401/403 rápidamente
app.use((req, _res, next) => {
  try { console.log(req.method, req.originalUrl); } catch {}
  next();
});

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
app.get('/auth/me', me as any);

// QA
app.get('/qa/test-cases', listTestCases);
app.post('/qa/test-cases', createTestCase);

// Users
app.use(userRouter);
// Administración de usuarios (solo Admin)
app.get('/admin/users', authenticate, requireRoles('ADMIN'), listUsers);
app.get('/admin/users/:id', authenticate, requireRoles('ADMIN'), getUserById);
app.post('/admin/users', authenticate, requireRoles('ADMIN'), createUser);
app.patch('/admin/users/:id', authenticate, requireRoles('ADMIN'), updateUser);
app.patch('/admin/users/:id/password', authenticate, requireRoles('ADMIN'), changePassword);
app.patch('/admin/users/:id/roles', authenticate, requireRoles('ADMIN'), setUserRoles);
app.patch('/admin/users/:id/status', authenticate, requireRoles('ADMIN'), setUserStatus);
app.delete('/admin/users/:id', authenticate, requireRoles('ADMIN'), deleteUser);

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

// Reports (JEFE/Admin)
app.get('/reports/summary', authenticate, requireRoles('ADMIN','JEFE'), summaryReport);
app.get('/reports/overview', authenticate, requireRoles('ADMIN','JEFE'), overviewReport);
app.get('/reports/sales-by-day', authenticate, requireRoles('ADMIN','JEFE'), salesByDayReport);
app.get('/reports/top-products', authenticate, requireRoles('ADMIN','JEFE'), topProductsReport);
app.get('/reports/sales-by-seller', authenticate, requireRoles('ADMIN','JEFE'), salesBySellerReport);
app.get('/reports/low-stock', authenticate, requireRoles('ADMIN','JEFE'), lowStockReport);

// Warehouse (Bodega)
app.use('/warehouse', warehouseRoutes);

// Products alias for frontend (search + limit)
app.get('/products', authenticate, requireRoles('ADMIN','JEFE','BODEGUERO','VENDEDOR'), async (req, res) => {
  const q = String((req.query as any).q ?? (req.query as any).search ?? '').trim()
  const limitRaw = Number((req.query as any).limit ?? 50)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50
  const where: any = { active: true }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
    ]
  }
  const rows = await prisma.product.findMany({ where, take: limit, orderBy: { id: 'asc' } })
  const data = rows.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    barcode: p.barcode,
    price: Number(p.price),
    stock: p.stock,
  }))
  res.json(data)
})

// error handler (siempre al final)
app.use(errorHandler);
export default app;
