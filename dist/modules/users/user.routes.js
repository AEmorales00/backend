"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const userRouter = (0, express_1.Router)();
userRouter.post('/users', user_controller_1.registerUser);
exports.default = userRouter;
//# sourceMappingURL=user.routes.js.map