import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth/jwt.js';
import { getDefaultTheme, getTelegramSettings, setDefaultTheme, setTelegramSettings } from './store.js';
import { isValidThemeId, listThemesPublic } from './themes.js';

const router = Router();

router.get('/theme', (_req, res) => {
  res.json({
    defaultTheme: getDefaultTheme(),
    themes: listThemesPublic(),
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

router.put('/telegram', authMiddleware, adminMiddleware, (req, res) => {
  const botUsername = String(req.body?.botUsername || '').trim().replace(/^@/, '');
  const webAppUrl = String(req.body?.webAppUrl || '').trim();
  if (!botUsername || !/^[a-zA-Z0-9_]{5,64}$/.test(botUsername)) {
    return res.status(400).json({ error: 'Укажите корректный username бота Telegram' });
  }
  if (!webAppUrl || !/^https?:\/\//i.test(webAppUrl)) {
    return res.status(400).json({ error: 'Укажите корректный URL сайта (http/https)' });
  }
  setTelegramSettings(botUsername, webAppUrl);
  res.json({ botUsername, webAppUrl });
});

export default router;
