import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth/jwt.js';
import { getDefaultTheme, setDefaultTheme } from './store.js';
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

export default router;
