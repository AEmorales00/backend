import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './config';

// Extender Request para incluir user (evitar dependencias de tipos extra)
type AuthedRequest = Request & { user?: { id: number; role?: string } };

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Error interno' });
}

export function authenticateJWT(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return res.status(401).json({ message: 'No autenticado' });
    const payload = jwt.verify(token, env.jwtSecret) as any;
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

// Rate limit simple en memoria por usuario
const rateBuckets = new Map<number, number[]>();
export function rateLimitPerUser(maxPerWindow = 30, windowMs = 60_000) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
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
export function authenticate(req: any, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const payload: any = jwt.verify(token, env.jwtSecret);
    if (payload.status && payload.status !== 'ACTIVO') {
      return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
    }
    req.user = payload;
    next();
  } catch (_e) {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

export function requireRoles(...allowed: Array<'ADMIN'|'JEFE'|'BODEGUERO'|'VENDEDOR'>) {
  return (req: any, res: Response, next: NextFunction) => {
    const roles: string[] = req.user?.roles ?? [];
    const ok = roles.some(r => allowed.includes(r as any));
    if (!ok) return res.status(403).json({ message: 'Sin permisos' });
    next();
  };
}
