"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summaryReport = summaryReport;
exports.overviewReport = overviewReport;
exports.salesByDayReport = salesByDayReport;
exports.topProductsReport = topProductsReport;
exports.salesBySellerReport = salesBySellerReport;
exports.lowStockReport = lowStockReport;
const db_1 = require("../../core/db");
function startOfDay(d) { const t = new Date(d); t.setHours(0, 0, 0, 0); return t; }
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function subDays(d, n) { const t = new Date(d); t.setDate(t.getDate() - n); return t; }
function sumRevenue(sales) {
    return sales.reduce((a, s) => a + Number(s.total), 0);
}
function sumCOGS(sales) {
    return sales.reduce((a, s) => a + s.items.reduce((b, it) => b + Number(it.cost || 0) * Number((it.qty ?? it.quantity) || 0), 0), 0);
}
// Compat: reporte resumido con totales, COGS, margen, por día y top
async function summaryReport(req, res) {
    const { from, to } = req.query; // YYYY-MM-DD
    const where = (from && to)
        ? { createdAt: { gte: new Date(String(from)), lte: new Date(String(to) + 'T23:59:59') } }
        : {};
    const sales = await db_1.prisma.sale.findMany({ where, include: { items: true } });
    const totalVentas = sumRevenue(sales);
    const cogs = sumCOGS(sales);
    const margen = totalVentas - cogs;
    const porDia = {};
    for (const s of sales) {
        const key = s.createdAt.toISOString().slice(0, 10);
        porDia[key] = (porDia[key] || 0) + Number(s.total);
    }
    const agg = await db_1.prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: { qty: true, subtotal: true },
    });
    const ids = agg.map(a => a.productId);
    const prods = await db_1.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameMap = new Map(prods.map(p => [p.id, p.name]));
    const top = agg
        .map(a => ({ name: nameMap.get(a.productId) || '', qty: Number(a._sum.qty || 0), total: Number(a._sum.subtotal || 0) }))
        .sort((x, y) => y.total - x.total)
        .slice(0, 5);
    res.json({ totalVentas, cogs, margen, porDia, top });
}
// JEFE/ADMIN: KPIs de hoy y del mes, + low stock
async function overviewReport(_req, res) {
    const today = startOfDay(new Date());
    const mStart = monthStart(today);
    const [salesToday, salesMonth, lowStockCount] = await Promise.all([
        db_1.prisma.sale.findMany({ where: { createdAt: { gte: today } }, include: { items: true } }),
        db_1.prisma.sale.findMany({ where: { createdAt: { gte: mStart } }, include: { items: true } }),
        db_1.prisma.product.count({ where: { stock: { lte: 5 } } }),
    ]);
    const revenueToday = sumRevenue(salesToday);
    const costToday = sumCOGS(salesToday);
    const revenueMonth = sumRevenue(salesMonth);
    const costMonth = sumCOGS(salesMonth);
    res.json({
        today: {
            sales: salesToday.length,
            revenue: revenueToday,
            cost: costToday,
            margin: revenueToday - costToday,
        },
        month: {
            sales: salesMonth.length,
            revenue: revenueMonth,
            cost: costMonth,
            margin: revenueMonth - costMonth,
        },
        lowStockCount,
    });
}
// JEFE/ADMIN: serie de ventas por día últimos 30 días
async function salesByDayReport(_req, res) {
    const since = startOfDay(subDays(new Date(), 29));
    const sales = await db_1.prisma.sale.findMany({ where: { createdAt: { gte: since } }, include: { items: true }, orderBy: { createdAt: 'asc' } });
    const map = new Map();
    for (const s of sales) {
        const key = s.createdAt.toISOString().slice(0, 10);
        const rec = map.get(key) || { revenue: 0, cost: 0 };
        rec.revenue += Number(s.total);
        rec.cost += s.items.reduce((b, i) => b + Number(i.cost || 0) * Number((i.qty ?? i.quantity) || 0), 0);
        map.set(key, rec);
    }
    const out = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, revenue: v.revenue, cost: v.cost, margin: v.revenue - v.cost }));
    res.json(out);
}
// JEFE/ADMIN: top productos por cantidad y revenue
async function topProductsReport(_req, res) {
    const rows = await db_1.prisma.saleItem.groupBy({ by: ['productId'], _sum: { qty: true, subtotal: true } });
    const ids = rows.map(r => r.productId);
    const prods = await db_1.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameById = new Map(prods.map(p => [p.id, p.name]));
    const out = rows
        .map(r => ({ productId: r.productId, name: nameById.get(r.productId) ?? `#${r.productId}`, qty: Number(r._sum.qty || 0), revenue: Number(r._sum.subtotal || 0) }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
    res.json(out);
}
// JEFE/ADMIN: ventas por vendedor
async function salesBySellerReport(_req, res) {
    const sales = await db_1.prisma.sale.findMany({ include: { items: true } });
    const bySeller = new Map();
    for (const s of sales) {
        const key = s.userId;
        const rec = bySeller.get(key) || { tickets: 0, revenue: 0, cost: 0 };
        rec.tickets += 1;
        rec.revenue += Number(s.total);
        rec.cost += s.items.reduce((b, i) => b + Number(i.cost || 0) * Number((i.qty ?? i.quantity) || 0), 0);
        bySeller.set(key, rec);
    }
    const ids = Array.from(bySeller.keys());
    const users = await db_1.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameById = new Map(users.map(u => [u.id, u.name]));
    const out = ids.map(id => {
        const v = bySeller.get(id);
        return { sellerId: id, seller: nameById.get(id) ?? `#${id}`, tickets: v.tickets, revenue: v.revenue, margin: v.revenue - v.cost };
    });
    res.json(out);
}
// JEFE/ADMIN: stock bajo
async function lowStockReport(_req, res) {
    const low = await db_1.prisma.product.findMany({ where: { stock: { lte: 5 } }, select: { id: true, name: true, stock: true }, orderBy: { stock: 'asc' }, take: 20 });
    res.json(low);
}
//# sourceMappingURL=reports.controller.js.map