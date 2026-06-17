import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  findUserByUsername,
  findUserByEmail,
  publicUser,
  isUserBanned,
} from './db.js';
import { signToken, authMiddleware } from './jwt.js';
import {
  type TelegramAuthPayload,
  verifyTelegramWidgetAuth,
  verifyTelegramWebAppInitData,
  parseTelegramWebAppUser,
  getTelegramAuthDate,
  getOrCreateUserFromTelegram,
} from './telegram.js';

const router = Router();

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
    const remember = req.body?.remember !== false;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: 'Telegram вход не настроен на сервере' });
    }

    const initData = String(req.body?.initData || '').trim();
    let user;

    if (initData) {
      if (!verifyTelegramWebAppInitData(initData, botToken)) {
        return res.status(401).json({ error: 'Ошибка проверки Telegram Web App' });
      }
      const authDate = getTelegramAuthDate(initData);
      if (!authDate || Date.now() - authDate > 24 * 60 * 60 * 1000) {
        return res.status(401).json({ error: 'Данные Telegram устарели, попробуйте снова' });
      }
      const tgUser = parseTelegramWebAppUser(initData);
      if (!tgUser) {
        return res.status(400).json({ error: 'Некорректные данные Telegram Web App' });
      }
      user = await getOrCreateUserFromTelegram({
        telegramId: String(tgUser.id),
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
      });
    } else {
      const payload = (req.body?.telegram || req.body) as TelegramAuthPayload;
      if (!payload?.id || !payload?.auth_date || !payload?.hash) {
        return res.status(400).json({ error: 'Некорректные данные Telegram' });
      }
      if (!verifyTelegramWidgetAuth(payload, botToken)) {
        return res.status(401).json({ error: 'Ошибка проверки Telegram авторизации' });
      }

      const authDate = Number(payload.auth_date) * 1000;
      if (!Number.isFinite(authDate) || Date.now() - authDate > 24 * 60 * 60 * 1000) {
        return res.status(401).json({ error: 'Данные Telegram устарели, попробуйте снова' });
      }

      user = await getOrCreateUserFromTelegram({
        telegramId: String(payload.id),
        username: payload.username ? String(payload.username) : null,
        firstName: payload.first_name,
        lastName: payload.last_name,
      });
    }

    if (!user) {
      return res.status(500).json({ error: 'Ошибка регистрации через Telegram' });
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
