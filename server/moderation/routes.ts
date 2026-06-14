import { Router } from 'express';
import { authMiddleware, staffMiddleware } from '../auth/jwt.js';
import { findUserById, findUserPublic, banUser, clearBan, canBanTarget } from '../auth/db.js';

export function createModerationRouter() {
  const router = Router();
  router.use(authMiddleware, staffMiddleware);

  router.post('/ban', (req, res) => {
    const { userId, reason, hours } = req.body;
    const targetId = Number(userId);
    const target = findUserById(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!canBanTarget(req.user, target)) {
      return res.status(403).json({ error: 'Нельзя забанить этого пользователя' });
    }

    let until: string | null = null;
    if (hours && Number(hours) > 0) {
      until = new Date(Date.now() + Number(hours) * 3600000).toISOString();
    }
    const user = banUser(targetId, reason, until);
    res.json({ user });
  });

  router.post('/unban', (req, res) => {
    const targetId = Number(req.body.userId);
    const target = findUserPublic(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!canBanTarget(req.user, findUserById(targetId))) {
      return res.status(403).json({ error: 'Нет прав для разбана' });
    }
    const user = clearBan(targetId);
    res.json({ user });
  });

  return router;
}
