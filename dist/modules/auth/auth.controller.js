"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = void 0;
exports.register = register;
exports.login = login;
const db_1 = require("../../core/db");
const config_1 = require("../../core/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middlewares_1 = require("../../core/middlewares");
function signAccess(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.env.jwtSecret, { expiresIn: '8h' });
}
function toSafeUser(u) {
    const rel = (u?.roles ?? []).map((r) => r?.role?.name).filter(Boolean);
    const col = u?.role ? [String(u.role).toUpperCase()] : [];
    const roles = rel.length ? rel : col;
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status ?? 'ACTIVO',
        roles,
    };
}
async function register(req, res) {
    const name = String(req.body?.name ?? '');
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const exists = await db_1.prisma.user.findUnique({ where: { email } });
    if (exists)
        return res.status(409).json({ message: 'Email ya registrado' });
    const passwordHash = await bcrypt_1.default.hash(password, config_1.env.bcryptRounds);
    const user = await db_1.prisma.user.create({ data: { name, email, passwordHash } });
    res.status(201).json({ id: user.id, email: user.email });
}
async function login(req, res) {
    const emailRaw = String(req.body?.email ?? '');
    const password = String(req.body?.password ?? '');
    const email = emailRaw.trim().toLowerCase();
    if (!email || !password)
        return res.status(400).json({ message: 'Email y contraseña requeridos' });
    const user = await db_1.prisma.user.findUnique({
        where: { email },
        include: { roles: { include: { role: true } } },
    });
    if (!user) {
        console.warn('[auth.login] user not found', { email });
        return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok) {
        console.warn('[auth.login] bad password', { userId: user.id });
        return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const safe = toSafeUser(user);
    const outRoles = safe.roles;
    const status = safe.status;
    const jwtPayload = {
        sub: safe.id,
        name: safe.name,
        email: safe.email,
        roles: outRoles,
        status,
    };
    const userOut = safe;
    const token = signAccess(jwtPayload);
    res.json({ token, user: userOut });
}
// Obtener usuario desde token y rehidratar roles de DB
exports.me = [
    middlewares_1.authenticate,
    async (req, res) => {
        const uid = Number(req.user?.sub);
        if (!uid)
            return res.status(401).json({ message: 'No autenticado' });
        const user = await db_1.prisma.user.findUnique({
            where: { id: uid },
            include: { roles: { include: { role: true } } },
        });
        if (!user)
            return res.status(404).json({ message: 'Usuario no encontrado' });
        const safe = toSafeUser(user);
        return res.json(safe);
    }
];
//# sourceMappingURL=auth.controller.js.map