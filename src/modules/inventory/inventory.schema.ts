import { z } from 'zod';

// Helper: convierte "" en undefined para campos opcionales de texto
const emptyToUndefined = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'name requerido'),
  description: emptyToUndefined(z.string().trim().optional()),
  barcode: emptyToUndefined(z.string().trim().min(1).optional()),
  price: z.coerce.number().nonnegative('price >= 0'),
  stock: z.coerce.number().int().nonnegative('stock >= 0').default(0),
});

// Para update permitimos parcial (todos opcionales), respetando empty->undefined
export const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: emptyToUndefined(z.string().trim().optional()),
  barcode: emptyToUndefined(z.string().trim().min(1).optional()),
  price: z.coerce.number().nonnegative().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  active: z.coerce.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
