import { z } from 'zod';
export declare const purchaseItemDto: z.ZodObject<{
    productId: z.ZodNumber;
    quantity: z.ZodNumber;
    unitCost: z.ZodNumber;
}, z.core.$strip>;
export declare const createPurchaseDto: z.ZodObject<{
    supplierId: z.ZodOptional<z.ZodNumber>;
    note: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodNumber;
        quantity: z.ZodNumber;
        unitCost: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreatePurchaseDto = z.infer<typeof createPurchaseDto>;
//# sourceMappingURL=warehouse.schema.d.ts.map