"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const warehouse_controller_1 = require("./warehouse.controller");
const middlewares_1 = require("../../core/middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authenticate);
router.get('/purchases', (0, middlewares_1.requireRoles)('BODEGUERO', 'ADMIN'), warehouse_controller_1.listPurchases);
router.post('/purchases', (0, middlewares_1.requireRoles)('BODEGUERO', 'ADMIN'), warehouse_controller_1.createPurchase);
exports.default = router;
//# sourceMappingURL=warehouse.routes.js.map