import { Request, Response } from 'express';
import { prisma } from '../../core/db';
import bcrypt from 'bcrypt';
import type { RoleName, UserStatus } from '@prisma/client';

function toSafeUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    status: (u as any).status,
    roles: (() => {
      const rel = (u.roles ?? []).map((r: any) => r?.role?.name).filter(Boolean)
      if (rel.length) return rel
      return u?.role ? [String(u.role).toUpperCase()] : []
    })(),
  };
}

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    include: { roles: { include: { role: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(users.map(u => ({
    id: u.id, name: u.name, email: u.email, status: u.status,
    roles: u.roles.map(r => (r as any).role.name),
    createdAt: (u as any).createdAt,
  })))
}

export async function setUserRoles(req: Request, res: Response) {
  const id = Number(req.params.id)
  const roles: RoleName[] = (req.body as any).roles || []
  const all = await prisma.role.findMany({ where: { name: { in: roles as any } } })

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: id } }),
    prisma.userRole.createMany({ data: all.map(r => ({ userId: id, roleId: r.id })) }),
  ])
  res.json({ ok: true })
}

export async function setUserStatus(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { status } = req.body as any // ACTIVO | BLOQUEADO | BAJA
  await prisma.user.update({ where: { id }, data: { status } })
  res.json({ ok: true })
}

export async function createUser(req: Request, res: Response) {
  const { name, email, password, roles = [], status = 'ACTIVO' } = req.body as {
    name: string; email: string; password: string; roles: RoleName[]; status: UserStatus | 'ACTIVO' | 'BLOQUEADO' | 'BAJA';
  };
  if (!name || !email || !password) return res.status(400).json({ message: 'Datos incompletos' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email en uso' });

  const hash = await bcrypt.hash(password, 10);
  const roleRows = (roles as any)?.length
    ? await prisma.role.findMany({ where: { name: { in: roles as any } } })
    : []

  const createData: any = {
    name,
    email,
    passwordHash: hash,
    status: status as any,
  }
  if (roleRows.length) {
    createData.roles = { createMany: { data: roleRows.map(r => ({ roleId: r.id })), skipDuplicates: true } }
  }
  // columna legacy para compat: guarda primer rol si existe
  (createData as any).role = roleRows[0]?.name ?? (createData as any).role
  const created = await prisma.user.create({ data: createData, include: { roles: { include: { role: true } } } })

  res.status(201).json(toSafeUser(created));
}

export async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { name, email, status, roles } = req.body as { name?: string; email?: string; status?: UserStatus | string; roles?: RoleName[] };
  const data: any = {};
  if (typeof name === 'string') data.name = name;
  if (typeof email === 'string') data.email = email;
  if (typeof status === 'string') data.status = status as any;

  // Si vienen roles, reemplaza vínculos
  if (Array.isArray(roles)) {
    const roleRows = roles.length ? await prisma.role.findMany({ where: { name: { in: roles as any } } }) : []
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        // columna legacy: reflejar primer rol
        role: roleRows[0]?.name as any,
        roles: {
          deleteMany: {},
          ...(roleRows.length ? { createMany: { data: roleRows.map(r => ({ roleId: r.id })), skipDuplicates: true } } : {}),
        },
      },
      include: { roles: { include: { role: true } } },
    })
    return res.json(toSafeUser(updated))
  }

  const user = await prisma.user.update({ where: { id }, data, include: { roles: { include: { role: true } } } });
  res.json(toSafeUser(user));
}

export async function changePassword(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { password } = req.body as { password: string };
  if (!password) return res.status(400).json({ message: 'Password requerido' });
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  res.json({ ok: true });
}

export async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
  res.json({ ok: true });
}

export async function getUserById(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });
  const u: any = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  } as any);
  if (!u) return res.status(404).json({ message: 'Usuario no encontrado' });
  return res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    status: (u as any).status,
    roles: (u.roles || []).map((r: any) => r.role.name as RoleName),
    createdAt: (u as any).createdAt,
  });
}
