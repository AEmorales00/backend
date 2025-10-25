"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = void 0;
exports.listUsers = listUsers;
exports.setUserRoles = setUserRoles;
exports.setUserStatus = setUserStatus;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.changePassword = changePassword;
exports.deleteUser = deleteUser;
exports.getUserById = getUserById;
const db_1 = require("../../core/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
function toSafeUser(u) {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        roles: (() => {
            const rel = (u.roles ?? []).map((r) => r?.role?.name).filter(Boolean);
            if (rel.length)
                return rel;
            return u?.role ? [String(u.role).toUpperCase()] : [];
        })(),
    };
}
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const user = await db_1.prisma.user.create({
            data: { name, email, passwordHash },
        });
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error al registrar usuario' });
    }
};
exports.registerUser = registerUser;
async function listUsers(_req, res) {
    const users = await db_1.prisma.user.findMany({
        include: { roles: { include: { role: true } } },
        orderBy: { id: 'asc' },
    });
    res.json(users.map(u => ({
        id: u.id, name: u.name, email: u.email, status: u.status,
        roles: u.roles.map(r => r.role.name),
        createdAt: u.createdAt,
    })));
}
async function setUserRoles(req, res) {
    const id = Number(req.params.id);
    const roles = req.body.roles || [];
    const all = await db_1.prisma.role.findMany({ where: { name: { in: roles } } });
    await db_1.prisma.$transaction([
        db_1.prisma.userRole.deleteMany({ where: { userId: id } }),
        db_1.prisma.userRole.createMany({ data: all.map(r => ({ userId: id, roleId: r.id })) }),
    ]);
    res.json({ ok: true });
}
async function setUserStatus(req, res) {
    const id = Number(req.params.id);
    const { status } = req.body; // ACTIVO | BLOQUEADO | BAJA
    await db_1.prisma.user.update({ where: { id }, data: { status } });
    res.json({ ok: true });
}
async function createUser(req, res) {
    const { name, email, password, roles = [], status = 'ACTIVO' } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ message: 'Datos incompletos' });
    const exists = await db_1.prisma.user.findUnique({ where: { email } });
    if (exists)
        return res.status(409).json({ message: 'Email en uso' });
    const hash = await bcrypt_1.default.hash(password, 10);
    const roleRows = roles?.length
        ? await db_1.prisma.role.findMany({ where: { name: { in: roles } } })
        : [];
    const createData = {
        name,
        email,
        passwordHash: hash,
        status: status,
    };
    if (roleRows.length) {
        createData.roles = { createMany: { data: roleRows.map(r => ({ roleId: r.id })), skipDuplicates: true } };
    }
    // columna legacy para compat: guarda primer rol si existe
    createData.role = roleRows[0]?.name ?? createData.role;
    const created = await db_1.prisma.user.create({ data: createData, include: { roles: { include: { role: true } } } });
    res.status(201).json(toSafeUser(created));
}
async function updateUser(req, res) {
    const id = Number(req.params.id);
    const { name, email, status, roles } = req.body;
    const data = {};
    if (typeof name === 'string')
        data.name = name;
    if (typeof email === 'string')
        data.email = email;
    if (typeof status === 'string')
        data.status = status;
    // Si vienen roles, reemplaza vínculos
    if (Array.isArray(roles)) {
        const roleRows = roles.length ? await db_1.prisma.role.findMany({ where: { name: { in: roles } } }) : [];
        const updated = await db_1.prisma.user.update({
            where: { id },
            data: {
                ...data,
                // columna legacy: reflejar primer rol
                role: roleRows[0]?.name,
                roles: {
                    deleteMany: {},
                    ...(roleRows.length ? { createMany: { data: roleRows.map(r => ({ roleId: r.id })), skipDuplicates: true } } : {}),
                },
            },
            include: { roles: { include: { role: true } } },
        });
        return res.json(toSafeUser(updated));
    }
    const user = await db_1.prisma.user.update({ where: { id }, data, include: { roles: { include: { role: true } } } });
    res.json(toSafeUser(user));
}
async function changePassword(req, res) {
    const id = Number(req.params.id);
    const { password } = req.body;
    if (!password)
        return res.status(400).json({ message: 'Password requerido' });
    const hash = await bcrypt_1.default.hash(password, 10);
    await db_1.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    res.json({ ok: true });
}
async function deleteUser(req, res) {
    const id = Number(req.params.id);
    await db_1.prisma.$transaction([
        db_1.prisma.userRole.deleteMany({ where: { userId: id } }),
        db_1.prisma.user.delete({ where: { id } }),
    ]);
    res.json({ ok: true });
}
async function getUserById(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: 'ID inválido' });
    const u = await db_1.prisma.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
    });
    if (!u)
        return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        roles: (u.roles || []).map((r) => r.role.name),
        createdAt: u.createdAt,
    });
}
//# sourceMappingURL=user.controller.js.map