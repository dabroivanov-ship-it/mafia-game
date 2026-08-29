import { Router } from 'express';
import { authMiddleware, panelMiddleware } from '../auth/jwt.js';
import {
  listAllUsers,
  banUser,
  clearBan,
  deleteUser,
  findUserPublic,
  findUserById,
  updateUserProfile,
  updateUserUsername,
  updateUserAvatar,
  removeUserAvatar,
  deleteAvatarFile,
  updateUserRole,
  canBanTarget,
  type AssignableRole,
} from '../auth/db.js';
import { normalizeGender } from '../auth/gender.js';
import { createAvatarUpload } from '../upload/avatar.js';
import { validateImageFile, normalizeModerationReason } from '../security/validate.js';
import fs from 'fs';
import type { GameEvent } from '../history/store.js';
import type { ChatMessage, GameRoom, LobbyRoom } from '../types/index.js';
import {
  createNews,
  updateNews,
  deleteNews,
  listAllNews,
  findNewsById,
} from '../news/store.js';
import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  listAllBlog,
  findBlogById,
} from '../blog/store.js';
import { upsertPollForNews, type PollInput } from '../news/polls.js';
import { listViolations, clearViolations } from '../moderation/violationLog.js';
import { addUserSanction, liftUserSanctions } from '../moderation/sanctionLog.js';
import { newsImageUpload, newsImagePublicPath } from '../upload/newsImage.js';
import { adminSetReputation, getReputation } from '../social/store.js';
import { listBotPhrasesForAdmin, updateBotPhrasesFromAdmin } from '../game/botPhrases.js';
import { getAdminSiteStats } from '../stats/siteStats.js';
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  formatBackupSize,
  scheduleServerRestart,
} from '../backup/service.js';
import { getBackupScheduleSettings, setBackupScheduleSettings } from '../backup/schedule.js';
import {
  getTelegramBackupSettings,
  setTelegramBackupChatId,
} from '../backup/telegramSettings.js';
import { sendBackupToTelegram } from '../backup/telegram.js';
import { pushAdminReputationNotification } from '../notifications/push.js';
import {
  hasAdminPermission,
  getAdminPermissions,
  type AdminPermission,
} from './permissions.js';
import type { NextFunction, Request, Response } from 'express';

function requireAdminPermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!hasAdminPermission(req.user, permission)) {
      res.status(403).json({ error: 'Недостаточно прав для этого действия' });
      return;
    }
    next();
  };
}

export interface AdminRouterHandlers {
  getModerationData: () => {
    rooms: LobbyRoom[];
    messages: (ChatMessage & { roomId: number; roomName?: string; channel?: string })[];
  };
  deleteMessage: (roomId: number, messageId: string, channel: string) => boolean;
  clearRoomMessages: (roomId: number) => number;
  renameRoom: (id: number, name: string) => GameRoom;
  reorderRooms: (kind: 'game' | 'chat', roomIds: number[]) => void;
  addChatRoom: (name: string) => GameRoom;
  addGameRoom: (name: string, options?: { aiEnabled?: boolean; aiCount?: number }) => GameRoom;
  updateGameRoomAi: (roomId: number, aiEnabled: boolean, aiCount: number) => GameRoom;
  stopGameRoom: (roomId: number) => GameRoom;
  deleteChatRoom: (id: number) => void;
  deleteGameRoom: (id: number) => void;
  listSilencedPlayers: () => import('../game/engine.js').SilencedPlayerEntry[];
  clearUserSilence: (userId: number) => number;
  onRoomsChanged: (changedRoomId?: number | null) => void;
  syncUserInRooms?: (userId: number, displayName: string, username?: string) => void;
  onUserBanned?: (userId: number, reason: string, until: string | null) => void;
  onUserRoleChanged?: (userId: number) => void;
  getGameEvents?: () => GameEvent[];
  getChatHistory?: (roomId: number) => ChatMessage[];
  getRoomGameEvents?: (roomId: number) => GameEvent[];
}

export function createAdminRouter(handlers: AdminRouterHandlers) {
  const router = Router();
  const avatarUpload = createAvatarUpload((req) => req.params.userId || 'admin');

  router.use(authMiddleware, panelMiddleware);

  router.get('/permissions', (req, res) => {
    res.json({
      role: req.user!.role,
      permissions: getAdminPermissions(req.user),
    });
  });

  router.get('/users', requireAdminPermission('view_users'), (_req, res) => {
    res.json({ users: listAllUsers() });
  });

  router.get('/ban-list', requireAdminPermission('view_banlist'), (_req, res) => {
    const banned = listAllUsers().filter((u) => u.isBanned);
    const silenced = handlers.listSilencedPlayers().map((entry) => {
      const user = findUserPublic(entry.userId);
      return {
        ...entry,
        displayName: user?.displayName || entry.username,
      };
    });
    res.json({ banned, silenced });
  });

  router.post('/users/:userId/unsilence', requireAdminPermission('manage_silence'), (req, res) => {
    const userId = Number(req.params.userId);
    if (!findUserPublic(userId)) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const cleared = handlers.clearUserSilence(userId);
    handlers.onRoomsChanged();
    res.json({ cleared });
  });

  router.get('/overview', requireAdminPermission('view_users'), (_req, res) => {
    const { usersRegisteredToday } = getAdminSiteStats();
    res.json({
      ...handlers.getModerationData(),
      users: listAllUsers(),
      gameEvents: handlers.getGameEvents?.() || [],
      usersRegisteredToday,
    });
  });

  router.get('/stats', requireAdminPermission('view_stats'), (_req, res) => {
    res.json(getAdminSiteStats());
  });

  router.get('/rooms/:roomId/history', requireAdminPermission('view_rooms'), (req, res) => {
    const roomId = Number(req.params.roomId);
    res.json({
      chat: handlers.getChatHistory?.(roomId) || [],
      gameEvents: handlers.getRoomGameEvents?.(roomId) || [],
    });
  });

  /* --- Игровые комнаты (переименование) --- */
  router.put('/rooms/reorder', requireAdminPermission('manage_game_rooms'), (req, res) => {
    try {
      const kind = req.body?.kind === 'chat' ? 'chat' : 'game';
      const roomIds = Array.isArray(req.body?.roomIds)
        ? req.body.roomIds.map(Number).filter((id: number) => Number.isFinite(id) && id > 0)
        : [];
      if (roomIds.length === 0) {
        return res.status(400).json({ error: 'Укажите порядок комнат' });
      }
      handlers.reorderRooms(kind, roomIds);
      handlers.onRoomsChanged();
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/rooms/:roomId', requireAdminPermission('manage_game_rooms'), (req, res) => {
    try {
      const roomId = Number(req.params.roomId);
      const room = handlers.renameRoom(roomId, req.body.name);
      handlers.onRoomsChanged(roomId);
      res.json({ room: { id: room.id, name: room.name, kind: room.kind } });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/game-rooms', requireAdminPermission('manage_game_rooms'), (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Укажите название комнаты' });
      }
      const aiEnabled = !!req.body?.aiEnabled;
      const aiCount = aiEnabled ? Number(req.body?.aiCount ?? 0) : 0;
      if (aiEnabled && (!Number.isFinite(aiCount) || aiCount < 1 || aiCount > 10)) {
        return res.status(400).json({ error: 'Количество ИИ-игроков должно быть от 1 до 10' });
      }
      const room = handlers.addGameRoom(name, { aiEnabled, aiCount });
      handlers.onRoomsChanged(room.id);
      res.status(201).json({
        room: {
          id: room.id,
          name: room.name,
          kind: room.kind,
          aiEnabled: !!room.aiEnabled,
          aiCount: room.aiCount ?? 0,
        },
      });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось создать комнату' });
    }
  });

  router.delete('/game-rooms/:roomId', requireAdminPermission('manage_game_rooms'), (req, res) => {
    try {
      handlers.deleteGameRoom(Number(req.params.roomId));
      handlers.onRoomsChanged();
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/game-rooms/:roomId', requireAdminPermission('manage_game_rooms'), (req, res) => {
    try {
      const roomId = Number(req.params.roomId);
      const aiEnabled = !!req.body?.aiEnabled;
      const aiCount = aiEnabled ? Number(req.body?.aiCount ?? 0) : 0;
      if (aiEnabled && (!Number.isFinite(aiCount) || aiCount < 1 || aiCount > 10)) {
        return res.status(400).json({ error: 'Количество ИИ-игроков должно быть от 1 до 10' });
      }
      const room = handlers.updateGameRoomAi(roomId, aiEnabled, aiCount);
      handlers.onRoomsChanged(room.id);
      res.json({
        room: {
          id: room.id,
          name: room.name,
          kind: room.kind,
          aiEnabled: !!room.aiEnabled,
          aiCount: room.aiCount ?? 0,
        },
      });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось обновить комнату' });
    }
  });

  router.post('/game-rooms/:roomId/stop', requireAdminPermission('manage_game_rooms'), (req, res) => {
    try {
      const room = handlers.stopGameRoom(Number(req.params.roomId));
      handlers.onRoomsChanged(room.id);
      res.json({
        ok: true,
        room: {
          id: room.id,
          name: room.name,
          kind: room.kind,
          phase: room.phase,
        },
      });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось остановить игру' });
    }
  });

  /* --- Чат-комнаты --- */
  router.post('/chat-rooms', requireAdminPermission('manage_chat_rooms'), (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Укажите название комнаты' });
      }
      const room = handlers.addChatRoom(name);
      handlers.onRoomsChanged(room.id);
      res.status(201).json({ room: { id: room.id, name: room.name, kind: room.kind } });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось создать комнату' });
    }
  });

  router.delete('/chat-rooms/:roomId', requireAdminPermission('manage_chat_rooms'), (req, res) => {
    try {
      handlers.deleteChatRoom(Number(req.params.roomId));
      handlers.onRoomsChanged();
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/rooms/:roomId', (req, res) => {
    res.status(400).json({ error: 'Используйте DELETE /chat-rooms/:roomId для чат-комнат' });
  });

  /* --- Пользователи: профиль --- */
  router.put('/users/:userId', requireAdminPermission('edit_users'), (req, res) => {
    const id = Number(req.params.userId);
    const target = findUserPublic(id);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    const { displayName, gender, city, bio, username } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ error: 'Укажите имя' });
    }
    if (gender !== undefined && gender !== null && gender !== '' && normalizeGender(gender) === '') {
      return res.status(400).json({ error: 'Укажите пол' });
    }

    let user = updateUserProfile(id, {
      displayName: displayName.trim().slice(0, 30),
      gender: gender !== undefined ? normalizeGender(gender) : undefined,
      city: (city || '').trim().slice(0, 50),
      bio: (bio || '').trim().slice(0, 500),
    });

    if (username?.trim()) {
      try {
        user = updateUserUsername(id, username);
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка логина' });
      }
    }

    handlers.syncUserInRooms?.(id, user!.displayName, user!.username);
    res.json({ user });
  });

  router.put('/users/:userId/reputation', requireAdminPermission('set_reputation'), (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });
    const reputation = Number(req.body?.reputation);
    if (!Number.isFinite(reputation)) {
      return res.status(400).json({ error: 'Укажите reputation (число)' });
    }
    try {
      const previous = getReputation(id);
      const saved = adminSetReputation(id, reputation);
      if (saved !== previous) {
        pushAdminReputationNotification(id, saved);
      }
      res.json({ reputation: saved });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.post('/users/:userId/avatar', requireAdminPermission('edit_users'), (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });

    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
      if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
      if (!validateImageFile(req.file.path, req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Файл не является допустимым изображением' });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const { oldAvatar, user } = updateUserAvatar(id, avatarUrl);
      if (oldAvatar) deleteAvatarFile(oldAvatar);
      res.json({ user, avatar: avatarUrl });
    });
  });

  router.delete('/users/:userId/avatar', requireAdminPermission('edit_users'), (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });
    const user = removeUserAvatar(id);
    res.json({ user });
  });

  router.post('/ban', requireAdminPermission('ban_users'), (req, res) => {
    const { userId, reason, minutes } = req.body;
    const targetId = Number(userId);
    const target = findUserById(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!canBanTarget(req.user, target)) {
      return res.status(403).json({ error: 'Нельзя забанить этого пользователя' });
    }

    let until: string | null = null;
    if (minutes && Number(minutes) > 0) {
      until = new Date(Date.now() + Number(minutes) * 60000).toISOString();
    }
    const user = banUser(targetId, normalizeModerationReason(reason), until);
    addUserSanction({
      userId: targetId,
      sanctionType: 'ban',
      reason: normalizeModerationReason(reason),
      moderatorId: req.user!.id,
      moderatorName: req.user!.display_name || req.user!.username,
      untilAt: until,
    });
    handlers.onUserBanned?.(targetId, normalizeModerationReason(reason), until);
    res.json({ user });
  });

  router.post('/unban', requireAdminPermission('ban_users'), (req, res) => {
    const { userId } = req.body;
    const user = clearBan(Number(userId));
    if (user) liftUserSanctions(Number(userId), 'ban');
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user });
  });

  router.post('/users/:userId/role', requireAdminPermission('set_roles'), (req, res) => {
    const id = Number(req.params.userId);
    const role = req.body.role as AssignableRole;
    if (role !== 'user' && role !== 'moderator' && role !== 'watcher') {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    const user = updateUserRole(id, role);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден или это администратор' });
    handlers.onUserRoleChanged?.(id);
    res.json({ user });
  });

  router.delete('/users/:userId', requireAdminPermission('delete_users'), (req, res) => {
    const id = Number(req.params.userId);
    const target = findUserPublic(id);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.isAdmin) return res.status(403).json({ error: 'Нельзя удалить администратора' });
    deleteUser(id);
    res.json({ ok: true });
  });

  router.delete('/messages', (_req, res) => {
    res.status(400).json({ error: 'Удаляйте сообщения из комнаты с указанием типа нарушения' });
  });

  router.get('/violations', requireAdminPermission('view_violations'), (req, res) => {
    const rawType = typeof req.query.type === 'string' ? req.query.type : '';
    const type =
      rawType === 'profanity' || rawType === 'advertising' || rawType === 'other'
        ? rawType
        : undefined;
    res.json({ violations: listViolations(300, type) });
  });

  router.delete('/violations', requireAdminPermission('clear_violations'), (req, res) => {
    const rawType = typeof req.query.type === 'string' ? req.query.type : '';
    const type =
      rawType === 'profanity' || rawType === 'advertising' || rawType === 'other'
        ? rawType
        : undefined;
    const cleared = clearViolations(type);
    res.json({ ok: true, cleared });
  });

  router.post('/news/upload-image', requireAdminPermission('manage_news'), (req, res) => {
    newsImageUpload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
      if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
      if (!validateImageFile(req.file.path, req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Файл не является допустимым изображением' });
      }
      res.json({ url: newsImagePublicPath(req.file.filename) });
    });
  });

  router.delete('/rooms/:roomId/messages', requireAdminPermission('manage_chat_rooms'), (req, res) => {
    const cleared = handlers.clearRoomMessages(Number(req.params.roomId));
    res.json({ ok: true, cleared });
  });

  router.get('/news', requireAdminPermission('manage_news'), (req, res) => {
    res.json({ news: listAllNews(100, req.userId!) });
  });

  router.post('/news', requireAdminPermission('manage_news'), (req, res) => {
    try {
      const news = createNews(req.userId!, {
        title: req.body.title,
        body: req.body.body,
        coverImage: req.body.coverImage ?? null,
        isPublished: req.body.isPublished !== false,
        isFeatured: !!req.body.isFeatured,
      });
      if (req.body.poll !== undefined) {
        upsertPollForNews(news.id, req.body.poll as PollInput, req.userId!);
      }
      res.status(201).json({ news: findNewsById(news.id, req.userId!) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.put('/news/:id', requireAdminPermission('manage_news'), (req, res) => {
    try {
      const id = Number(req.params.id);
      const news = updateNews(id, {
        title: req.body.title,
        body: req.body.body,
        coverImage: req.body.coverImage,
        isPublished: req.body.isPublished,
        isFeatured: req.body.isFeatured,
      });
      if (!news) return res.status(404).json({ error: 'Новость не найдена' });
      if (req.body.poll !== undefined) {
        upsertPollForNews(id, req.body.poll as PollInput, req.userId!);
      }
      res.json({ news: findNewsById(id, req.userId!) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.delete('/news/:id', requireAdminPermission('manage_news'), (req, res) => {
    const ok = deleteNews(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Новость не найдена' });
    res.json({ ok: true });
  });

  router.get('/blog', requireAdminPermission('manage_news'), (_req, res) => {
    res.json({ posts: listAllBlog(100) });
  });

  router.post('/blog', requireAdminPermission('manage_news'), (req, res) => {
    try {
      const post = createBlogPost(req.userId!, {
        title: req.body.title,
        body: req.body.body,
        coverImage: req.body.coverImage ?? null,
        isPublished: req.body.isPublished !== false,
      });
      res.status(201).json({ post: findBlogById(post.id) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.put('/blog/:id', requireAdminPermission('manage_news'), (req, res) => {
    try {
      const id = Number(req.params.id);
      const post = updateBlogPost(id, {
        title: req.body.title,
        body: req.body.body,
        coverImage: req.body.coverImage,
        isPublished: req.body.isPublished,
      });
      if (!post) return res.status(404).json({ error: 'Статья не найдена' });
      res.json({ post });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.delete('/blog/:id', requireAdminPermission('manage_news'), (req, res) => {
    const ok = deleteBlogPost(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Статья не найдена' });
    res.json({ ok: true });
  });

  router.get('/bot-phrases', requireAdminPermission('manage_phrases'), (_req, res) => {
    res.json(listBotPhrasesForAdmin());
  });

  router.put('/bot-phrases', requireAdminPermission('manage_phrases'), (req, res) => {
    const phrases = req.body?.phrases;
    if (!phrases || typeof phrases !== 'object' || Array.isArray(phrases)) {
      return res.status(400).json({ error: 'Укажите объект phrases' });
    }
    const { updated } = updateBotPhrasesFromAdmin(phrases as Record<string, string>);
    res.json({ ...listBotPhrasesForAdmin(), updated });
  });

  router.get('/backups/schedule', requireAdminPermission('manage_backups'), (_req, res) => {
    res.json({ schedule: getBackupScheduleSettings() });
  });

  router.put('/backups/schedule', requireAdminPermission('manage_backups'), (req, res) => {
    try {
      const schedule = setBackupScheduleSettings(req.body ?? {});
      res.json({ schedule });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Неверные настройки' });
    }
  });

  router.get('/backups', requireAdminPermission('manage_backups'), (_req, res) => {
    const backups = listBackups().map((b) => ({
      ...b,
      sizeLabel: formatBackupSize(b.sizeBytes),
    }));
    res.json({ backups });
  });

  router.post('/backups', requireAdminPermission('manage_backups'), async (req, res) => {
    try {
      const includeUploads = req.body?.includeUploads !== false;
      const backup = await createBackup(includeUploads);
      res.status(201).json({
        backup: { ...backup, sizeLabel: formatBackupSize(backup.sizeBytes) },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка создания бэкапа' });
    }
  });

  router.get('/backups/telegram-settings', requireAdminPermission('manage_backups'), (_req, res) => {
    res.json({ settings: getTelegramBackupSettings() });
  });

  router.put('/backups/telegram-settings', requireAdminPermission('manage_backups'), (req, res) => {
    try {
      const settings = setTelegramBackupChatId(req.body?.chatId ?? '');
      res.json({ settings });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Неверный chat ID' });
    }
  });

  router.post('/backups/:id/restore', requireAdminPermission('manage_backups'), async (req, res) => {
    try {
      await restoreBackup(req.params.id);
      scheduleServerRestart();
      res.json({ ok: true, restarting: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка восстановления' });
    }
  });

  router.delete('/backups/:id', requireAdminPermission('manage_backups'), (req, res) => {
    try {
      deleteBackup(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка удаления' });
    }
  });

  router.post('/backups/:id/send-telegram', requireAdminPermission('manage_backups'), async (req, res) => {
    try {
      await sendBackupToTelegram(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка отправки в Telegram' });
    }
  });

  return router;
}
