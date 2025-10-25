import { z } from 'zod';

export const purchaseItemDto = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});

export const createPurchaseDto = z.object({
  supplierId: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
  items: z.array(purchaseItemDto).min(1),
});

export type CreatePurchaseDto = z.infer<typeof createPurchaseDto>;

