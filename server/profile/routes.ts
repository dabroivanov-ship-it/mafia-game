import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import {
  findUserPublic,
  findUserById,
  isAdmin,
  isStaff,
  canBanTarget,
  listStaffUsers,
  updateUserProfile,
  updateUserAvatar,
  deleteAvatarFile,
  CHAT_LIMIT_OPTIONS,
} from '../auth/db.js';
import { createAvatarUpload } from '../upload/avatar.js';
import { validateImageFile } from '../security/validate.js';
import fs from 'fs';
import { getUserMessageCount } from '../history/store.js';
import { isValidThemeId } from '../settings/themes.js';
import type { PublicUser } from '../types/index.js';

interface ProfileRouterOptions {
  onProfileUpdated?: (userId: number, user: PublicUser | null) => void;
}

export function createProfileRouter({ onProfileUpdated }: ProfileRouterOptions = {}) {
  const router = Router();
  const upload = createAvatarUpload((req) => req.userId!);

  router.put('/', authMiddleware, (req, res) => {
    const { displayName, city, bio, chatLimit, theme } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ error: 'Укажите имя' });
    }
    if (chatLimit != null && !(CHAT_LIMIT_OPTIONS as readonly number[]).includes(Number(chatLimit))) {
      return res.status(400).json({ error: 'Недопустимое число сообщений в чате' });
    }
    if (theme !== undefined && theme !== null && theme !== '' && !isValidThemeId(theme)) {
      return res.status(400).json({ error: 'Недопустимая тема' });
    }
    const user = updateUserProfile(req.userId!, {
      displayName: displayName.trim().slice(0, 30),
      city: (city || '').trim().slice(0, 50),
      bio: (bio || '').trim().slice(0, 500),
      chatLimit: chatLimit != null ? Number(chatLimit) : undefined,
      theme:
        theme === undefined
          ? undefined
          : theme === null || theme === ''
            ? null
            : String(theme),
    });
    onProfileUpdated?.(req.userId!, user);
    res.json({ user, chatLimitOptions: CHAT_LIMIT_OPTIONS });
  });

  router.post('/avatar', authMiddleware, (req, res) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
      if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
      if (!validateImageFile(req.file.path, req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Файл не является допустимым изображением' });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const { oldAvatar, user } = updateUserAvatar(req.userId!, avatarUrl);
      if (oldAvatar) deleteAvatarFile(oldAvatar);
      res.json({ user, avatar: avatarUrl });
    });
  });

  router.get('/staff/list', authMiddleware, (_req, res) => {
    res.json({ staff: listStaffUsers() });
  });

  router.get('/:userId', authMiddleware, (req, res) => {
    const targetId = Number(req.params.userId);
    const target = findUserPublic(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    const viewer = findUserById(req.userId!);
    const viewerIsAdmin = isAdmin(viewer);
    const viewerIsStaff = isStaff(viewer);
    const isSelf = req.userId === targetId;
    const targetUser = findUserById(targetId);

    const user: PublicUser & { messageCount?: number } = { ...target };
    if (!viewerIsAdmin && !isSelf) {
      delete user.email;
      delete user.banReason;
    }

    res.json({
      user: { ...user, messageCount: getUserMessageCount(targetId) },
      isSelf,
      canAdmin: viewerIsAdmin && !target.isAdmin && !isSelf,
      canModerate: canBanTarget(viewer, targetUser) && !isSelf,
      staffMeta:
        viewerIsStaff && !isSelf
          ? {
              lastIp: targetUser?.last_ip || null,
              lastUserAgent: targetUser?.last_user_agent || null,
            }
          : undefined,
    });
  });

  return router;
}

export default createProfileRouter;
