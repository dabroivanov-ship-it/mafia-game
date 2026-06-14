import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './game/config.js';
import authRoutes from './auth/routes.js';
import profileRoutes from './profile/routes.js';
import { createAdminRouter } from './admin/routes.js';
import { socketAuthMiddleware } from './auth/jwt.js';
import { findUserById, updateUserScore, isAdmin, uploadsDir } from './auth/db.js';
import { hydrateRoomHistory, loadGameEvents, getRecentGameEvents, getAdminChatHistory, getRecentChatForAdmin } from './history/store.js';
import {
  createInitialRooms,
  getLobbySnapshot,
  addPlayerToRoom,
  removePlayer,
  reconnectPlayer,
  startRegistration,
  joinGame,
  tryStartGameAfterRegistration,
  onRegistrationTimerEnd,
  onDayTimerEnd,
  onNightTimerEnd,
  startVoting,
  castDayVote,
  submitNightAction,
  addChatMessage,
  deleteChatMessage,
  getModerationSnapshot,
  resetRoom,
  serializeRoomForPlayer,
  renameRoom,
  addRoom,
  removeRoom,
} from './game/engine.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = createInitialRooms();
for (const room of rooms.values()) {
  hydrateRoomHistory(room);
}
// socketId -> { roomId, playerId }
const sessions = new Map();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: getLobbySnapshot(rooms) });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/uploads/avatars', express.static(uploadsDir));

function adminDeleteMessage(roomId, messageId, channel) {
  const room = rooms.get(roomId);
  if (!room) return false;
  const ok = deleteChatMessage(room, messageId, channel);
  if (ok) broadcastRoom(roomId);
  return ok;
}

function kickPlayersFromRoom(room) {
  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit('room:kicked', { reason: 'Комната удалена администратором' });
      sessions.delete(player.socketId);
    }
  }
}

function onRoomsChanged(changedRoomId = null) {
  broadcastLobby();
  if (changedRoomId != null) {
    broadcastRoom(changedRoomId);
    return;
  }
  for (const room of rooms.values()) {
    broadcastRoom(room.id);
  }
}

function adminDeleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Комната не найдена');
  kickPlayersFromRoom(room);
  removeRoom(rooms, roomId);
}

function syncUserInRooms(userId, displayName) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      player.name = displayName;
      if (player.socketId) {
        io.to(player.socketId).emit(
          'room:state',
          serializeForSocketUser(room, player.id, userId)
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
    renameRoom: (id, name) => renameRoom(rooms, id, name),
    addRoom: (name) => addRoom(rooms, name),
    deleteRoom: (id) => adminDeleteRoom(id),
    onRoomsChanged,
    syncUserInRooms,
    getGameEvents: () => getRecentGameEvents(40),
    getChatHistory: (roomId) => getAdminChatHistory(roomId, 300),
    getRoomGameEvents: (roomId) => loadGameEvents(roomId, 50),
  })
);

function serializeForSocketUser(room, gamePlayerId, userId) {
  const acc = userId ? findUserById(userId) : null;
  return serializeRoomForPlayer(room, gamePlayerId, { isAdmin: isAdmin(acc) });
}

function syncRoomScores(room) {
  if (room.phase !== 'ended' || room.scoresSynced) return;
  for (const p of room.players) {
    if (p.userId && p.score !== 0) {
      updateUserScore(p.userId, p.score);
    }
  }
  room.scoresSynced = true;
}

function broadcastLobby() {
  io.emit('lobby:update', getLobbySnapshot(rooms));
}

function broadcastRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  syncRoomScores(room);

  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit(
        'room:state',
        serializeForSocketUser(room, player.id, player.userId)
      );
    }
  }
  broadcastLobby();
}

function sendPrivateNotes(room, privateNotes = []) {
  for (const note of privateNotes) {
    const p = room.players.find((pl) => pl.id === note.playerId);
    if (p?.socketId) {
      io.to(p.socketId).emit('notification:private', { message: note.message });
    }
  }
}

function attachSession(socket, roomId, playerId) {
  sessions.set(socket.id, { roomId, playerId });
  socket.join(`room:${roomId}`);
}

// Таймеры комнат — проверка каждую секунду
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.timerEnd || Date.now() < room.timerEnd) continue;

    const reason = room.timerReason;
    let privateNotes = [];
    if (reason === 'registration') {
      onRegistrationTimerEnd(room);
      tryStartGameAfterRegistration(room);
    } else if (reason === 'day') {
      onDayTimerEnd(room);
    } else if (reason === 'night') {
      const result = onNightTimerEnd(room);
      if (result?.privateNotes) privateNotes = result.privateNotes;
    }

    broadcastRoom(room.id);
    sendPrivateNotes(room, privateNotes);
  }
}, 1000);

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const user = findUserById(socket.userId);
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.displayName = user.display_name;
  socket.username = user.username;
  socket.isAdmin = isAdmin(user);

  socket.emit('lobby:update', getLobbySnapshot(rooms));

  socket.on('lobby:get', () => {
    socket.emit('lobby:update', getLobbySnapshot(rooms));
  });

  socket.on('room:join', ({ roomId, playerId: reconnectId }, cb) => {
    try {
      const room = rooms.get(Number(roomId));
      if (!room) return cb?.({ error: 'Комната не найдена' });

      const playerName = socket.displayName;
      const playerUsername = socket.username;
      let player;

      if (reconnectId) {
        player = reconnectPlayer(room, reconnectId, socket.id, playerName, playerUsername);
      }
      if (!player) {
        player = addPlayerToRoom(room, {
          name: playerName,
          username: playerUsername,
          socketId: socket.id,
          userId: socket.userId,
        });
      }

      attachSession(socket, room.id, player.id);
      broadcastRoom(room.id);
      cb?.({ ok: true, playerId: player.id, state: serializeForSocketUser(room, player.id, socket.userId) });
    } catch (e) {
      cb?.({ error: e.message });
    }
  });

  socket.on('room:start', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    try {
      startRegistration(room, session.playerId);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ error: e.message });
    }
  });

  socket.on('room:joinGame', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    try {
      joinGame(room, session.playerId);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ error: e.message });
    }
  });

  socket.on('room:newGame', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    resetRoom(room);
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('chat:send', ({ text }, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    const me = room.players.find((p) => p.id === session.playerId);
    if (!me) return cb?.({ error: 'Игрок не найден' });

    const gameRunning = !['waiting', 'ended'].includes(room.phase);
    const isSpectator = !me.inGame && gameRunning;

    let channel = 'public';
    if (isSpectator) {
      channel = 'spectator';
    } else if (gameRunning && me.inGame && me.role) {
      channel = me.alive ? 'public' : 'dead';
    }

    const msg = addChatMessage(room, session.playerId, text, channel);
    if (!msg) return cb?.({ error: 'Не удалось отправить' });

    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('chat:mafia', ({ text }, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    const me = room.players.find((p) => p.id === session.playerId);
    if (me?.role !== 'mafia' || !me.alive) return cb?.({ error: 'Нет доступа' });

    addChatMessage(room, session.playerId, text, 'mafia');
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('game:startVoting', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    startVoting(room);
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('game:vote', ({ targetId }, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    try {
      castDayVote(room, session.playerId, targetId);
      broadcastRoom(room.id);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ error: e.message });
    }
  });

  socket.on('game:nightAction', (action, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    try {
      const result = submitNightAction(room, session.playerId, action);
      broadcastRoom(room.id);
      sendPrivateNotes(room, result?.privateNotes || []);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ error: e.message });
    }
  });

  socket.on('admin:deleteMessage', ({ messageId, channel }, cb) => {
    if (!socket.isAdmin) return cb?.({ error: 'Нет доступа' });
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });
    const room = rooms.get(session.roomId);
    const ok = deleteChatMessage(room, messageId, channel || 'public');
    if (!ok) return cb?.({ error: 'Сообщение не найдено' });
    broadcastRoom(room.id);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.roomId);
    removePlayer(room, socket.id, true);
    sessions.delete(socket.id);
    broadcastRoom(room.id);
  });
});

// Отдаём собранный React-клиент (client/dist)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');

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
