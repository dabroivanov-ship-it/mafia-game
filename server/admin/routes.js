import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth/jwt.js';
import {
  listAllUsers,
  banUser,
  clearBan,
  deleteUser,
  findUserPublic,
  updateUserProfile,
  updateUserAvatar,
  removeUserAvatar,
  deleteAvatarFile,
} from '../auth/db.js';
import { createAvatarUpload } from '../upload/avatar.js';

export function createAdminRouter(handlers) {
  const router = Router();
  const avatarUpload = createAvatarUpload((req) => req.params.userId || 'admin');

  router.use(authMiddleware, adminMiddleware);

  router.get('/users', (_req, res) => {
    res.json({ users: listAllUsers() });
  });

  router.get('/overview', (_req, res) => {
    res.json({
      ...handlers.getModerationData(),
      users: listAllUsers(),
      gameEvents: handlers.getGameEvents?.() || [],
    });
  });

  router.get('/rooms/:roomId/history', (req, res) => {
    const roomId = Number(req.params.roomId);
    res.json({
      chat: handlers.getChatHistory?.(roomId) || [],
      gameEvents: handlers.getRoomGameEvents?.(roomId) || [],
    });
  });

  /* --- Комнаты --- */
  router.put('/rooms/:roomId', (req, res) => {
    try {
      const roomId = Number(req.params.roomId);
      const room = handlers.renameRoom(roomId, req.body.name);
      handlers.onRoomsChanged(roomId);
      res.json({ room: { id: room.id, name: room.name } });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/rooms', (req, res) => {
    try {
      const room = handlers.addRoom(req.body.name);
      handlers.onRoomsChanged(room.id);
      res.status(201).json({ room: { id: room.id, name: room.name } });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete('/rooms/:roomId', (req, res) => {
    try {
      handlers.deleteRoom(Number(req.params.roomId));
      handlers.onRoomsChanged();
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /* --- Пользователи: профиль --- */
  router.put('/users/:userId', (req, res) => {
    const id = Number(req.params.userId);
    const target = findUserPublic(id);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    const { displayName, city, bio } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ error: 'Укажите имя' });
    }

    const user = updateUserProfile(id, {
      displayName: displayName.trim().slice(0, 30),
      city: (city || '').trim().slice(0, 50),
      bio: (bio || '').trim().slice(0, 500),
    });
    handlers.syncUserInRooms?.(id, user.displayName);
    res.json({ user });
  });

  router.post('/users/:userId/avatar', (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });

    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
      if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const { oldAvatar, user } = updateUserAvatar(id, avatarUrl);
      if (oldAvatar) deleteAvatarFile(oldAvatar);
      res.json({ user, avatar: avatarUrl });
    });
  });

  router.delete('/users/:userId/avatar', (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });
    const user = removeUserAvatar(id);
    res.json({ user });
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
    const ok = handlers.deleteMessage(Number(roomId), messageId, channel || 'public');
    if (!ok) return res.status(404).json({ error: 'Сообщение не найдено' });
    res.json({ ok: true });
  });

  return router;
}
