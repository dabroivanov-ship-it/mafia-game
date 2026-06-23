import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth/jwt.js';
import {
  listAllUsers,
  banUser,
  clearBan,
  deleteUser,
  findUserPublic,
  findUserById,
  updateUserProfile,
  updateUserAvatar,
  removeUserAvatar,
  deleteAvatarFile,
  updateUserRole,
  canBanTarget,
  type AssignableRole,
} from '../auth/db.js';
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
} from '../news/store.js';
import { listViolations, clearViolations } from '../moderation/violationLog.js';
import { newsImageUpload, newsImagePublicPath } from '../upload/newsImage.js';
import { adminSetReputation } from '../social/store.js';
import { listBotPhrasesForAdmin, updateBotPhrasesFromAdmin } from '../game/botPhrases.js';

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
  addGameRoom: (name: string) => GameRoom;
  deleteChatRoom: (id: number) => void;
  listSilencedPlayers: () => import('../game/engine.js').SilencedPlayerEntry[];
  clearUserSilence: (userId: number) => number;
  onRoomsChanged: (changedRoomId?: number | null) => void;
  syncUserInRooms?: (userId: number, displayName: string) => void;
  onUserBanned?: (userId: number, reason: string, until: string | null) => void;
  onUserRoleChanged?: (userId: number) => void;
  getGameEvents?: () => GameEvent[];
  getChatHistory?: (roomId: number) => ChatMessage[];
  getRoomGameEvents?: (roomId: number) => GameEvent[];
}

export function createAdminRouter(handlers: AdminRouterHandlers) {
  const router = Router();
  const avatarUpload = createAvatarUpload((req) => req.params.userId || 'admin');

  router.use(authMiddleware, adminMiddleware);

  router.get('/users', (_req, res) => {
    res.json({ users: listAllUsers() });
  });

  router.get('/ban-list', (_req, res) => {
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

  router.post('/users/:userId/unsilence', (req, res) => {
    const userId = Number(req.params.userId);
    if (!findUserPublic(userId)) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const cleared = handlers.clearUserSilence(userId);
    handlers.onRoomsChanged();
    res.json({ cleared });
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

  /* --- Игровые комнаты (переименование) --- */
  router.put('/rooms/reorder', (req, res) => {
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

  router.put('/rooms/:roomId', (req, res) => {
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

  router.post('/game-rooms', (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Укажите название комнаты' });
      }
      const room = handlers.addGameRoom(name);
      handlers.onRoomsChanged(room.id);
      res.status(201).json({ room: { id: room.id, name: room.name, kind: room.kind } });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось создать комнату' });
    }
  });

  /* --- Чат-комнаты --- */
  router.post('/chat-rooms', (req, res) => {
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

  router.delete('/chat-rooms/:roomId', (req, res) => {
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
    handlers.syncUserInRooms?.(id, user!.displayName);
    res.json({ user });
  });

  router.put('/users/:userId/reputation', (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });
    const reputation = Number(req.body?.reputation);
    if (!Number.isFinite(reputation)) {
      return res.status(400).json({ error: 'Укажите reputation (число)' });
    }
    try {
      const saved = adminSetReputation(id, reputation);
      res.json({ reputation: saved });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.post('/users/:userId/avatar', (req, res) => {
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

  router.delete('/users/:userId/avatar', (req, res) => {
    const id = Number(req.params.userId);
    if (!findUserPublic(id)) return res.status(404).json({ error: 'Пользователь не найден' });
    const user = removeUserAvatar(id);
    res.json({ user });
  });

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
    const user = banUser(targetId, normalizeModerationReason(reason), until);
    handlers.onUserBanned?.(targetId, normalizeModerationReason(reason), until);
    res.json({ user });
  });

  router.post('/unban', (req, res) => {
    const { userId } = req.body;
    const user = clearBan(Number(userId));
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user });
  });

  router.post('/users/:userId/role', (req, res) => {
    const id = Number(req.params.userId);
    const role = req.body.role as AssignableRole;
    if (role !== 'user' && role !== 'moderator') {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    const user = updateUserRole(id, role);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден или это администратор' });
    handlers.onUserRoleChanged?.(id);
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

  router.delete('/messages', (_req, res) => {
    res.status(400).json({ error: 'Удаляйте сообщения из комнаты с указанием типа нарушения' });
  });

  router.get('/violations', (_req, res) => {
    res.json({ violations: listViolations(300) });
  });

  router.delete('/violations', (_req, res) => {
    const cleared = clearViolations();
    res.json({ ok: true, cleared });
  });

  router.post('/news/upload-image', (req, res) => {
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

  router.delete('/rooms/:roomId/messages', (req, res) => {
    const cleared = handlers.clearRoomMessages(Number(req.params.roomId));
    res.json({ ok: true, cleared });
  });

  router.get('/news', (_req, res) => {
    res.json({ news: listAllNews() });
  });

  router.post('/news', (req, res) => {
    try {
      const news = createNews(req.userId!, {
        title: req.body.title,
        body: req.body.body,
        coverImage: req.body.coverImage ?? null,
        isPublished: req.body.isPublished !== false,
        isFeatured: !!req.body.isFeatured,
      });
      res.status(201).json({ news });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  });

  router.put('/news/:id', (req, res) => {
    const news = updateNews(Number(req.params.id), {
      title: req.body.title,
      body: req.body.body,
      coverImage: req.body.coverImage,
      isPublished: req.body.isPublished,
      isFeatured: req.body.isFeatured,
    });
    if (!news) return res.status(404).json({ error: 'Новость не найдена' });
    res.json({ news });
  });

  router.delete('/news/:id', (req, res) => {
    const ok = deleteNews(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Новость не найдена' });
    res.json({ ok: true });
  });

  router.get('/bot-phrases', (_req, res) => {
    res.json(listBotPhrasesForAdmin());
  });

  router.put('/bot-phrases', (req, res) => {
    const phrases = req.body?.phrases;
    if (!phrases || typeof phrases !== 'object' || Array.isArray(phrases)) {
      return res.status(400).json({ error: 'Укажите объект phrases' });
    }
    const { updated } = updateBotPhrasesFromAdmin(phrases as Record<string, string>);
    res.json({ ...listBotPhrasesForAdmin(), updated });
  });

  return router;
}
