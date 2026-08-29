import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG, PHASE, isActiveGamePhase } from './game/config.js';
import { isMafiaTeam } from './game/roles.js';
import authRoutes from './auth/routes.js';
import { getOnlineUserCount, markUserConnected, markUserDisconnected, setOnlineRoomResolver, setUserSection } from './presence.js';
import friendsRoutes from './social/routes.js';
import reputationRoutes from './reputation/routes.js';
import './social/store.js';
import './settings/botPhrasesStore.js';
import { createProfileRouter } from './profile/routes.js';
import { createAdminRouter } from './admin/routes.js';
import { createModerationRouter } from './moderation/routes.js';
import { createMessagesRouter } from './messages/routes.js';
import { createSupportRouter } from './support/routes.js';
import { createNewsRouter } from './news/routes.js';
import './news/comments.js';
import './news/polls.js';
import { createBlogRouter } from './blog/routes.js';
import { getPublicSiteStats } from './stats/siteStats.js';
import settingsRoutes from './settings/routes.js';
import notificationRoutes from './notifications/routes.js';
import { initNotificationPush, pushMailNotification, pushStaffAutoModerationAlert } from './notifications/push.js';
import { getUnreadNotificationCount, listNotifications } from './notifications/store.js';
import { getUnreadCount } from './messages/store.js';
import { socketAuthMiddleware, refreshSocketUser } from './auth/jwt.js';
import { findUserById, updateUserScore, isAdmin, isStaff, isModerator, canModerateSilence, canSilenceTarget, updateUserConnectionInfo, uploadsDir, normalizeChatLimit, canBanTarget, listStaffUsers } from './auth/db.js';
import { hydrateRoomHistory, loadGameEvents, getRecentGameEvents, getAdminChatHistory, getRecentChatForAdmin } from './history/store.js';
import { recordRoomGameResults } from './stats/store.js';
import {
  createInitialRooms,
  getLobbySnapshot,
  addPlayerToRoom,
  markPlayerDisconnected,
  announcePlayerDisconnected,
  finalizePlayerLeave,
  removePlayer,
  addHostPrivateMessage,
  reconnectPlayer,
  startRegistration,
  joinGame,
  leaveGame,
  tryStartGameAfterRegistration,
  onRegistrationTimerEnd,
  onRolesTimerEnd,
  onDayTimerEnd,
  onVotingTimerEnd,
  onNightTimerEnd,
  startVoting,
  castDayVote,
  castHangVote,
  submitNightAction,
  addChatMessage,
  addPrivateChatMessage,
  deleteChatMessage,
  clearRoomChat,
  addSystemMessage,
  announceRegistrationToIdleRooms,
  getChatMessageForModeration,
  getModerationSnapshot,
  resetRoom,
  stopRoomGame,
  serializeRoomForPlayer,
  renameRoom,
  reorderRoomsInMemory,
  addChatRoom,
  addClanRoom,
  addGameRoom,
  updateGameRoomAi,
  onRoomPhaseChange,
  onRegistrationRosterChange,
  clearUserSilenceInAllRooms,
  listSilencedPlayers,
  removeRoom,
  isChatRoom,
  isClanRoom,
  checkWin,
  isPlayerSilenced,
  setPlayerSilenceForUser,
  clearPlayerSilenceForUser,
  findRoomPlayer,
  addMutedOnlyMessage,
} from './game/engine.js';
import { createClansRouter } from './clans/routes.js';
import { canUserAccessClanRoom } from './clans/store.js';
import './clans/store.js';
import type { ChatChannel, GameRoom, GamePlayer, PrivateNote, PublicUser, RoomState, Session, User } from './types/index.js';
import { assertProductionEnv } from './config/env.js';
import { resolveClientIp } from './security/ip.js';
import { securityHeadersMiddleware } from './security/headers.js';
import { chatSocketRateLimiter } from './security/rateLimit.js';
import { normalizeChatText, normalizeModerationReason, parseViolationType } from './security/validate.js';
import { addViolation } from './moderation/violationLog.js';
import { addUserSanction, liftUserSanctions } from './moderation/sanctionLog.js';
import { AUTO_BLOCK_MESSAGES, detectChatViolation } from './moderation/advertising.js';
import fs from 'fs';
import { ensureNewsUploadsDir } from './upload/newsImage.js';
import { ensureSiteBrandingUploadsDir } from './upload/siteLogo.js';
import { ensureSupportUploadsDir } from './upload/supportImage.js';
import { initAllQuizRooms, initQuizRoom, handleQuizAnswer, isQuizRoom, setQuizBroadcaster } from './quiz/index.js';
import { initGameAiRunner, triggerGameAi, triggerBotChatResponse } from './game/ai/runner.js';
import { buildRobotsTxt, buildSecurityTxt, buildSitemapXml } from './seo/siteSeo.js';
import { sendSpaIndex } from './seo/spaHtml.js';
import { getProjectRoot } from './paths.js';
import { resolveDefaultAvatarFile } from './auth/defaultAvatarFiles.js';

assertProductionEnv();

const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(securityHeadersMiddleware);
app.use('/api', corsOrigin?.length ? cors({ origin: corsOrigin, credentials: true }) : cors());
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
  if (isChatRoom(room) && room.chat.length === 0 && !/викторин/i.test(room.name)) {
    addSystemMessage(room, `Добро пожаловать в «${room.name}».`);
  }
}
setOnlineRoomResolver((userId) => {
  const locations: { id: number; name: string }[] = [];
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.userId === userId && p.connected)) {
      locations.push({ id: room.id, name: room.name });
    }
  }
  return locations;
});
const sessions = new Map<string, Session>();
const userSocketIds = new Map<number, Set<string>>();
const DEFAULT_CHAT_LIMIT = 15;
const MAX_CHAT_LIMIT = 300;

const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

function disconnectTimerKey(roomId: number, playerId: number): string {
  return `${roomId}:${playerId}`;
}

function cancelInactivityTimer(roomId: number, playerId: number): void {
  const key = disconnectTimerKey(roomId, playerId);
  const timer = inactivityTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    inactivityTimers.delete(key);
  }
}

function cancelDisconnectTimer(roomId: number, playerId: number): void {
  const key = disconnectTimerKey(roomId, playerId);
  const timer = disconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(key);
  }
  cancelInactivityTimer(roomId, playerId);
}

function scheduleInactivityAnnounce(roomId: number, playerId: number): void {
  cancelInactivityTimer(roomId, playerId);
  const key = disconnectTimerKey(roomId, playerId);
  const timer = setTimeout(() => {
    inactivityTimers.delete(key);
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.connected) return;
    if (!isChatRoom(room) && isActiveGamePhase(room.phase) && player.inGame && player.alive) {
      announcePlayerDisconnected(room, playerId);
      scheduleDisconnectTimer(roomId, playerId);
    }
  }, CONFIG.INACTIVITY_ANNOUNCE_SEC * 1000);
  inactivityTimers.set(key, timer);
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
  res.json({ ok: true });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send(buildRobotsTxt());
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml; charset=utf-8');
  res.send(buildSitemapXml());
});

app.get(['/.well-known/security.txt', '/security.txt'], (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buildSecurityTxt());
});

app.get('/api/default-avatars/:filename', (req, res) => {
  const file = resolveDefaultAvatarFile(req.params.filename);
  if (!file) {
    res.status(404).end();
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.type(file.endsWith('.png') ? 'image/png' : 'image/svg+xml');
  res.sendFile(file);
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(
  '/api/profile',
  createProfileRouter({ onProfileUpdated: syncUserProfileInRooms })
);
app.use('/api/friends', friendsRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/news', createNewsRouter());
app.use('/api/blog', createBlogRouter());
app.use(
  '/api/clans',
  createClansRouter({
    createClanRoom: (name) => addClanRoom(rooms, name),
    removeClanRoom: (roomId) => {
      removeRoom(rooms, roomId);
    },
    clearClanRoomChat: (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.kind !== 'clan') {
        throw new Error('Комната клана не найдена');
      }
      clearRoomChat(room, 'История чата очищена главой клана.');
      broadcastRoom(roomId);
    },
    broadcastLobby: () => broadcastLobby(),
  })
);
app.use(
  '/uploads/avatars',
  (_req, res, next) => {
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(uploadsDir)
);

const newsUploadsDir = ensureNewsUploadsDir();
if (!fs.existsSync(newsUploadsDir)) fs.mkdirSync(newsUploadsDir, { recursive: true });
app.use(
  '/uploads/news',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(newsUploadsDir)
);

const siteBrandingUploadsDir = ensureSiteBrandingUploadsDir();
if (!fs.existsSync(siteBrandingUploadsDir)) fs.mkdirSync(siteBrandingUploadsDir, { recursive: true });
app.use(
  '/uploads/branding',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(siteBrandingUploadsDir)
);

const supportUploadsDir = ensureSupportUploadsDir();
if (!fs.existsSync(supportUploadsDir)) fs.mkdirSync(supportUploadsDir, { recursive: true });
app.use(
  '/uploads/support',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(supportUploadsDir)
);

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
    if (!player.socketId) continue;
    io.to(player.socketId).emit('room:kicked', {
      reason: 'Комната удалена администратором',
      roomId: room.id,
    });
    const session = sessions.get(player.socketId);
    if (session?.roomId === room.id) {
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

function adminDeleteRoom(roomId: number, expectedKind: 'game' | 'chat'): void {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Комната не найдена');
  if (room.kind !== expectedKind) {
    throw new Error(
      expectedKind === 'chat'
        ? 'Это игровая комната — используйте удаление в разделе «Комнаты мафии»'
        : 'Это чат-комната — используйте удаление в разделе «Чат-комнаты»'
    );
  }
  const existing = pendingRoomClears.get(roomId);
  if (existing) {
    clearTimeout(existing.warningTimer);
    clearTimeout(existing.clearTimer);
    pendingRoomClears.delete(roomId);
  }
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
    reorderRooms: (kind, roomIds) => reorderRoomsInMemory(rooms, kind, roomIds),
    addChatRoom: (name) => {
      const room = addChatRoom(rooms, name);
      if (isQuizRoom(room)) initQuizRoom(room);
      return room;
    },
    addGameRoom: (name, options) => addGameRoom(rooms, name, options),
    updateGameRoomAi: (roomId, aiEnabled, aiCount) =>
      updateGameRoomAi(rooms, roomId, aiEnabled, aiCount),
    stopGameRoom: (roomId) => {
      const room = rooms.get(roomId);
      if (!room) throw new Error('Комната не найдена');
      stopRoomGame(room);
      return room;
    },
    deleteChatRoom: (id) => adminDeleteRoom(id, 'chat'),
    deleteGameRoom: (id) => adminDeleteRoom(id, 'game'),
    listSilencedPlayers: () => listSilencedPlayers(rooms),
    clearUserSilence: (userId) => clearUserSilenceInAllRooms(rooms, userId),
    onRoomsChanged,
    syncUserInRooms,
    onUserBanned: handleUserBanned,
    onUserRoleChanged: (userId) => {
      disconnectUserSockets(userId, 'Права доступа изменены. Войдите снова.');
    },
    getGameEvents: () => getRecentGameEvents(40),
    getChatHistory: (roomId) => getAdminChatHistory(roomId, 300),
    getRoomGameEvents: (roomId) => loadGameEvents(roomId, 50),
  })
);
app.use('/api/moderation', createModerationRouter({ onUserBanned: handleUserBanned }));

function notifyMailReceived(
  recipientId: number,
  payload: {
    fromUserId: number;
    fromUsername: string;
    fromDisplayName: string;
    preview: string;
    unreadCount: number;
  }
): void {
  notifyUser(recipientId, 'pm:received', payload);
  try {
    pushMailNotification(recipientId, {
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername,
      fromDisplayName: payload.fromDisplayName,
      preview: payload.preview,
    });
  } catch (err) {
    console.error('Failed to store mail notification:', err);
  }
}

app.use(
  '/api/messages',
  createMessagesRouter({
    onMessageSent: (recipientId, payload) => {
      notifyMailReceived(recipientId, payload);
    },
    onMessageRead: (userId, unreadCount) => {
      notifyUser(userId, 'pm:unread', { count: unreadCount });
    },
    onOutgoingRead: (senderId, payload) => {
      notifyUser(senderId, 'pm:read', payload);
    },
  })
);
app.use(
  '/api/support',
  createSupportRouter({
    onMessageSent: (recipientId, payload) => {
      notifyMailReceived(recipientId, payload);
    },
  })
);

function attachUserSocket(userId: number, socketId: string): void {
  if (!userSocketIds.has(userId)) userSocketIds.set(userId, new Set());
  userSocketIds.get(userId)!.add(socketId);
  markUserConnected(userId);
  broadcastLobby();
}

function detachUserSocket(userId: number, socketId: string): void {
  const set = userSocketIds.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSocketIds.delete(userId);
  markUserDisconnected(userId);
  broadcastLobby();
}

function disconnectUserSockets(userId: number, reason: string): void {
  const socketIds = userSocketIds.get(userId);
  if (!socketIds) return;
  for (const socketId of [...socketIds]) {
    io.to(socketId).emit('auth:kicked', { reason });
    io.sockets.sockets.get(socketId)?.disconnect(true);
  }
}

function handleUserBanned(userId: number, reason: string, until: string | null): void {
  notifyRoomOfUserBan(userId, reason, until);
  disconnectUserSockets(
    userId,
    `Аккаунт заблокирован${reason ? `: ${reason}` : ''}`
  );
}

function requireSocketUser(
  socket: Socket,
  cb?: (res: { error?: string }) => void
): User | null {
  const user = refreshSocketUser(socket);
  if (!user) {
    socket.emit('auth:kicked', { reason: 'Сессия завершена или аккаунт заблокирован' });
    socket.disconnect(true);
    cb?.({ error: 'Сессия завершена' });
    return null;
  }
  return user;
}

function requireRoomPlayer(
  socket: Socket,
  cb?: (res: { error?: string }) => void
): { session: Session; room: GameRoom; me: GamePlayer } | null {
  const user = requireSocketUser(socket, cb);
  if (!user) return null;

  const session = sessions.get(socket.id);
  if (!session) {
    cb?.({ error: 'Вы не в комнате' });
    return null;
  }
  const room = rooms.get(session.roomId);
  if (!room) {
    cb?.({ error: 'Комната не найдена' });
    return null;
  }
  const me = room.players.find((p) => p.id === session.playerId);
  if (!me) {
    cb?.({ error: 'Игрок не найден' });
    return null;
  }
  return { session, room, me };
}

function requireSocketStaff(
  socket: Socket,
  cb?: (res: { error?: string }) => void
): User | null {
  const user = requireSocketUser(socket, cb);
  if (!user) return null;
  if (!isStaff(user)) {
    cb?.({ error: 'Нет доступа' });
    return null;
  }
  return user;
}

function requireSocketSilenceModerator(
  socket: Socket,
  cb?: (res: { error?: string }) => void
): User | null {
  const user = requireSocketUser(socket, cb);
  if (!user) return null;
  if (!canModerateSilence(user)) {
    cb?.({ error: 'Нет доступа' });
    return null;
  }
  return user;
}

/** Auto-log + block ads/profanity/spam. Staff bypass. Returns true if blocked. */
function blockAutoModerationChat(input: {
  user: User;
  text: string;
  roomId: number;
  roomName: string;
  channel: string;
  authorName: string;
  authorUserId: number | null;
  cb?: (res: { error?: string; ok?: boolean }) => void;
}): boolean {
  if (isStaff(input.user)) return false;
  const violationType = detectChatViolation(input.text);
  if (!violationType) return false;

  addViolation({
    violationType,
    messageText: input.text,
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    roomId: input.roomId,
    roomName: input.roomName,
    channel: input.channel,
    messageId: `auto-${Date.now()}-${input.authorUserId ?? 0}`,
    moderatorId: 0,
    moderatorName: 'Авто',
    messageAt: new Date().toISOString(),
  });

  const place =
    input.channel === 'mail' || input.roomId === 0
      ? 'Письма'
      : `${input.roomName}`;
  pushStaffAutoModerationAlert({
    violationType,
    authorName: input.authorName,
    authorUserId: input.authorUserId,
    preview: input.text,
    place,
    staffUserIds: listStaffUsers().map((s) => s.id),
  });

  input.cb?.({ error: AUTO_BLOCK_MESSAGES[violationType] });
  return true;
}

function userRoom(userId: number): string {
  return `user:${userId}`;
}

function notifyUser(userId: number, event: string, data: unknown): void {
  io.to(userRoom(userId)).emit(event, data);
}

initNotificationPush(notifyUser);

function serializeForSocketUser(
  room: GameRoom,
  gamePlayerId: number,
  userId: number | undefined,
  socketId: string | null = null
): RoomState {
  const session = socketId ? sessions.get(socketId) : undefined;
  const chatLimit = resolveSessionChatLimit(session, userId);
  const acc = userId ? findUserById(userId) : undefined;
  const state = serializeRoomForPlayer(room, gamePlayerId, {
    isAdmin: isAdmin(acc),
    canModerate: isStaff(acc),
    canSilence: canModerateSilence(acc),
    chatLimit,
  });

  if (!isQuizRoom(room)) return state;
  return { ...state, isQuizRoom: true };
}

function syncRoomScores(room: GameRoom): void {
  if (room.phase !== 'ended' || room.scoresSynced) return;
  recordRoomGameResults(room);
  for (const p of room.players) {
    if (p.userId && p.score !== 0) {
      updateUserScore(p.userId, p.score);
    }
  }
  room.scoresSynced = true;
}

function getLobbyPayload() {
  return {
    rooms: getLobbySnapshot(rooms),
    onlineCount: getOnlineUserCount(),
    siteStats: getPublicSiteStats(),
  };
}

function broadcastLobby(): void {
  io.emit('lobby:update', getLobbyPayload());
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

setQuizBroadcaster((roomId) => broadcastRoom(roomId));
initGameAiRunner((roomId) => broadcastRoom(roomId));
onRoomPhaseChange((room) => {
  triggerGameAi(room);
  if (room.phase !== PHASE.REGISTRATION) return;
  for (const roomId of announceRegistrationToIdleRooms(rooms, room)) {
    broadcastRoom(roomId);
  }
});
onRegistrationRosterChange((room) => broadcastRoom(room.id));
initAllQuizRooms(rooms.values());

function deliverHostNotes(room: GameRoom, privateNotes: PrivateNote[] = []): void {
  if (isChatRoom(room) || privateNotes.length === 0) return;
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
    } else if (reason === 'voting') {
      privateNotes = onVotingTimerEnd(room);
    } else if (reason === 'night') {
      const result = onNightTimerEnd(room);
      if (result?.privateNotes) privateNotes = result.privateNotes;
    }

    deliverHostNotes(room, privateNotes);
    broadcastRoom(room.id);
  }
}, 1000);

function getClientIp(socket: Socket): string {
  return resolveClientIp(socket.handshake.address, socket.handshake.headers);
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
  void socket.join(userRoom(socket.userId!));
  socket.emit('pm:unread', { count: getUnreadCount(socket.userId!) });
  socket.emit('notification:sync', {
    notifications: listNotifications(socket.userId!, 40),
    unreadCount: getUnreadNotificationCount(socket.userId!),
  });

  socket.emit('lobby:update', getLobbyPayload());

  socket.on('lobby:get', () => {
    if (!requireSocketUser(socket)) return;
    socket.emit('lobby:update', getLobbyPayload());
  });

  socket.on('presence:where', ({ section }) => {
    if (!requireSocketUser(socket)) return;
    setUserSection(socket.userId!, section);
  });

  socket.on('room:join', ({ roomId, playerId: reconnectId }, cb) => {
    if (!requireSocketUser(socket, cb)) return;
    try {
      const room = rooms.get(Number(roomId));
      if (!room) return cb?.({ error: 'Комната не найдена' });

      if (isClanRoom(room) && socket.userId && !canUserAccessClanRoom(room.id, socket.userId)) {
        return cb?.({ error: 'Комната доступна только членам клана' });
      }

      const previous = sessions.get(socket.id);
      const leavingPrevious = previous && previous.roomId !== room.id;

      const playerName = socket.displayName!;
      const playerUsername = socket.username!;
      let player;
      let joinPrivateNotes: PrivateNote[] = [];

      if (reconnectId) {
        const candidate = room.players.find((p) => p.id === Number(reconnectId));
        if (candidate && candidate.userId === socket.userId) {
          const reconnected = reconnectPlayer(
            room,
            Number(reconnectId),
            socket.id,
            playerName,
            playerUsername
          );
          player = reconnected.player;
        }
      }
      if (!player && socket.userId) {
        const existing = room.players.find((p) => p.userId === socket.userId);
        if (existing) {
          player = reconnectPlayer(room, existing.id, socket.id, playerName, playerUsername).player;
        }
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

      if (leavingPrevious && previous) {
        const prevRoom = rooms.get(previous.roomId);
        socket.leave(`room:${previous.roomId}`);
        if (prevRoom) {
          cancelDisconnectTimer(previous.roomId, previous.playerId);
          removePlayer(prevRoom, socket.id, false);
        }
      }

      attachSession(socket.id, room.id, player.id, socket.userId);
      socket.join(`room:${room.id}`);
      if (joinPrivateNotes.length) {
        deliverHostNotes(room, joinPrivateNotes);
      }
      if (leavingPrevious && previous) {
        broadcastRoom(previous.roomId);
      }
      broadcastRoom(room.id);
      cb?.({ ok: true, playerId: player.id, state: serializeForSocketUser(room, player.id, socket.userId, socket.id) });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('room:detach', (_data, cb) => {
    if (!requireSocketUser(socket, cb)) return;
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ ok: true });

    const room = rooms.get(session.roomId);
    if (room) {
      cancelDisconnectTimer(session.roomId, session.playerId);
      removePlayer(room, socket.id, false);
      broadcastRoom(session.roomId);
    }

    socket.leave(`room:${session.roomId}`);
    sessions.delete(socket.id);
    cb?.({ ok: true });
  });

  socket.on('room:start', (_data, cb) => {
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;
    if (isChatRoom(room)) return cb?.({ error: 'В чат-комнате нельзя запустить игру' });
    if (room.phase !== PHASE.WAITING && room.phase !== PHASE.ENDED) {
      return cb?.({ error: 'Игра уже идёт' });
    }
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
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;
    if (isChatRoom(room)) return cb?.({ error: 'В чат-комнате нет игры' });
    try {
      const { privateNotes } = joinGame(room, session.playerId);
      deliverHostNotes(room, privateNotes);
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

  socket.on('room:leaveGame', (_data, cb) => {
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;
    if (isChatRoom(room)) return cb?.({ error: 'В чат-комнате нет игры' });
    try {
      leaveGame(room, session.playerId);
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

  socket.on('room:loadMoreChat', (_data, cb) => {
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;

    // Шаг = настройка «сообщений на страницу» (15/30/50/100).
    const pageSize = getUserChatLimit(socket.userId);
    session.chatLimit = Math.min(
      MAX_CHAT_LIMIT,
      resolveSessionChatLimit(session, socket.userId) + pageSize
    );
    socket.emit(
      'room:state',
      serializeForSocketUser(room, session.playerId, socket.userId, socket.id)
    );
    cb?.({ ok: true });
  });

  socket.on('room:newGame', (_data, cb) => {
    const user = requireSocketUser(socket, cb);
    if (!user) return;
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { room } = ctx;
    if (isChatRoom(room)) return cb?.({ error: 'В чат-комнате нет игры' });
    if (room.phase !== PHASE.ENDED && !isAdmin(user)) {
      return cb?.({ error: 'Новую игру можно начать только после окончания партии' });
    }
    resetRoom(room);
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('chat:send', ({ text, toPlayerId, toUserId, isPrivate }, cb) => {
    const user = requireSocketUser(socket, cb);
    if (!user) return;
    if (!chatSocketRateLimiter.try(`chat:${user.id}`)) {
      return cb?.({ error: 'Слишком много сообщений. Подождите.' });
    }

    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room, me } = ctx;

    const trimmed = normalizeChatText(text);
    if (!trimmed) return cb?.({ error: 'Пустое сообщение' });

    const authorName = me.username || me.name;
    const authorUserId = me.userId ?? user.id;

    const targetPlayer = findRoomPlayer(room, {
      playerId: toPlayerId != null ? Number(toPlayerId) : undefined,
      userId: toUserId != null ? Number(toUserId) : undefined,
    });
    const hasTarget =
      targetPlayer != null &&
      targetPlayer.id !== session.playerId &&
      (toPlayerId != null || toUserId != null);

    if (isPrivate && hasTarget) {
      if (
        blockAutoModerationChat({
          user,
          text: trimmed,
          roomId: room.id,
          roomName: room.name,
          channel: 'private',
          authorName,
          authorUserId,
          cb,
        })
      ) {
        return;
      }
      if (isPlayerSilenced(me)) {
        addMutedOnlyMessage(room, me, trimmed, 'private');
        broadcastRoom(room.id);
        return cb?.({ ok: true });
      }
      const msg = addPrivateChatMessage(room, session.playerId, targetPlayer!.id, trimmed);
      if (!msg) return cb?.({ error: 'Не удалось отправить' });
      broadcastRoom(room.id);
      return cb?.({ ok: true });
    }

    if (isPrivate && (toPlayerId != null || toUserId != null) && !targetPlayer) {
      return cb?.({ error: 'Получатель не найден' });
    }

    const gameRunning = isActiveGamePhase(room.phase);
    const isSpectator = !isChatRoom(room) && !me.inGame && gameRunning;

    let channel: ChatChannel = 'public';
    if (isChatRoom(room)) {
      channel = 'public';
    } else if (room.phase === PHASE.ENDED) {
      channel = 'public';
    } else if (isSpectator) {
      channel = 'spectator';
    } else if (gameRunning && me.inGame && me.role) {
      channel = me.alive ? 'public' : 'dead';
    }

    if (
      blockAutoModerationChat({
        user,
        text: trimmed,
        roomId: room.id,
        roomName: room.name,
        channel,
        authorName,
        authorUserId,
        cb,
      })
    ) {
      return;
    }

    if (isPlayerSilenced(me)) {
      addMutedOnlyMessage(room, me, trimmed, channel);
      broadcastRoom(room.id);
      return cb?.({ ok: true });
    }

    const msg = addChatMessage(room, session.playerId, trimmed, channel, {
      toPlayerId: hasTarget ? targetPlayer!.id : undefined,
    });
    if (!msg) return cb?.({ error: 'Не удалось отправить' });

    if (isQuizRoom(room)) {
      handleQuizAnswer(room, me.userId ?? null, me.username || me.name, trimmed);
    }

    if (
      channel === 'public' &&
      !isChatRoom(room) &&
      room.aiEnabled &&
      !me.isBot &&
      (room.phase === PHASE.REGISTRATION ||
        room.phase === PHASE.DAY ||
        room.phase === PHASE.VOTING)
    ) {
      triggerBotChatResponse(room, me, trimmed, msg);
    }

    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('chat:mafia', ({ text }, cb) => {
    const user = requireSocketUser(socket, cb);
    if (!user) return;
    if (!chatSocketRateLimiter.try(`mafia:${user.id}`)) {
      return cb?.({ error: 'Слишком много сообщений. Подождите.' });
    }

    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room, me } = ctx;
    if (!isMafiaTeam(me.role) || !me.alive) return cb?.({ error: 'Нет доступа' });

    const trimmed = normalizeChatText(text);
    if (!trimmed) return cb?.({ error: 'Пустое сообщение' });

    if (
      blockAutoModerationChat({
        user,
        text: trimmed,
        roomId: room.id,
        roomName: room.name,
        channel: 'mafia',
        authorName: me.username || me.name,
        authorUserId: me.userId ?? user.id,
        cb,
      })
    ) {
      return;
    }

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
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { room, me } = ctx;
    if (!me.inGame || !me.alive) return cb?.({ error: 'Нет доступа' });
    if (room.phase !== PHASE.DAY) return cb?.({ error: 'Голосование можно начать только днём' });
    if (room.votingStarted) return cb?.({ error: 'Голосование уже началось' });
    const notes = startVoting(room);
    deliverHostNotes(room, notes);
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('game:vote', ({ targetId, confirmed }, cb) => {
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;
    try {
      const notes =
        room.votingStage === 'confirm'
          ? castHangVote(room, session.playerId, confirmed === true)
          : castDayVote(room, session.playerId, targetId, confirmed === true);
      deliverHostNotes(room, notes);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('game:hangVote', ({ yes }, cb) => {
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;
    try {
      const notes = castHangVote(room, session.playerId, yes === true);
      deliverHostNotes(room, notes);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('game:nightAction', (action, cb) => {
    const ctx = requireRoomPlayer(socket, cb);
    if (!ctx) return;
    const { session, room } = ctx;
    try {
      const result = submitNightAction(room, session.playerId, action);
      deliverHostNotes(room, result?.privateNotes || []);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('admin:deleteMessage', ({ messageId, channel, violationType }, cb) => {
    const staff = requireSocketStaff(socket, cb);
    if (!staff) return;
    const vType = parseViolationType(violationType);
    if (!vType) return cb?.({ error: 'Укажите тип нарушения' });

    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });
    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });

    const chatChannel = (channel || 'public') as ChatChannel;
    const msg = getChatMessageForModeration(room, String(messageId), chatChannel);
    if (!msg) return cb?.({ error: 'Сообщение не найдено' });

    addViolation({
      violationType: vType,
      messageText: msg.text,
      authorUserId: msg.userId ?? null,
      authorName: msg.playerName,
      roomId: room.id,
      roomName: room.name,
      channel: chatChannel,
      messageId: String(messageId),
      moderatorId: staff.id,
      messageAt: msg.time || null,
    });

    const ok = deleteChatMessage(room, String(messageId), chatChannel);
    if (!ok) return cb?.({ error: 'Сообщение не найдено' });
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('mod:silence', ({ targetPlayerId, targetUserId, reason, minutes }, cb) => {
    if (!requireSocketSilenceModerator(socket, cb)) return;
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });

    const staffUser = findUserById(socket.userId!);
    const target = findRoomPlayer(room, {
      playerId: targetPlayerId,
      userId: targetUserId,
    });
    if (!target?.userId) return cb?.({ error: 'Игрок не найден в комнате' });

    const targetUser = findUserById(target.userId);
    if (!staffUser || !targetUser || !canSilenceTarget(staffUser, targetUser)) {
      return cb?.({ error: 'Нет прав для молчания этого игрока' });
    }

    try {
      const minutesNum = minutes && Number(minutes) > 0 ? Number(minutes) : null;
      setPlayerSilenceForUser(
        room,
        { playerId: target.id, userId: target.userId },
        minutesNum,
        String(normalizeModerationReason(reason))
      );
      const duration =
        minutesNum && minutesNum > 0 ? `на ${minutesNum} мин.` : 'бессрочно';
      const reasonText = normalizeModerationReason(reason) || 'нарушение правил';
      addSystemMessage(
        room,
        `🔇 ${target.username || target.name} получил(а) молчание (${duration}). Причина: ${reasonText}.`
      );
      let untilAt: string | null = null;
      if (minutesNum && minutesNum > 0) {
        untilAt = new Date(Date.now() + minutesNum * 60000).toISOString();
      }
      addUserSanction({
        userId: target.userId,
        sanctionType: 'silence',
        reason: reasonText,
        moderatorId: staffUser.id,
        moderatorName: staffUser.username,
        roomId: room.id,
        roomName: room.name,
        untilAt,
      });
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      const err = e as Error;
      cb?.({ error: err.message });
    }
  });

  socket.on('mod:unsilence', ({ targetPlayerId, targetUserId }, cb) => {
    if (!requireSocketSilenceModerator(socket, cb)) return;
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    if (!room) return cb?.({ error: 'Комната не найдена' });

    const staffUser = findUserById(socket.userId!);
    const target = findRoomPlayer(room, {
      playerId: targetPlayerId,
      userId: targetUserId,
    });
    if (!target?.userId) return cb?.({ error: 'Игрок не найден в комнате' });

    const targetUser = findUserById(target.userId);
    if (!staffUser || !targetUser || !canSilenceTarget(staffUser, targetUser)) {
      return cb?.({ error: 'Нет прав' });
    }

    try {
      clearPlayerSilenceForUser(room, { playerId: target.id, userId: target.userId });
      liftUserSanctions(target.userId, 'silence');
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
      scheduleInactivityAnnounce(room.id, player.id);
    }

    broadcastRoom(room.id);
  });
});

// Отдаём собранный React-клиент (client/dist)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = __dirname.endsWith(`${path.sep}dist`) ? path.join(__dirname, '..') : __dirname;
const clientDist = path.join(serverRoot, '..', 'client', 'dist');

const defaultAvatarsDir = [path.join(clientDist, 'avatars'), path.join(getProjectRoot(), 'client', 'public', 'avatars')].find(
  (dir) => fs.existsSync(dir)
);
if (defaultAvatarsDir) {
  app.use(
    '/avatars',
    express.static(defaultAvatarsDir, {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      },
    })
  );
}

app.use(
  express.static(clientDist, {
    setHeaders(res, filePath) {
      const relative = path.relative(clientDist, filePath).replace(/\\/g, '/');
      if (relative.startsWith('assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (relative.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  })
);
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/socket.io') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/avatars/')
  ) {
    return next();
  }
  sendSpaIndex(req, res, clientDist);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎭 Mafia server: http://localhost:${PORT}`);
  console.log(`   Комнат: ${CONFIG.ROOM_COUNT}, игроков: ${CONFIG.MIN_PLAYERS}–${CONFIG.MAX_PLAYERS}`);
  console.log(`   Static: ${clientDist}`);
  void import('./telegram/bot.js').then(({ startTelegramBot }) => startTelegramBot());
  void import('./backup/schedule.js').then(({ startBackupScheduler }) => startBackupScheduler());
});
