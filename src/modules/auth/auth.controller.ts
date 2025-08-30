import { prisma } from '../../core/db';
import { env } from '../../core/config';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response, Router } from 'express';


function signAccess(userId: number, role: string): string {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, { expiresIn: env.jwtExpires } as any);
}

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email ya registrado' });
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  res.status(201).json({ id: user.id, email: user.email });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

  const access = signAccess(user.id, user.role);
  res.json({ accessToken: access });
}

