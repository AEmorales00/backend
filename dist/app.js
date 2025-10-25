"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const middlewares_1 = require("./core/middlewares");
const auth_controller_1 = require("./modules/auth/auth.controller");
const qa_controller_1 = require("./modules/qa/qa.controller");
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const user_controller_1 = require("./modules/users/user.controller");
const inventory_controller_1 = __importDefault(require("./modules/inventory/inventory.controller"));
const sales_controller_1 = __importStar(require("./modules/sales/sales.controller"));
const reports_controller_1 = require("./modules/reports/reports.controller");
const warehouse_routes_1 = __importDefault(require("./modules/warehouse/warehouse.routes"));
const db_1 = require("./core/db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// Log simple de rutas para diagnosticar 404/401/403 rápidamente
app.use((req, _res, next) => {
    try {
        console.log(req.method, req.originalUrl);
    }
    catch { }
    next();
});
// Health check
app.get('/health', (_req, res) => res.json({ ok: true, service: 'backend', ts: Date.now() }));
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
app.post('/auth/register', auth_controller_1.register);
app.post('/auth/login', auth_controller_1.login);
app.get('/auth/me', auth_controller_1.me);
// QA
app.get('/qa/test-cases', qa_controller_1.listTestCases);
app.post('/qa/test-cases', qa_controller_1.createTestCase);
// Users
app.use(user_routes_1.default);
// Administración de usuarios (solo Admin)
app.get('/admin/users', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.listUsers);
app.get('/admin/users/:id', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.getUserById);
app.post('/admin/users', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.createUser);
app.patch('/admin/users/:id', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.updateUser);
app.patch('/admin/users/:id/password', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.changePassword);
app.patch('/admin/users/:id/roles', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.setUserRoles);
app.patch('/admin/users/:id/status', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.setUserStatus);
app.delete('/admin/users/:id', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN'), user_controller_1.deleteUser);
// Inventory
app.use('/inventory', inventory_controller_1.default);
// Sales
app.use('/sales', sales_controller_1.default);
// Alias en español
app.use('/ventas', sales_controller_1.default);
app.use('/venta', sales_controller_1.default);
// Compatibilidad con endpoints alternos de items
app.get('/sale-items', sales_controller_1.getSaleItems);
app.get('/items', sales_controller_1.getSaleItems);
// Reports (JEFE/Admin)
app.get('/reports/summary', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), reports_controller_1.summaryReport);
app.get('/reports/overview', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), reports_controller_1.overviewReport);
app.get('/reports/sales-by-day', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), reports_controller_1.salesByDayReport);
app.get('/reports/top-products', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), reports_controller_1.topProductsReport);
app.get('/reports/sales-by-seller', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), reports_controller_1.salesBySellerReport);
app.get('/reports/low-stock', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), reports_controller_1.lowStockReport);
// Warehouse (Bodega)
app.use('/warehouse', warehouse_routes_1.default);
// Products alias for frontend (search + limit)
app.get('/products', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE', 'BODEGUERO', 'VENDEDOR'), async (req, res) => {
    const q = String(req.query.q ?? req.query.search ?? '').trim();
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
    const where = { active: true };
    if (q) {
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q, mode: 'insensitive' } },
        ];
    }
    const rows = await db_1.prisma.product.findMany({ where, take: limit, orderBy: { id: 'asc' } });
    const data = rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        price: Number(p.price),
        stock: p.stock,
    }));
    res.json(data);
});
// error handler (siempre al final)
app.use(middlewares_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map