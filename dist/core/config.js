"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
exports.env = {
    port: Number(process.env.PORT ?? 3000),
    dbUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET ?? 'default-secret',
    jwtExpires: process.env.JWT_EXPIRES ?? '15m',
    refreshExpires: process.env.REFRESH_EXPIRES ?? '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
};
//# sourceMappingURL=config.js.map