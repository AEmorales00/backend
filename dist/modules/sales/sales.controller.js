"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaleItems = getSaleItems;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const middlewares_1 = require("../../core/middlewares");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
async function canReadSale(req, res, next) {
    const id = Number(req.params.id ?? req.query.saleId);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: 'ID inválido' });
    const sale = await prisma.sale.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!sale)
        return res.status(404).json({ message: 'Venta no encontrada' });
    const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
    if (roles.includes('ADMIN') || roles.includes('JEFE'))
        return next();
    if (sale.userId === req.user?.sub)
        return next();
    return res.status(403).json({ message: 'No puedes ver esta venta' });
}
// Crear venta con snapshot de costo/precio (acepta qty o quantity)
router.post('/', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'VENDEDOR'), async (req, res) => {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!rawItems.length)
        return res.status(400).json({ message: 'items requerido' });
    const items = rawItems.map((i) => ({
        productId: Number(i.productId),
        qty: Number(i.qty ?? i.quantity ?? 0),
        price: (i.price != null) ? Number(i.price) : undefined,
    }));
    if (!items.every((i) => Number.isFinite(i.productId) && i.productId > 0 && Number.isFinite(i.qty) && i.qty > 0)) {
        return res.status(400).json({ message: 'items inválidos' });
    }
    const ids = Array.from(new Set(items.map(i => i.productId)));
    const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true } });
    const map = new Map(products.map(p => [p.id, p]));
    // validar existencia y stock
    for (const it of items) {
        const p = map.get(it.productId);
        if (!p)
            return res.status(400).json({ message: `Producto ${it.productId} no existe o está inactivo` });
        if (p.stock < it.qty)
            return res.status(400).json({ message: `Stock insuficiente para producto ${p.id}` });
    }
    let total = 0;
    const saleItems = items.map(i => {
        const p = map.get(i.productId);
        const price = i.price ?? Number(p.price);
        const subtotal = Number((price * i.qty).toFixed(2));
        total += subtotal;
        return { productId: p.id, qty: i.qty, quantity: i.qty, price, cost: Number(p.cost), subtotal };
    });
    try {
        const sale = await prisma.$transaction(async (tx) => {
            for (const it of saleItems) {
                await tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.qty } } });
            }
            return tx.sale.create({
                data: { userId: req.user.sub, total, items: { createMany: { data: saleItems } } },
                include: { items: true },
            });
        });
        res.json(sale);
    }
    catch (e) {
        console.error('Error al registrar venta:', e);
        res.status(500).json({ message: 'Error al registrar venta' });
    }
});
// Listar ventas (resumen)
router.get('/', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE', 'VENDEDOR'), async (req, res) => {
    const q = req.query || {};
    const page = Number(q.page || 0);
    const limit = Number(q.limit || 0);
    const from = q.from ? new Date(String(q.from)) : null;
    const to = q.to ? new Date(String(q.to) + 'T23:59:59') : null;
    const where = {};
    if (from || to)
        where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    // Si es vendedor (y no Admin/JEFE), mostrar solo sus ventas
    const roles = req.user?.roles ?? [];
    const isAdminOrBoss = roles.includes('ADMIN') || roles.includes('JEFE');
    if (!isAdminOrBoss)
        where.userId = req.user.sub;
    const usePaged = (page > 0 || limit > 0 || from || to);
    if (usePaged) {
        const p = page > 0 ? page : 1;
        const take = limit > 0 ? Math.min(limit, 100) : 20;
        const skip = (p - 1) * take;
        const [total, rows] = await prisma.$transaction([
            prisma.sale.count({ where }),
            prisma.sale.findMany({ where, include: { user: true, items: true }, orderBy: { id: 'desc' }, skip, take }),
        ]);
        const data = rows.map((s) => ({
            id: s.id,
            createdAt: s.createdAt,
            userName: s.user?.name ?? '',
            total: Number(s.total),
            items: s.items.map((it) => ({ productId: it.productId, price: Number(it.price), quantity: it.quantity ?? it.qty ?? 0, subtotal: Number(it.subtotal) })),
        }));
        return res.json({ data, total });
    }
    const sales = await prisma.sale.findMany({ where, orderBy: { createdAt: 'desc' } });
    const out = sales.map((s) => ({ id: s.id, createdAt: s.createdAt, total: parseFloat(s.total.toString()) }));
    res.json(out);
});
// Obtener venta por id (con items)
router.get('/:id', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE', 'VENDEDOR'), canReadSale, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: 'ID inválido' });
    try {
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: { items: { include: { product: true } } },
        });
        if (!sale)
            return res.status(404).json({ message: 'Venta no encontrada' });
        const items = sale.items.map((it) => ({
            id: it.id,
            productId: it.productId,
            productName: it.product?.name ?? null,
            price: parseFloat(it.price.toString()),
            quantity: it.quantity,
            subtotal: parseFloat(it.subtotal.toString()),
        }));
        const total = parseFloat(sale.total.toString());
        const response = {
            id: sale.id,
            createdAt: sale.createdAt,
            total,
            totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
            items,
        };
        res.json(response);
    }
    catch (e) {
        console.error('Error obteniendo venta:', e);
        res.status(500).json({ message: 'Error interno' });
    }
});
// Ventas del usuario autenticado
router.get('/my', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'VENDEDOR'), async (req, res) => {
    const sales = await prisma.sale.findMany({
        where: { userId: req.user.sub },
        include: { items: true },
        orderBy: { id: 'desc' },
    });
    res.json(sales);
});
async function getSaleItems(req, res) {
    const idRaw = req.params.id ?? req.query.saleId;
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: 'saleId inválido' });
    try {
        const items = await prisma.saleItem.findMany({
            where: { saleId: id },
            include: { product: true },
            orderBy: { id: 'asc' },
        });
        const out = items.map((it) => ({
            id: it.id,
            productId: it.productId,
            productName: it.product?.name ?? null,
            price: parseFloat(it.price.toString()),
            quantity: it.quantity,
            subtotal: parseFloat(it.subtotal.toString()),
        }));
        res.json(out);
    }
    catch (e) {
        console.error('Error obteniendo items de venta:', e);
        res.status(500).json({ message: 'Error interno' });
    }
}
// Aliases dentro de /sales
router.get('/:id/items', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE', 'VENDEDOR'), canReadSale, getSaleItems);
router.get('/items', middlewares_1.authenticate, (0, middlewares_1.requireRoles)('ADMIN', 'JEFE'), getSaleItems);
exports.default = router;
//# sourceMappingURL=sales.controller.js.map