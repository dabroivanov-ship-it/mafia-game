import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import {
  findUserPublic,
  findUserById,
  isAdmin,
  isStaff,
  canBanTarget,
  listStaffUsers,
  listLeaderboard,
  linkTelegramUserEmail,
  updateUserPasswordHash,
  searchPublicUsers,
  updateUserProfile,
  updateUserAvatar,
  deleteAvatarFile,
  CHAT_LIMIT_OPTIONS,
  userNeedsEmailLink,
} from '../auth/db.js';
import { createAvatarUpload } from '../upload/avatar.js';
import { validateImageFile } from '../security/validate.js';
import { createRateLimitMiddleware, searchRateLimiter } from '../security/rateLimit.js';
import { MAX_PASSWORD_LENGTH } from '../security/constants.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { getUserMessageCount } from '../history/store.js';
import { getUserStatistics } from '../stats/store.js';
import { isValidThemeId } from '../settings/themes.js';
import { getUserPresence, getOnlineUserCount, listOnlineUsers } from '../presence.js';
import {
  areFriends,
  canViewerVoteReputation,
  getGamesPlayed,
  getReputation,
  getReputationVote,
  REPUTATION_MIN_GAMES,
} from '../social/store.js';
import type { PublicUser } from '../types/index.js';

interface ProfileRouterOptions {
  onProfileUpdated?: (userId: number, user: PublicUser | null) => void;
}

export function createProfileRouter({ onProfileUpdated }: ProfileRouterOptions = {}) {
  const router = Router();
  const upload = createAvatarUpload((req) => req.userId!);
  const searchRateLimit = createRateLimitMiddleware(searchRateLimiter, (req) =>
    String(req.userId || 'anon')
  );

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

  router.post('/link-email', authMiddleware, async (req, res) => {
    try {
      const email = String(req.body?.email ?? '').trim();
      const password = String(req.body?.password ?? '');
      const confirm = String(req.body?.confirm ?? '');

      if (!email || !password) {
        return res.status(400).json({ error: 'Укажите email и пароль' });
      }
      if (password !== confirm) {
        return res.status(400).json({ error: 'Пароли не совпадают' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль: минимум 8 символов' });
      }
      if (password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: 'Пароль слишком длинный' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = linkTelegramUserEmail(req.userId!, email, passwordHash);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      onProfileUpdated?.(req.userId!, user);
      res.json({ user });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось привязать email' });
    }
  });

  router.post('/change-password', authMiddleware, async (req, res) => {
    try {
      const currentPassword = String(req.body?.currentPassword ?? '');
      const password = String(req.body?.password ?? '');
      const confirm = String(req.body?.confirm ?? '');

      if (!currentPassword || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
      }
      if (password !== confirm) {
        return res.status(400).json({ error: 'Пароли не совпадают' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль: минимум 8 символов' });
      }
      if (password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: 'Пароль слишком длинный' });
      }

      const account = findUserById(req.userId!);
      if (!account) return res.status(404).json({ error: 'Пользователь не найден' });
      if (userNeedsEmailLink(account)) {
        return res.status(400).json({ error: 'Сначала привяжите email и пароль' });
      }

      const ok = await bcrypt.compare(currentPassword, account.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = updateUserPasswordHash(req.userId!, passwordHash);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ user });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось сменить пароль' });
    }
  });

  router.get('/online-count', (_req, res) => {
    res.json({ onlineCount: getOnlineUserCount() });
  });

  router.get('/online-users', authMiddleware, (_req, res) => {
    const users = listOnlineUsers().map((user) => ({
      ...user,
      ...getUserPresence(user.id),
    }));
    res.json({ users, onlineCount: getOnlineUserCount() });
  });

  router.get('/leaderboard', (req, res) => {
    const limit = Number(req.query.limit);
    const offset = Number(req.query.offset);
    const players = listLeaderboard(
      Number.isFinite(limit) ? limit : 100,
      Number.isFinite(offset) ? offset : 0
    );
    res.json({ players });
  });

  router.get('/staff/list', authMiddleware, (_req, res) => {
    res.json({ staff: listStaffUsers() });
  });

  router.get('/search', authMiddleware, searchRateLimit, (req, res) => {
    const q = String(req.query.q || '');
    const users = searchPublicUsers(q).map((user) => ({
      ...user,
      ...getUserPresence(user.id),
    }));
    res.json({ users });
  });

  router.get('/:userId/statistics', (req, res) => {
    const targetId = Number(req.params.userId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Некорректный id пользователя' });
    }
    const target = findUserPublic(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    const statistics = getUserStatistics(targetId);
    if (!statistics) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: target, statistics });
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
      user: {
        ...user,
        messageCount: getUserMessageCount(targetId),
        gamesPlayed: getGamesPlayed(targetId),
        reputation: getReputation(targetId),
      },
      presence: getUserPresence(targetId),
      isSelf,
      isFriend: !isSelf && areFriends(req.userId!, targetId),
      reputationVote: isSelf ? null : getReputationVote(req.userId!, targetId),
      canVoteReputation: canViewerVoteReputation(req.userId!, targetId, viewerIsAdmin),
      reputationMinGames: REPUTATION_MIN_GAMES,
      viewerGamesPlayed: getGamesPlayed(req.userId!),
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
