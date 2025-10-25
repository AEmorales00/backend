"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
// Helper: convierte "" en undefined para campos opcionales de texto
const emptyToUndefined = (schema) => zod_1.z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'name requerido'),
    description: emptyToUndefined(zod_1.z.string().trim().optional()),
    barcode: emptyToUndefined(zod_1.z.string().trim().min(1).optional()),
    price: zod_1.z.coerce.number().nonnegative('price >= 0'),
    stock: zod_1.z.coerce.number().int().nonnegative('stock >= 0').default(0),
});
// Para update permitimos parcial (todos opcionales), respetando empty->undefined
exports.updateProductSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).optional(),
    description: emptyToUndefined(zod_1.z.string().trim().optional()),
    barcode: emptyToUndefined(zod_1.z.string().trim().min(1).optional()),
    price: zod_1.z.coerce.number().nonnegative().optional(),
    stock: zod_1.z.coerce.number().int().nonnegative().optional(),
    active: zod_1.z.coerce.boolean().optional(),
});
//# sourceMappingURL=inventory.schema.js.map