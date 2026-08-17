import { Router } from 'express';
import { authMiddleware, adminMiddleware, panelMiddleware } from '../auth/jwt.js';
import { hasAdminPermission } from '../admin/permissions.js';
import {
  getDefaultTheme,
  getSiteBranding,
  getLobbyAnnouncement,
  getTelegramSettings,
  getVkSettings,
  getYandexMetrikaId,
  setDefaultTheme,
  setSiteBrandingFields,
  setSiteLogoUrl,
  setLobbyAnnouncement,
  setTelegramSettings,
  setYandexMetrikaId,
  isValidYandexMetrikaId,
} from './store.js';
import { isValidThemeId, listThemesPublic } from './themes.js';
import { isValidWebAppUrl } from '../security/validate.js';
import { siteLogoPublicPath, siteLogoUpload } from '../upload/siteLogo.js';
import {
  getDeepSeekSettings,
  setDeepSeekSettings,
} from './deepseekStore.js';
import { testDeepSeekConnection } from '../game/ai/deepseekClient.js';

const router = Router();

router.get('/theme', (_req, res) => {
  res.json({
    defaultTheme: getDefaultTheme(),
    themes: listThemesPublic(),
    branding: getSiteBranding(),
    lobbyAnnouncement: getLobbyAnnouncement(),
  });
});

router.put('/theme', authMiddleware, adminMiddleware, (req, res) => {
  const theme = req.body?.theme;
  if (!isValidThemeId(theme)) {
    return res.status(400).json({ error: 'Недопустимая тема' });
  }
  setDefaultTheme(theme);
  res.json({ defaultTheme: theme });
});

router.get('/telegram', (_req, res) => {
  res.json(getTelegramSettings());
});

router.get('/vk', (_req, res) => {
  res.json(getVkSettings());
});

router.put('/telegram', authMiddleware, adminMiddleware, (req, res) => {
  const botUsername = String(req.body?.botUsername || '').trim().replace(/^@/, '');
  const webAppUrl = String(req.body?.webAppUrl || '').trim();
  if (!botUsername || !/^[a-zA-Z0-9_]{5,64}$/.test(botUsername)) {
    return res.status(400).json({ error: 'Укажите корректный username бота Telegram' });
  }
  if (!webAppUrl || !isValidWebAppUrl(webAppUrl)) {
    return res.status(400).json({ error: 'Укажите корректный URL сайта (http/https)' });
  }
  if (process.env.NODE_ENV === 'production' && !webAppUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'В production URL сайта должен быть https://' });
  }
  setTelegramSettings(botUsername, webAppUrl);
  res.json({ ...getTelegramSettings() });
});

router.get('/metrika', (_req, res) => {
  res.json({ metrikaId: getYandexMetrikaId() });
});

router.put('/metrika', authMiddleware, adminMiddleware, (req, res) => {
  const raw = req.body?.metrikaId;
  if (raw === null || raw === undefined || raw === '') {
    setYandexMetrikaId(null);
    return res.json({ metrikaId: null });
  }
  if (!isValidYandexMetrikaId(raw)) {
    return res.status(400).json({ error: 'Укажите корректный номер счётчика Яндекс.Метрики' });
  }
  const metrikaId = Number(raw);
  setYandexMetrikaId(metrikaId);
  res.json({ metrikaId });
});

router.put('/branding', authMiddleware, adminMiddleware, (req, res) => {
  const logoText = String(req.body?.logoText ?? '').trim().slice(0, 40);
  const logoMark = String(req.body?.logoMark ?? '').trim().slice(0, 8);
  const footerText = String(req.body?.footerText ?? '').trim().slice(0, 500);
  if (!logoText) {
    return res.status(400).json({ error: 'Укажите текст логотипа' });
  }
  const branding = setSiteBrandingFields({ logoText, logoMark, footerText });
  res.json({ branding });
});

router.post('/branding/logo', authMiddleware, adminMiddleware, (req, res) => {
  siteLogoUpload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка загрузки' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл логотипа' });
    }
    const branding = setSiteLogoUrl(siteLogoPublicPath(req.file.filename));
    res.json({ branding });
  });
});

router.delete('/branding/logo', authMiddleware, adminMiddleware, (_req, res) => {
  res.json({ branding: setSiteLogoUrl(null) });
});

router.put('/lobby-announcement', authMiddleware, (req, res) => {
  if (!hasAdminPermission(req.user, 'manage_news')) {
    return res.status(403).json({ error: 'Нет прав для редактирования объявлений' });
  }
  const enabled = Boolean(req.body?.enabled);
  const text = String(req.body?.text ?? '').trim();
  if (enabled && !text) {
    return res.status(400).json({ error: 'Укажите текст объявления или отключите показ' });
  }
  const lobbyAnnouncement = setLobbyAnnouncement({ enabled, text });
  res.json({ lobbyAnnouncement });
});

router.get('/deepseek', authMiddleware, panelMiddleware, (req, res) => {
  if (!hasAdminPermission(req.user, 'manage_game_rooms')) {
    return res.status(403).json({ error: 'Нет прав для управления DeepSeek' });
  }
  res.json(getDeepSeekSettings());
});

router.put('/deepseek', authMiddleware, panelMiddleware, (req, res) => {
  if (!hasAdminPermission(req.user, 'manage_game_rooms')) {
    return res.status(403).json({ error: 'Нет прав для управления DeepSeek' });
  }
  const enabled = req.body?.enabled;
  const model = req.body?.model;
  const apiKey = req.body?.apiKey;
  const payload: { enabled?: boolean; model?: string; apiKey?: string | null } = {};
  if (enabled !== undefined) payload.enabled = Boolean(enabled);
  if (model !== undefined) payload.model = String(model);
  if (apiKey !== undefined) {
    payload.apiKey = apiKey === '' || apiKey === null ? null : String(apiKey);
  }
  res.json(setDeepSeekSettings(payload));
});

router.post('/deepseek/test', authMiddleware, panelMiddleware, async (req, res) => {
  if (!hasAdminPermission(req.user, 'manage_game_rooms')) {
    return res.status(403).json({ error: 'Нет прав для управления DeepSeek' });
  }
  try {
    await testDeepSeekConnection();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка DeepSeek' });
  }
});

export default router;
