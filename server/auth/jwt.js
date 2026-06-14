import jwt from 'jsonwebtoken';
import { findUserById, isUserBanned, isAdmin } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mafia-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    const user = findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    if (isUserBanned(user)) {
      return res.status(403).json({ error: `Аккаунт заблокирован: ${user.ban_reason || ''}` });
    }
    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

export function adminMiddleware(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Доступ только для администратора' });
  }
  next();
}

export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Требуется авторизация'));
  try {
    const payload = verifyToken(token);
    const user = findUserById(payload.sub);
    if (!user) return next(new Error('Пользователь не найден'));
    if (isUserBanned(user)) {
      return next(new Error(`Аккаунт заблокирован: ${user.ban_reason || ''}`));
    }
    socket.userId = user.id;
    socket.userRole = user.role;
    socket.isAdmin = isAdmin(user);
    next();
  } catch {
    next(new Error('Недействительный токен'));
  }
}
