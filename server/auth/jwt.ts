import jwt, { type SignOptions } from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { Socket } from 'socket.io';
import { findUserById, isUserBanned, isAdmin, isModerator, isStaff } from './db.js';
import type { User } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mafia-dev-secret-change-in-production';
const JWT_EXPIRES: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES || '7d') as SignOptions['expiresIn'];

interface AppJwtPayload {
  sub: number;
  username: string;
  role: string;
}

export function signToken(user: User): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token: string): AppJwtPayload {
  const payload = jwt.verify(token, JWT_SECRET);
  if (typeof payload === 'string' || payload.sub == null) {
    throw new Error('Invalid token');
  }
  return {
    sub: Number(payload.sub),
    username: String(payload.username ?? ''),
    role: String(payload.role ?? 'user'),
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    const user = findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }
    if (isUserBanned(user)) {
      res.status(403).json({ error: `Аккаунт заблокирован: ${user.ban_reason || ''}` });
      return;
    }
    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isAdmin(req.user)) {
    res.status(403).json({ error: 'Доступ только для администратора' });
    return;
  }
  next();
}

export function staffMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isStaff(req.user)) {
    res.status(403).json({ error: 'Нет прав модератора' });
    return;
  }
  next();
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Требуется авторизация'));
    return;
  }
  try {
    const payload = verifyToken(token);
    const user = findUserById(payload.sub);
    if (!user) {
      next(new Error('Пользователь не найден'));
      return;
    }
    if (isUserBanned(user)) {
      next(new Error(`Аккаунт заблокирован: ${user.ban_reason || ''}`));
      return;
    }
    socket.userId = user.id;
    socket.userRole = user.role;
    socket.isAdmin = isAdmin(user);
    socket.isModerator = isModerator(user);
    socket.isStaff = isStaff(user);
    next();
  } catch {
    next(new Error('Недействительный токен'));
  }
}
