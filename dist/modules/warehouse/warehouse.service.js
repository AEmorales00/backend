"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseService = void 0;
const db_1 = require("../../core/db");
class WarehouseService {
    async listPurchases(_params) {
        return db_1.prisma.purchase.findMany({
            orderBy: { id: 'desc' },
            include: { supplier: true, user: true, items: { include: { product: true } } },
        });
    }
    async createPurchase(userId, dto) {
        const total = dto.items.reduce((acc, it) => acc + Number(it.unitCost) * Number(it.quantity), 0);
        return await db_1.prisma.$transaction(async (tx) => {
            const purchase = await tx.purchase.create({
                data: {
                    userId,
                    supplierId: dto.supplierId ?? null,
                    note: dto.note ?? null,
                    totalCost: total,
                },
            });
            for (const it of dto.items) {
                await tx.purchaseItem.create({
                    data: {
                        purchaseId: purchase.id,
                        productId: it.productId,
                        quantity: it.quantity,
                        unitCost: it.unitCost,
                        subtotal: (it.quantity * it.unitCost),
                    },
                });
                await tx.product.update({
                    where: { id: it.productId },
                    data: { stock: { increment: it.quantity } },
                });
            }
            return tx.purchase.findUnique({
                where: { id: purchase.id },
                include: { supplier: true, user: true, items: { include: { product: true } } },
            });
        });
    }
}
exports.WarehouseService = WarehouseService;
//# sourceMappingURL=warehouse.service.js.map