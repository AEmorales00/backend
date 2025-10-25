"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPurchases = listPurchases;
exports.createPurchase = createPurchase;
const warehouse_service_1 = require("./warehouse.service");
const warehouse_schema_1 = require("./warehouse.schema");
const service = new warehouse_service_1.WarehouseService();
async function listPurchases(req, res) {
    const data = await service.listPurchases();
    res.json(data);
}
async function createPurchase(req, res) {
    const parsed = warehouse_schema_1.createPurchaseDto.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const userId = req.user?.sub;
    const purchase = await service.createPurchase(Number(userId), parsed.data);
    res.status(201).json(purchase);
}
//# sourceMappingURL=warehouse.controller.js.map