import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG, isActiveGamePhase } from './game/config.js';
import authRoutes from './auth/routes.js';
import { createProfileRouter } from './profile/routes.js';
import { createAdminRouter } from './admin/routes.js';
import { createModerationRouter } from './moderation/routes.js';
import { createMessagesRouter } from './messages/routes.js';
import { createNewsRouter } from './news/routes.js';
import { getUnreadCount } from './messages/store.js';
import { socketAuthMiddleware } from './auth/jwt.js';
import { findUserById, updateUserScore, isAdmin, isStaff, updateUserConnectionInfo, uploadsDir, normalizeChatLimit, canBanTarget } from './auth/db.js';
import { hydrateRoomHistory, loadGameEvents, getRecentGameEvents, getAdminChatHistory, getRecentChatForAdmin } from './history/store.js';
import {
  createInitialRooms,
  getLobbySnapshot,
  addPlayerToRoom,
  markPlayerDisconnected,
  finalizePlayerLeave,
  addHostPrivateMessage,
  reconnectPlayer,
  startRegistration,
  joinGame,
  leaveGame,
  tryStartGameAfterRegistration,
  onRegistrationTimerEnd,
  onRolesTimerEnd,
  onDayTimerEnd,
  onNightTimerEnd,
  startVoting,
  castDayVote,
  submitNightAction,
  addChatMessage,
  addPrivateChatMessage,
  deleteChatMessage,
  clearRoomChat,
  addSystemMessage,
  getModerationSnapshot,
  resetRoom,
  serializeRoomForPlayer,
  renameRoom,
  addChatRoom,
  removeRoom,
  isChatRoom,
  checkWin,
  isPlayerSilenced,
  setPlayerSilence,
  clearPlayerSilence,
  addMutedOnlyMessage,
} from './game/engine.js';
import type { ChatChannel, GameRoom, PrivateNote, PublicUser, RoomState, Session } from './types/index.js';
import { assertProductionEnv } from './config/env.js';

assertProductionEnv();

const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
app.use(corsOrigin?.length ? cors({ origin: corsOrigin, credentials: true }) : cors());
app.use(express.json({ limit: '256kb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOrigin?.length
    ? { origin: corsOrigin, methods: ['GET', 'POST'] }
    : { origin: true, methods: ['GET', 'POST'] },
});

const rooms = createInitialRooms();
for (const room of rooms.values()) {
  hydrateRoomHistory(room);
}
const sessions = new Map<string, Session>();
const userSocketIds = new Map<number, Set<string>>();
const DEFAULT_CHAT_LIMIT = 15;
const CHAT_LOAD_STEP = 30;
const MAX_CHAT_LIMIT = 300;

const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function disconnectTimerKey(roomId: number, playerId: number): string {
  return `${roomId}:${playerId}`;
}

function cancelDisconnectTimer(roomId: number, playerId: number): void {
  const key = disconnectTimerKey(roomId, playerId);
  const timer = disconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(key);
  }
}

function scheduleDisconnectTimer(roomId: number, playerId: number): void {
  cancelDisconnectTimer(roomId, playerId);
  const key = disconnectTimerKey(roomId, playerId);
  const timer = setTimeout(() => {
    disconnectTimers.delete(key);
    const room = rooms.get(roomId);
    if (!room) return;
    if (finalizePlayerLeave(room, playerId)) {
      checkWin(room);
      broadcastRoom(roomId);
    }
  }, CONFIG.DISCONNECT_GRACE_SEC * 1000);
  disconnectTimers.set(key, timer);
}

function getUserChatLimit(userId: number | undefined): number {
  if (!userId) return DEFAULT_CHAT_LIMIT;
  const user = findUserById(userId);
  return normalizeChatLimit(user?.chat_limit);
}

function resolveSessionChatLimit(session: Session | undefined, userId: number | undefined): number {
  const base = getUserChatLimit(userId);
  if (!session) return base;
  return Math.max(base, session.chatLimit ?? base);
}

function syncUserProfileInRooms(userId: number, user: PublicUser | null): void {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.userId === userId);
    if (!player?.socketId) continue;
    const session = sessions.get(player.socketId);
    if (session && user?.chatLimit) {
      session.chatLimit = normalizeChatLimit(user.chatLimit);
    }
    if (user?.displayName) player.name = user.displayName;
    io.to(player.socketId).emit(
      'room:state',
      serializeForSocketUser(room, player.id, userId, player.socketId)
    );
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: getLobbySnapshot(rooms) });
});

app.use('/api/auth', authRoutes);
app.use(
  '/api/profile',
  createProfileRouter({ onProfileUpdated: syncUserProfileInRooms })
);
app.use('/api/news', createNewsRouter());
app.use('/uploads/avatars', express.static(uploadsDir));

function adminDeleteMessage(roomId: number, messageId: string, channel: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const ok = deleteChatMessage(room, messageId, channel as ChatChannel);
  if (ok) broadcastRoom(roomId);
  return ok;
}

const CLEAR_WARNING_MS = 60_000;
const CLEAR_TOTAL_MS = 120_000;

interface PendingRoomClear {
  warningTimer: ReturnType<typeof setTimeout>;
  clearTimer: ReturnType<typeof setTimeout>;
}

const pendingRoomClears = new Map<number, PendingRoomClear>();

function findRoomForUser(userId: number): GameRoom | null {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.userId === userId)) {
      return room;
    }
  }
  return null;
}

function notifyRoomOfUserBan(userId: number, reason: string, until: string | null): void {
  const room = findRoomForUser(userId);
  if (!room) return;

  const user = findUserById(userId);
  const name = user?.display_name || user?.username || 'Игрок';
  const duration = until
    ? `до ${new Date(until).toLocaleString('ru-RU')}`
    : 'навсегда';
  const reasonText = reason.trim() || 'не указана';

  addSystemMessage(
    room,
    `🚫 ${name} заблокирован(а) администратором. Срок: ${duration}. Причина: ${reasonText}.`
  );
  broadcastRoom(room.id);
}

function adminClearRoomMessages(roomId: number): number {
  const room = rooms.get(roomId);
  if (!room) return 0;

  const existing = pendingRoomClears.get(roomId);
  if (existing) {
    clearTimeout(existing.warningTimer);
    clearTimeout(existing.clearTimer);
  }

  const warningTimer = setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r) return;
    addSystemMessage(
      r,
      '⚠️ Чат будет очищен через 1 минуту по решению администратора.'
    );
    broadcastRoom(roomId);
  }, CLEAR_WARNING_MS);

  const clearTimer = setTimeout(() => {
    pendingRoomClears.delete(roomId);
    const r = rooms.get(roomId);
    if (!r) return;
    clearRoomChat(r);
    broadcastRoom(roomId);
  }, CLEAR_TOTAL_MS);

  pendingRoomClears.set(roomId, { warningTimer, clearTimer });
  return 0;
}

function kickPlayersFromRoom(room: GameRoom): void {
  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit('room:kicked', { reason: 'Комната удалена администратором' });
      sessions.delete(player.socketId);
    }
  }
}

function onRoomsChanged(changedRoomId: number | null = null): void {
  broadcastLobby();
  if (changedRoomId != null) {
    broadcastRoom(changedRoomId);
    return;
  }
  for (const room of rooms.values()) {
    broadcastRoom(room.id);
  }
}

function adminDeleteRoom(roomId: number): void {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Комната не найдена');
  kickPlayersFromRoom(room);
  removeRoom(rooms, roomId);
}

function syncUserInRooms(userId: number, displayName: string): void {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      player.name = displayName;
      if (player.socketId) {
        io.to(player.socketId).emit(
          'room:state',
          serializeForSocketUser(room, player.id, userId, player.socketId)
        );
      }
    }
  }
  onRoomsChanged();
}

app.use(
  '/api/admin',
  createAdminRouter({
    getModerationData: () => {
      const snap = getModerationSnapshot(rooms);
      const roomNames = Object.fromEntries(
        [...rooms.values()].map((r) => [r.id, r.name])
      );
      const messages = getRecentChatForAdmin(100).map((m) => ({
        ...m,
        roomName: roomNames[m.roomId] || `Комната ${m.roomId}`,
      }));
      return { rooms: snap.rooms, messages };
    },
    deleteMessage: adminDeleteMessage,
    clearRoomMessages: adminClearRoomMessages,
    renameRoom: (id, name) => renameRoom(rooms, id, name),
    addChatRoom: (name) => addChatRoom(rooms, name),
    deleteChatRoom: (id) => adminDeleteRoom(id),
    onRoomsChanged,
    syncUserInRooms,
    onUserBanned: notifyRoomOfUserBan,
    getGameEvents: () => getRecentGameEvents(40),
    getChatHistory: (roomId) => getAdminChatHistory(roomId, 300),
    getRoomGameEvents: (roomId) => loadGameEvents(roomId, 50),
  })
);
app.use('/api/moderation', createModerationRouter());
app.use(
  '/api/messages',
  createMessagesRouter({
    onMessageSent: (recipientId, payload) => {
      notifyUser(recipientId, 'pm:received', payload);
    },
    onMessageRead: (userId, unreadCount) => {
      notifyUser(userId, 'pm:unread', { count: unreadCount });
    },
  })
);

function attachUserSocket(userId: number, socketId: string): void {
  if (!userSocketIds.has(userId)) userSocketIds.set(userId, new Set());
  userSocketIds.get(userId)!.add(socketId);
}

function detachUserSocket(userId: number, socketId: string): void {
  const set = userSocketIds.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSocketIds.delete(userId);
}

function notifyUser(userId: number, event: string, data: unknown): void {
  const socketIds = userSocketIds.get(userId);
  if (!socketIds) return;
  for (const socketId of socketIds) {
    io.to(socketId).emit(event, data);
  }
}

function serializeForSocketUser(
  room: GameRoom,
  gamePlayerId: number,
  userId: number | undefined,
  socketId: string | null = null
): RoomState {
  const session = socketId ? sessions.get(socketId) : undefined;
  const chatLimit = resolveSessionChatLimit(session, userId);
  const acc = userId ? findUserById(userId) : undefined;
  return serializeRoomForPlayer(room, gamePlayerId, {
    isAdmin: isAdmin(acc),
    canModerate: isStaff(acc),
    chatLimit,
  });
}

function syncRoomScores(room: GameRoom): void {
  if (room.phase !== 'ended' || room.scoresSynced) return;
  for (const p of room.players) {
    if (p.userId && p.score !== 0) {
      updateUserScore(p.userId, p.score);
    }
  }
  room.scoresSynced = true;
}

function broadcastLobby(): void {
  io.emit('lobby:update', getLobbySnapshot(rooms));
}

function broadcastRoom(roomId: number): void {
  const room = rooms.get(roomId);
  if (!room) return;

  syncRoomScores(room);

  const notified = new Set<number>();
  for (const [socketId, session] of sessions.entries()) {
    if (session.roomId !== roomId) continue;
    io.to(socketId).emit(
      'room:state',
      serializeForSocketUser(room, session.playerId, session.userId, socketId)
    );
    notified.add(session.playerId);
  }

  for (const player of room.players) {
    if (!player.connected || !player.socketId || notified.has(player.id)) continue;
    io.to(player.socketId).emit(
      'room:state',
      serializeForSocketUser(room, player.id, player.userId ?? undefined, player.socketId)
    );
  }

  broadcastLobby();
}

function deliverHostNotes(room: GameRoom, privateNotes: PrivateNote[] = []): void {
  for (const note of privateNotes) {
    addHostPrivateMessage(room, note.playerId, note.message);
    const p = room.players.find((pl) => pl.id === note.playerId);
    if (p?.socketId) {
      io.to(p.socketId).emit('notification:private', { message: note.message });
    }
  }
}

function attachSession(socketId: string, roomId: number, playerId: number, userId?: number): void {
  sessions.set(socketId, {
    roomId,
    playerId,
    userId,
    chatLimit: getUserChatLimit(userId),
  });
}

// Таймеры комнат — проверка каждую секунду
setInterval(() => {
  for (const room of rooms.values()) {
    if (isChatRoom(room)) continue;
    if (!room.timerEnd || Date.now() < room.timerEnd) continue;

    const reason = room.timerReason;
    let privateNotes: PrivateNote[] = [];
    if (reason === 'registration') {
      privateNotes = onRegistrationTimerEnd(room);
      privateNotes.push(...tryStartGameAfterRegistration(room));
    } else if (reason === 'roles') {
      privateNotes = onRolesTimerEnd(room);
    } else if (reason === 'day') {
      privateNotes = onDayTimerEnd(room);
    } else if (reason === 'night') {
      const result = onNightTimerEnd(room);
      if (result?.privateNotes) privateNotes = result.privateNotes;
    }

    broadcastRoom(room.id);
    deliverHostNotes(room, privateNotes);
  }
}, 1000);

function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return socket.handshake.address || '';
}

function trackUserConnection(socket: Socket): void {
  if (!socket.userId) return;
  const userAgent = String(socket.handshake.headers['user-agent'] || '');
  updateUserConnectionInfo(socket.userId, getClientIp(socket), userAgent);
}

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const user = findUserById(socket.userId!);
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.displayName = user.display_name;
  socket.username = user.username;
  socket.isAdmin = isAdmin(user);
  socket.isModerator = user.role === 'moderator';
  socket.isStaff = isStaff(user);
  trackUserConnection(socket);
  attachUserSocket(socket.userId!, socket.id);
  socket.emit('pm:unread', { count: getUnreadCount(socket.userId!) });

  socket.emit('lobby:update', getLobbySnapshot(rooms));

  socket.on('lobby:get', () => {
    socket.emit('lobby:update', getLobbySnapshot(rooms));
  });

  socket.on('room:join', ({ roomId, playerId: reconnectId }, cb) => {
    try {
      const room = rooms.get(Number(roomId));
      if (!room) return cb?.({ error: 'Комната не найдена' });

      const playerName = socket.displayName!;
      const playerUsername = socket.username!;
      let player;
      let joinPrivateNotes: PrivateNote[] = [];

      if (reconnectId) {
        const reconnected = reconnectPlayer(room, reconnectId, socket.id, playerName, playerUsername);
        player = reconnected.player;
        joinPrivateNotes = reconnected.privateNotes;
      }
      if (!player) {
        const joined = addPlayerToRoom(room, {
          name: playerName,
          username: playerUsername,
          socketId: socket.id,
          userId: socket.userId!,
        });
        player = joined.player;
        joinPrivateNotes = joined.privateNotes;
      }

      cancelDisconnectTimer(room.id, player.id);
      player.socketId = socket.id;
      player.connected = true;
      player.disconnectedAt = null;

      attachSession(socket.id, room.id, player.id, socket.userId);
      socket.join(`room:${room.id}`);
      if (joinPrivateNotes.length) {
        deliverHostNotes(room, joinPrivateNotes);
      }
      broadcastRoom(room.id);
      cb?.({ ok: true, playerId: player.id, state: serializeForSocketUser(room, player.id, socket.userId, socket.id) });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('room:detach', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ ok: true });
    socket.leave(`room:${session.roomId}`);
    sessions.delete(socket.id);
    cb?.({ ok: true });
  });

  socket.on('room:start', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    try {
      startRegistration(room, session.playerId);
      broadcastRoom(room.id);
      cb?.({
        ok: true,
        state: serializeForSocketUser(room, session.playerId, socket.userId, socket.id),
      });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('room:joinGame', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    try {
      const { privateNotes } = joinGame(room, session.playerId);
      broadcastRoom(room.id);
      deliverHostNotes(room, privateNotes);
      cb?.({
        ok: true,
        state: serializeForSocketUser(room, session.playerId, socket.userId, socket.id),
      });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('room:leaveGame', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    try {
      leaveGame(room, session.playerId);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('room:loadMoreChat', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });

    session.chatLimit = Math.min(
      MAX_CHAT_LIMIT,
      resolveSessionChatLimit(session, socket.userId) + CHAT_LOAD_STEP
    );
    socket.emit(
      'room:state',
      serializeForSocketUser(room, session.playerId, socket.userId, socket.id)
    );
    cb?.({ ok: true });
  });

  socket.on('room:newGame', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    resetRoom(room);
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('chat:send', ({ text, toPlayerId, isPrivate }, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    const me = room.players.find((p) => p.id === session.playerId);
    if (!me) return cb?.({ error: 'Игрок не найден' });

    const trimmed = String(text || '').trim();
    if (!trimmed) return cb?.({ error: 'Пустое сообщение' });

    const targetId = toPlayerId ? Number(toPlayerId) : null;

    if (isPrivate && targetId) {
      const target = room.players.find((p) => p.id === targetId && p.connected);
      if (!target) return cb?.({ error: 'Получатель не в комнате' });
      if (targetId === session.playerId) return cb?.({ error: 'Нельзя написать себе' });
      if (isPlayerSilenced(me)) {
        addMutedOnlyMessage(room, me, trimmed, 'private');
        broadcastRoom(room.id);
        return cb?.({ ok: true });
      }
      const msg = addPrivateChatMessage(room, session.playerId, targetId, trimmed);
      if (!msg) return cb?.({ error: 'Не удалось отправить' });
      broadcastRoom(room.id);
      return cb?.({ ok: true });
    }

    const gameRunning = isActiveGamePhase(room.phase);
    const isSpectator = !isChatRoom(room) && !me.inGame && gameRunning;

    let channel: ChatChannel = 'public';
    if (isChatRoom(room)) {
      channel = 'public';
    } else if (isSpectator) {
      channel = 'spectator';
    } else if (gameRunning && me.inGame && me.role) {
      channel = me.alive ? 'public' : 'dead';
    }

    if (isPlayerSilenced(me)) {
      addMutedOnlyMessage(room, me, trimmed, channel);
      broadcastRoom(room.id);
      return cb?.({ ok: true });
    }

    const msg = addChatMessage(room, session.playerId, trimmed, channel, {
      toPlayerId: targetId && targetId !== session.playerId ? targetId : undefined,
    });
    if (!msg) return cb?.({ error: 'Не удалось отправить' });

    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('chat:mafia', ({ text }, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    const me = room.players.find((p) => p.id === session.playerId);
    if (me?.role !== 'mafia' || !me.alive) return cb?.({ error: 'Нет доступа' });

    const trimmed = String(text || '').trim();
    if (!trimmed) return cb?.({ error: 'Пустое сообщение' });
    if (isPlayerSilenced(me)) {
      addMutedOnlyMessage(room, me, trimmed, 'mafia');
      broadcastRoom(room.id);
      return cb?.({ ok: true });
    }

    addChatMessage(room, session.playerId, trimmed, 'mafia');
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('game:startVoting', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    const notes = startVoting(room);
    broadcastRoom(room.id);
    deliverHostNotes(room, notes);
    cb?.({ ok: true });
  });

  socket.on('game:vote', ({ targetId }, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    try {
      const notes = castDayVote(room, session.playerId, targetId);
      broadcastRoom(room.id);
      deliverHostNotes(room, notes);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('game:nightAction', (action, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    try {
      const result = submitNightAction(room, session.playerId, action);
      broadcastRoom(room.id);
      deliverHostNotes(room, result?.privateNotes || []);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('admin:deleteMessage', ({ messageId, channel }, cb) => {
    if (!socket.isStaff) return cb?.({ error: 'Нет доступа' });
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });
    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });
    const ok = deleteChatMessage(room, messageId, (channel || 'public') as ChatChannel);
    if (!ok) return cb?.({ error: 'Сообщение не найдено' });
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('mod:silence', ({ targetPlayerId, reason, hours }, cb) => {
    if (!socket.isStaff) return cb?.({ error: 'Нет доступа' });
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });

    const staffUser = findUserById(socket.userId!);
    const target = room.players.find((p) => p.id === Number(targetPlayerId));
    if (!target?.userId) return cb?.({ error: 'Игрок не найден' });

    const targetUser = findUserById(target.userId);
    if (!staffUser || !targetUser || !canBanTarget(staffUser, targetUser)) {
      return cb?.({ error: 'Нет прав для молчания этого игрока' });
    }

    try {
      const hoursNum = hours && Number(hours) > 0 ? Number(hours) : null;
      setPlayerSilence(room, target.id, hoursNum, String(reason || ''));
      const duration =
        hoursNum && hoursNum > 0 ? `на ${hoursNum} ч.` : 'бессрочно';
      const reasonText = String(reason || '').trim() || 'нарушение правил';
      addSystemMessage(
        room,
        `🔇 ${target.username || target.name} получил(а) молчание (${duration}). Причина: ${reasonText}.`
      );
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('mod:unsilence', ({ targetPlayerId }, cb) => {
    if (!socket.isStaff) return cb?.({ error: 'Нет доступа' });
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });

    const staffUser = findUserById(socket.userId!);
    const target = room.players.find((p) => p.id === Number(targetPlayerId));
    if (!target?.userId) return cb?.({ error: 'Игрок не найден' });

    const targetUser = findUserById(target.userId);
    if (!staffUser || !targetUser || !canBanTarget(staffUser, targetUser)) {
      return cb?.({ error: 'Нет прав' });
    }

    try {
      clearPlayerSilence(room, target.id);
      addSystemMessage(
        room,
        `🔊 С ${target.username || target.name} снято молчание.`
      );
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) detachUserSocket(socket.userId, socket.id);

    const session = sessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.roomId);
    if (!room) return;

    const player = markPlayerDisconnected(room, socket.id);
    sessions.delete(socket.id);

    if (player && !isChatRoom(room) && isActiveGamePhase(room.phase) && player.inGame && player.alive) {
      scheduleDisconnectTimer(room.id, player.id);
    }

    broadcastRoom(room.id);
  });
});

// Отдаём собранный React-клиент (client/dist)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = __dirname.endsWith(`${path.sep}dist`) ? path.join(__dirname, '..') : __dirname;
const clientDist = path.join(serverRoot, '..', 'client', 'dist');

app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Клиент не собран. Выполните: cd client && npm install && npm run build');
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎭 Mafia server: http://localhost:${PORT}`);
  console.log(`   Комнат: ${CONFIG.ROOM_COUNT}, игроков: ${CONFIG.MIN_PLAYERS}–${CONFIG.MAX_PLAYERS}`);
  console.log(`   Static: ${clientDist}`);
});
