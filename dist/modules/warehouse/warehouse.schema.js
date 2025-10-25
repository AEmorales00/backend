"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseDto = exports.purchaseItemDto = void 0;
const zod_1 = require("zod");
exports.purchaseItemDto = zod_1.z.object({
    productId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
    unitCost: zod_1.z.number().nonnegative(),
});
exports.createPurchaseDto = zod_1.z.object({
    supplierId: zod_1.z.number().int().positive().optional(),
    note: zod_1.z.string().max(500).optional(),
    items: zod_1.z.array(exports.purchaseItemDto).min(1),
});
//# sourceMappingURL=warehouse.schema.js.map