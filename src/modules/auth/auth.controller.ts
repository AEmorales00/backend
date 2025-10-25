import { prisma } from '../../core/db';
import { env } from '../../core/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { authenticate } from '../../core/middlewares';


function signAccess(payload: any): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' } as any);
}

function toSafeUser(u: any) {
  const rel = (u?.roles ?? []).map((r: any) => r?.role?.name).filter(Boolean)
  const col = u?.role ? [String(u.role).toUpperCase()] : []
  const roles = rel.length ? rel : col
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    status: (u as any).status ?? 'ACTIVO',
    roles,
  };
}

export async function register(req: Request, res: Response) {
  const name = String((req.body as any)?.name ?? '')
  const email = String((req.body as any)?.email ?? '').trim().toLowerCase()
  const password = String((req.body as any)?.password ?? '')
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email ya registrado' });
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  res.status(201).json({ id: user.id, email: user.email });
}

export async function login(req: Request, res: Response) {
  const emailRaw = String((req.body as any)?.email ?? '')
  const password = String((req.body as any)?.password ?? '')
  const email = emailRaw.trim().toLowerCase()
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' })
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  } as any);
  if (!user) {
    console.warn('[auth.login] user not found', { email })
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    console.warn('[auth.login] bad password', { userId: user.id })
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }
  const safe = toSafeUser(user)
  const outRoles = safe.roles
  const status = safe.status
  const jwtPayload = {
    sub: safe.id,
    name: safe.name,
    email: safe.email,
    roles: outRoles,
    status,
  } as any
  const userOut = safe

  const token = signAccess(jwtPayload)
  res.json({ token, user: userOut })
}

// Obtener usuario desde token y rehidratar roles de DB
export const me = [
  authenticate as any,
  async (req: any, res: Response) => {
    const uid = Number(req.user?.sub)
    if (!uid) return res.status(401).json({ message: 'No autenticado' })
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: { roles: { include: { role: true } } },
    } as any)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
    const safe = toSafeUser(user)
    return res.json(safe)
  }
] as any
