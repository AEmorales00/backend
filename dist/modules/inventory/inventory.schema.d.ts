import { z } from 'zod';
export declare const createProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    barcode: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    price: z.ZodCoercedNumber<unknown>;
    stock: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const updateProductSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    barcode: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    price: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    stock: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    active: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
}, z.core.$strip>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
//# sourceMappingURL=inventory.schema.d.ts.map