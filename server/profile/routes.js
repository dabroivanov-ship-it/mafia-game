import { Router } from 'express';
import path from 'path';
import { authMiddleware } from '../auth/jwt.js';
import {
  findUserPublic,
  findUserById,
  isAdmin,
  updateUserProfile,
  updateUserAvatar,
  deleteAvatarFile,
} from '../auth/db.js';
import { createAvatarUpload } from '../upload/avatar.js';
import { getUserChatMessages } from '../history/store.js';

const router = Router();
const upload = createAvatarUpload((req) => req.userId);

router.put('/', authMiddleware, (req, res) => {
  const { displayName, city, bio } = req.body;
  if (!displayName?.trim()) {
    return res.status(400).json({ error: 'Укажите имя' });
  }
  const user = updateUserProfile(req.userId, {
    displayName: displayName.trim().slice(0, 30),
    city: (city || '').trim().slice(0, 50),
    bio: (bio || '').trim().slice(0, 500),
  });
  res.json({ user });
});

router.post('/avatar', authMiddleware, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
    if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const { oldAvatar, user } = updateUserAvatar(req.userId, avatarUrl);
    if (oldAvatar) deleteAvatarFile(oldAvatar);
    res.json({ user, avatar: avatarUrl });
  });
});

router.get('/messages', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit) || 15;
  const messages = getUserChatMessages(req.userId, limit);
  res.json({ messages, limit: Math.min(100, Math.max(5, limit)) });
});

router.get('/:userId/messages', authMiddleware, (req, res) => {
  const targetId = Number(req.params.userId);
  const target = findUserPublic(targetId);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  const limit = Number(req.query.limit) || 15;
  const messages = getUserChatMessages(targetId, limit);
  res.json({ messages, limit: Math.min(100, Math.max(5, limit)) });
});

router.get('/:userId', authMiddleware, (req, res) => {
  const targetId = Number(req.params.userId);
  const target = findUserPublic(targetId);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  const viewer = findUserById(req.userId);
  const viewerIsAdmin = isAdmin(viewer);
  const isSelf = req.userId === targetId;

  const user = { ...target };
  if (!viewerIsAdmin && !isSelf) {
    delete user.email;
    delete user.banReason;
  }

  res.json({
    user,
    isSelf,
    canAdmin: viewerIsAdmin && !target.isAdmin && !isSelf,
  });
});

export default router;
