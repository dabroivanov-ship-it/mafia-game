import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth/jwt.js';
import {
  listAllUsers,
  banUser,
  clearBan,
  deleteUser,
  findUserPublic,
} from '../auth/db.js';

export function createAdminRouter(getModerationData, deleteMessageHandler) {
  const router = Router();

  router.use(authMiddleware, adminMiddleware);

  router.get('/users', (_req, res) => {
    res.json({ users: listAllUsers() });
  });

  router.get('/overview', (_req, res) => {
    res.json({
      ...getModerationData(),
      users: listAllUsers(),
    });
  });

  router.post('/ban', (req, res) => {
    const { userId, reason, hours } = req.body;
    const target = findUserPublic(Number(userId));
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.isAdmin) return res.status(403).json({ error: 'Нельзя забанить администратора' });

    let until = null;
    if (hours && Number(hours) > 0) {
      until = new Date(Date.now() + Number(hours) * 3600000).toISOString();
    }
    const user = banUser(Number(userId), reason, until);
    res.json({ user });
  });

  router.post('/unban', (req, res) => {
    const { userId } = req.body;
    const user = clearBan(Number(userId));
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user });
  });

  router.delete('/users/:userId', (req, res) => {
    const id = Number(req.params.userId);
    const target = findUserPublic(id);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.isAdmin) return res.status(403).json({ error: 'Нельзя удалить администратора' });
    deleteUser(id);
    res.json({ ok: true });
  });

  router.delete('/messages', (req, res) => {
    const { roomId, messageId, channel } = req.body;
    const ok = deleteMessageHandler(Number(roomId), messageId, channel || 'public');
    if (!ok) return res.status(404).json({ error: 'Сообщение не найдено' });
    res.json({ ok: true });
  });

  return router;
}
