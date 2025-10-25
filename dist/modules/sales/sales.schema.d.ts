import { z } from 'zod';
export declare const saleItemSchema: z.ZodObject<{
    productId: z.ZodCoercedNumber<unknown>;
    quantity: z.ZodCoercedNumber<unknown>;
    price: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const createSaleSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodCoercedNumber<unknown>;
        quantity: z.ZodCoercedNumber<unknown>;
        price: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
//# sourceMappingURL=sales.schema.d.ts.map