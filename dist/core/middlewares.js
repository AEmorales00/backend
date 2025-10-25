"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.authenticateJWT = authenticateJWT;
exports.rateLimitPerUser = rateLimitPerUser;
exports.authenticate = authenticate;
exports.requireRoles = requireRoles;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
function errorHandler(err, _req, res, _next) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Error interno' });
}
function authenticateJWT(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const [, token] = header.split(' ');
        if (!token)
            return res.status(401).json({ message: 'No autenticado' });
        const payload = jsonwebtoken_1.default.verify(token, config_1.env.jwtSecret);
        req.user = { id: Number(payload.sub), role: payload.role };
        next();
    }
    catch (e) {
        return res.status(401).json({ message: 'Token inválido' });
    }
}
// Rate limit simple en memoria por usuario
const rateBuckets = new Map();
function rateLimitPerUser(maxPerWindow = 30, windowMs = 60000) {
    return (req, res, next) => {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: 'No autenticado' });
        const now = Date.now();
        const arr = rateBuckets.get(userId) ?? [];
        // purgar
        const recent = arr.filter((t) => now - t < windowMs);
        if (recent.length >= maxPerWindow) {
            return res.status(429).json({ message: 'Rate limit excedido' });
        }
        recent.push(now);
        rateBuckets.set(userId, recent);
        next();
    };
}
// --- Nuevos middlewares (RBAC) ---
function authenticate(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token)
        return res.status(401).json({ message: 'No token' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.env.jwtSecret);
        if (payload.status && payload.status !== 'ACTIVO') {
            return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
        }
        req.user = payload;
        next();
    }
    catch (_e) {
        return res.status(401).json({ message: 'Token inválido' });
    }
}
function requireRoles(...allowed) {
    return (req, res, next) => {
        const roles = req.user?.roles ?? [];
        const ok = roles.some(r => allowed.includes(r));
        if (!ok)
            return res.status(403).json({ message: 'Sin permisos' });
        next();
    };
}
//# sourceMappingURL=middlewares.js.map