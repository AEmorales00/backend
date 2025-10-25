import { prisma } from '../../core/db';
import { CreatePurchaseDto } from './warehouse.schema';

export class WarehouseService {
  async listPurchases(_params?: { from?: Date; to?: Date; q?: string }) {
    return prisma.purchase.findMany({
      orderBy: { id: 'desc' },
      include: { supplier: true, user: true, items: { include: { product: true } } },
    });
  }

  async createPurchase(userId: number, dto: CreatePurchaseDto) {
    const total = dto.items.reduce((acc, it) => acc + Number(it.unitCost) * Number(it.quantity), 0);

    return await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          userId,
          supplierId: dto.supplierId ?? null,
          note: dto.note ?? null,
          totalCost: total as any,
        },
      });

      for (const it of dto.items) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost as any,
            subtotal: (it.quantity * it.unitCost) as any,
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
