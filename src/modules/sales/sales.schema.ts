import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.coerce.number().int().positive('productId inválido'),
  quantity: z.coerce.number().int().positive('quantity debe ser > 0'),
  // El precio puede venir desde el frontend; si no viene, usaremos el del producto
  price: z.coerce.number().nonnegative('price >= 0').optional(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'La venta debe tener al menos un item'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;

