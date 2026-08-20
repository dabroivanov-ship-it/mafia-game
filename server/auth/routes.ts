import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  findUserByUsername,
  findUserByEmail,
  createUser,
  publicUser,
  isUserBanned,
  isAdminReservedUsername,
  findUserById,
  resolveInvitedByUserId,
} from './db.js';
import { sendWelcomeLetter } from '../messages/welcome.js';
import { isValidRegistrationGender, normalizeGender } from './gender.js';
import { signToken, authMiddleware, verifyToken } from './jwt.js';
import {
  verifyTelegramWebAppInitData,
  parseTelegramWebAppUser,
  getTelegramAuthDate,
  getOrCreateUserFromTelegram,
} from './telegram.js';
import { isTelegramOidcConfigured, verifyTelegramOidcIdToken, createTelegramOidcAuthorizationUrl, completeTelegramOidcAuthorization, buildTelegramOidcSuccessRedirect, buildTelegramOidcErrorRedirect } from './telegramOidc.js';
import {
  isVkAuthConfigured,
  createVkAuthorizationUrl,
  completeVkAuthorization,
  completeVkUsernameSetup,
  buildVkSuccessRedirect,
  buildVkUsernameRedirect,
  buildVkErrorRedirect,
} from './vk.js';
import { createRateLimitMiddleware, authRateLimiter } from '../security/rateLimit.js';
import { MAX_PASSWORD_LENGTH } from '../security/constants.js';
import { recordSiteVisit } from '../stats/siteStats.js';
import { consumeOauthLoginTicket } from './oauthTicket.js';

const router = Router();
const authRateLimit = createRateLimitMiddleware(authRateLimiter);

router.post('/register', authRateLimit, async (req, res) => {
  try {
    const { username, email, password, displayName, gender, invitedByUserId } = req.body;

    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }
    if (!isValidRegistrationGender(gender)) {
      return res.status(400).json({ error: 'Укажите пол' });
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

    const invitedBy = resolveInvitedByUserId(invitedByUserId);
    if (!invitedBy.ok) return res.status(400).json({ error: invitedBy.error });

    const passwordHash = await bcrypt.hash(password, 10);
    const name = (displayName?.trim() || u).slice(0, 20);

    const user = createUser({
      username: u,
      email: e,
      passwordHash,
      displayName: name,
      gender: normalizeGender(gender),
      invitedByUserId: invitedBy.id,
    });
    if (!user) return res.status(500).json({ error: 'Ошибка регистрации' });
    sendWelcomeLetter(user);
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

router.post('/oauth/complete', authRateLimit, (req, res) => {
  const ticket = String(req.body?.ticket || '').trim();
  if (!ticket) {
    return res.status(400).json({ error: 'Нет кода входа' });
  }
  const token = consumeOauthLoginTicket(ticket);
  if (!token) {
    return res.status(401).json({ error: 'Код входа истёк, войдите снова' });
  }
  try {
    const payload = verifyToken(token);
    const user = findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    if (isUserBanned(user)) {
      return res.status(403).json({ error: `Аккаунт заблокирован: ${user.ban_reason || ''}` });
    }
    res.json({ token, user: publicUser(user) });
  } catch {
    res.status(401).json({ error: 'Сессия недействительна' });
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
    res.redirect(buildTelegramOidcSuccessRedirect(token, req));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка Telegram входа';
    res.redirect(buildTelegramOidcErrorRedirect(message, req));
  }
});

router.get('/vk/start', (req, res) => {
  if (!isVkAuthConfigured()) {
    return res.redirect(buildVkErrorRedirect('Вход через VK не настроен на сервере', req));
  }
  const remember = req.query.remember !== '0';
  const url = createVkAuthorizationUrl(remember, req);
  res.redirect(url);
});

router.get('/vk/callback', async (req, res) => {
  try {
    const result = await completeVkAuthorization(req);
    if (result.status === 'need_username') {
      return res.redirect(
        buildVkUsernameRedirect(
          {
            setupToken: result.setupToken,
            suggestedUsername: result.suggestedUsername,
            displayName: result.displayName,
            takenUsername: result.takenUsername,
          },
          req
        )
      );
    }
    const token = signToken(result.user, result.remember);
    res.redirect(buildVkSuccessRedirect(token, req));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка VK входа';
    res.redirect(buildVkErrorRedirect(message, req));
  }
});

router.post('/vk/complete', authRateLimit, async (req, res) => {
  try {
    const setupToken = String(req.body?.setupToken || '').trim();
    const username = String(req.body?.username || '').trim();
    if (!setupToken || !username) {
      return res.status(400).json({ error: 'Укажите логин' });
    }
    const { user, remember } = await completeVkUsernameSetup(setupToken, username);
    const token = signToken(user, remember);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка регистрации через VK';
    const status =
      message.includes('занят') || message.includes('зарезервирован') || message.includes('Логин')
        ? 409
        : message.includes('истекла')
          ? 401
          : 400;
    res.status(status).json({ error: message });
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
