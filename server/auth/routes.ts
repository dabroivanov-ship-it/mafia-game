import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  findUserByUsername,
  findUserByEmail,
  createUser,
  publicUser,
  isUserBanned,
  isAdminReservedUsername,
} from './db.js';
import { signToken, authMiddleware } from './jwt.js';
import {
  verifyTelegramWebAppInitData,
  parseTelegramWebAppUser,
  getTelegramAuthDate,
  getOrCreateUserFromTelegram,
} from './telegram.js';
import { isTelegramOidcConfigured, verifyTelegramOidcIdToken, createTelegramOidcAuthorizationUrl, completeTelegramOidcAuthorization, buildTelegramOidcSuccessRedirect, buildTelegramOidcErrorRedirect } from './telegramOidc.js';
import { createRateLimitMiddleware, authRateLimiter } from '../security/rateLimit.js';
import { MAX_PASSWORD_LENGTH } from '../security/constants.js';
import { recordSiteVisit } from '../stats/siteStats.js';

const router = Router();
const authRateLimit = createRateLimitMiddleware(authRateLimiter);

router.post('/register', authRateLimit, async (req, res) => {
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
    if (isAdminReservedUsername(u)) {
      return res.status(400).json({ error: 'Этот логин зарезервирован' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль: минимум 8 символов' });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Пароль слишком длинный' });
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
    const token = signToken(user, false);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', authRateLimit, async (req, res) => {
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

router.get('/telegram/oidc/start', (req, res) => {
  if (!isTelegramOidcConfigured()) {
    return res.redirect(buildTelegramOidcErrorRedirect('Telegram OIDC не настроен на сервере', req));
  }
  const remember = req.query.remember !== '0';
  const url = createTelegramOidcAuthorizationUrl(remember, req);
  res.redirect(url);
});

router.get('/telegram/oidc/callback', async (req, res) => {
  try {
    const oauthError = String(req.query.error_description || req.query.error || '').trim();
    if (oauthError) {
      return res.redirect(buildTelegramOidcErrorRedirect(oauthError, req));
    }

    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    if (!code || !state) {
      return res.redirect(buildTelegramOidcErrorRedirect('Некорректный ответ Telegram OIDC', req));
    }

    const { user, remember } = await completeTelegramOidcAuthorization(code, state, req);
    const token = signToken(user, remember);
    void publicUser(user);
    res.redirect(buildTelegramOidcSuccessRedirect(token, req));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка Telegram входа';
    res.redirect(buildTelegramOidcErrorRedirect(message, req));
  }
});

router.post('/telegram', authRateLimit, async (req, res) => {
  try {
    const remember = req.body?.remember !== false;
    const initData = String(req.body?.initData || '').trim();
    const idToken = String(req.body?.id_token || req.body?.idToken || '').trim();
    let user;

    if (initData) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(400).json({ error: 'Telegram Web App не настроен на сервере' });
      }
      if (!verifyTelegramWebAppInitData(initData, botToken)) {
        return res.status(401).json({ error: 'Ошибка проверки Telegram Web App' });
      }
      const authDate = getTelegramAuthDate(initData);
      if (!authDate || Date.now() - authDate > 60 * 60 * 1000) {
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
    } else if (idToken) {
      if (!isTelegramOidcConfigured()) {
        return res.status(400).json({ error: 'Telegram OIDC не настроен на сервере' });
      }
      const claims = await verifyTelegramOidcIdToken(idToken);
      user = await getOrCreateUserFromTelegram({
        telegramId: claims.telegramId,
        username: claims.username,
        firstName: claims.firstName,
        lastName: claims.lastName,
      });
    } else {
      return res.status(400).json({ error: 'Некорректные данные Telegram' });
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
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }
  try {
    recordSiteVisit(user.id);
  } catch (e) {
    console.error('recordSiteVisit error:', e);
  }
  res.json({ user: publicUser(user) });
});

export default router;
