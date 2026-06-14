import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CONFIG } from './game/config.js';
import {
  createInitialRooms,
  getLobbySnapshot,
  addPlayerToRoom,
  removePlayer,
  reconnectPlayer,
  startRegistration,
  tryStartGameAfterRegistration,
  onRegistrationTimerEnd,
  onDayTimerEnd,
  onNightTimerEnd,
  startVoting,
  castDayVote,
  submitNightAction,
  addChatMessage,
  resetRoom,
  serializeRoomForPlayer,
} from './game/engine.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = createInitialRooms();
// socketId -> { roomId, playerId }
const sessions = new Map();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: getLobbySnapshot(rooms) });
});

function broadcastLobby() {
  io.emit('lobby:update', getLobbySnapshot(rooms));
}

function broadcastRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit('room:state', serializeRoomForPlayer(room, player.id));
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

io.on('connection', (socket) => {
  socket.emit('lobby:update', getLobbySnapshot(rooms));

  socket.on('lobby:get', () => {
    socket.emit('lobby:update', getLobbySnapshot(rooms));
  });

  socket.on('room:join', ({ roomId, playerName, playerId: reconnectId }, cb) => {
    try {
      const room = rooms.get(Number(roomId));
      if (!room) return cb?.({ error: 'Комната не найдена' });

      let player;
      if (reconnectId) {
        player = reconnectPlayer(room, reconnectId, socket.id, playerName);
      }
      if (!player) {
        player = addPlayerToRoom(room, { name: playerName, socketId: socket.id });
      }

      attachSession(socket, room.id, player.id);
      broadcastRoom(room.id);
      cb?.({ ok: true, playerId: player.id, state: serializeRoomForPlayer(room, player.id) });
    } catch (e) {
      cb?.({ error: e.message });
    }
  });

  socket.on('room:start', (_data, cb) => {
    const session = sessions.get(socket.id);
    if (!session) return cb?.({ error: 'Вы не в комнате' });

    const room = rooms.get(session.roomId);
    try {
      startRegistration(room);
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
    const msg = addChatMessage(room, session.playerId, text, 'public');
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

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.roomId);
    removePlayer(room, socket.id, true);
    sessions.delete(socket.id);
    broadcastRoom(room.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎭 Mafia server: http://localhost:${PORT}`);
  console.log(`   Комнат: ${CONFIG.ROOM_COUNT}, игроков: ${CONFIG.MIN_PLAYERS}–${CONFIG.MAX_PLAYERS}`);
});
