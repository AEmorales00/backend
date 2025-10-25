"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSaleSchema = exports.saleItemSchema = void 0;
const zod_1 = require("zod");
exports.saleItemSchema = zod_1.z.object({
    productId: zod_1.z.coerce.number().int().positive('productId inválido'),
    quantity: zod_1.z.coerce.number().int().positive('quantity debe ser > 0'),
    // El precio puede venir desde el frontend; si no viene, usaremos el del producto
    price: zod_1.z.coerce.number().nonnegative('price >= 0').optional(),
});
exports.createSaleSchema = zod_1.z.object({
    items: zod_1.z.array(exports.saleItemSchema).min(1, 'La venta debe tener al menos un item'),
});
//# sourceMappingURL=sales.schema.js.map