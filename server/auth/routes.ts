import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  findUserByUsername,
  findUserByEmail,
  findUserByTelegramId,
  createUser,
  publicUser,
  isUserBanned,
} from './db.js';
import { signToken, authMiddleware } from './jwt.js';

const router = Router();

interface TelegramAuthPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

function verifyTelegramAuth(payload: TelegramAuthPayload, botToken: string): boolean {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'hash') continue;
    if (v == null) continue;
    data[k] = String(v);
  }
  const checkString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const digest = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  return digest === payload.hash;
}

function safeTelegramUsername(input: string | undefined, fallback: string): string {
  const base = (input || fallback).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  return base.length >= 3 ? base : `tg_${fallback}`.slice(0, 20);
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const u = username.trim();
    const e = email.trim().toLowerCase();

    if (u.length < 3 || u.length > 20) {
      return res.status(400).json({ error: 'Логин: от 3 до 20 символов' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      return res.status(400).json({ error: 'Логин: только буквы, цифры и _' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль: минимум 8 символов' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    if (findUserByUsername(u)) return res.status(409).json({ error: 'Логин уже занят' });
    if (findUserByEmail(e)) return res.status(409).json({ error: 'Email уже зарегистрирован' });

    const passwordHash = await bcrypt.hash(password, 10);
    const name = (displayName?.trim() || u).slice(0, 20);

    const user = createUser({ username: u, email: e, passwordHash, displayName: name });
    if (!user) return res.status(500).json({ error: 'Ошибка регистрации' });
    const token = signToken(user, true);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password, remember } = req.body;
    if (!login?.trim() || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const value = login.trim();
    const user = findUserByUsername(value) || findUserByEmail(value.toLowerCase());

    if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });

    if (isUserBanned(user)) {
      return res.status(403).json({ error: `Аккаунт заблокирован: ${user.ban_reason || ''}` });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const token = signToken(user, remember !== false);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

router.post('/telegram', async (req, res) => {
  try {
    const payload = (req.body?.telegram || req.body) as TelegramAuthPayload;
    const remember = req.body?.remember !== false;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: 'Telegram вход не настроен на сервере' });
    }
    if (!payload?.id || !payload?.auth_date || !payload?.hash) {
      return res.status(400).json({ error: 'Некорректные данные Telegram' });
    }
    if (!verifyTelegramAuth(payload, botToken)) {
      return res.status(401).json({ error: 'Ошибка проверки Telegram авторизации' });
    }

    const authDate = Number(payload.auth_date) * 1000;
    if (!Number.isFinite(authDate) || Date.now() - authDate > 24 * 60 * 60 * 1000) {
      return res.status(401).json({ error: 'Данные Telegram устарели, попробуйте снова' });
    }

    const telegramId = String(payload.id);
    let user = findUserByTelegramId(telegramId);
    if (!user) {
      const fallback = String(payload.id).slice(-8);
      const baseUsername = safeTelegramUsername(payload.username, `tg${fallback}`);
      let username = baseUsername;
      let i = 1;
      while (findUserByUsername(username)) {
        username = `${baseUsername.slice(0, Math.max(3, 20 - String(i).length))}${i}`;
        i += 1;
      }

      const baseEmail = `tg_${telegramId}@telegram.local`;
      let email = baseEmail;
      let e = 1;
      while (findUserByEmail(email)) {
        email = `tg_${telegramId}_${e}@telegram.local`;
        e += 1;
      }

      const displayName = `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || username;
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = createUser({
        username,
        email,
        passwordHash,
        displayName: displayName.slice(0, 20),
        telegramId,
        telegramUsername: payload.username ? String(payload.username).slice(0, 32) : null,
      });
      if (!user) return res.status(500).json({ error: 'Ошибка регистрации через Telegram' });
    }

    if (isUserBanned(user)) {
      return res.status(403).json({ error: `Аккаунт заблокирован: ${user.ban_reason || ''}` });
    }

    const token = signToken(user, remember);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('telegram login error:', err);
    res.status(500).json({ error: 'Ошибка Telegram входа' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
