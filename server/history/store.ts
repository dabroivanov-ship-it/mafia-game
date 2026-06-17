import db from '../auth/db.js';
import type { ChatChannel, ChatMessage, GameRoom } from '../types/index.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS room_chat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    session_id INTEGER,
    msg_key TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL DEFAULT 'public',
    user_id INTEGER,
    player_name TEXT,
    text TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_room_chat_room ON room_chat_log(room_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_room_chat_user ON room_chat_log(user_id, created_at);

  CREATE TABLE IF NOT EXISTS room_game_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    session_id INTEGER,
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_room_game_room ON room_game_log(room_id, created_at);
`);

function migrateChatLogColumns(): void {
  const cols = db.prepare('PRAGMA table_info(room_chat_log)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('player_id')) {
    db.exec('ALTER TABLE room_chat_log ADD COLUMN player_id INTEGER');
  }
  if (!names.has('to_player_id')) {
    db.exec('ALTER TABLE room_chat_log ADD COLUMN to_player_id INTEGER');
  }
  if (!names.has('to_player_name')) {
    db.exec('ALTER TABLE room_chat_log ADD COLUMN to_player_name TEXT');
  }
  if (!names.has('is_private')) {
    db.exec('ALTER TABLE room_chat_log ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0');
  }
}

migrateChatLogColumns();

interface ChatRow {
  id: number;
  room_id: number;
  session_id: number | null;
  msg_key: string;
  channel: string;
  user_id: number | null;
  player_id: number | null;
  player_name: string | null;
  to_player_id: number | null;
  to_player_name: string | null;
  is_private: number;
  text: string;
  is_system: number;
  deleted: number;
  created_at: string;
}

interface GameEventRow {
  id: number;
  room_id: number;
  session_id: number | null;
  event_type: string;
  payload: string | null;
  created_at: string;
}

const SYSTEM_SENDER_NAME = '🛡️ Система';

function normalizeSystemSender(name: string | null | undefined): string {
  if (!name || name === '🤖 Ведущий') return SYSTEM_SENDER_NAME;
  return name;
}

function rowToMsg(row: ChatRow): ChatMessage {
  const isSystem = !!row.is_system;
  return {
    id: row.msg_key,
    dbId: row.id,
    playerId: row.player_id,
    userId: row.user_id,
    playerName: isSystem
      ? normalizeSystemSender(row.player_name)
      : row.player_name || '?',
    text: row.text,
    time: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
    system: isSystem,
    deleted: !!row.deleted,
    isPrivate: !!row.is_private,
    toPlayerId: row.to_player_id,
    toPlayerName: row.to_player_name,
  };
}

export function saveChatMessage(
  roomId: number,
  sessionId: number | null,
  msg: ChatMessage,
  channel: ChatChannel = 'public'
): void {
  db.prepare(
    `INSERT INTO room_chat_log (room_id, session_id, msg_key, channel, user_id, player_id, player_name, to_player_id, to_player_name, is_private, text, is_system, deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    roomId,
    sessionId || null,
    String(msg.id),
    channel,
    msg.userId || null,
    msg.playerId ?? null,
    msg.playerName || null,
    msg.toPlayerId ?? null,
    msg.toPlayerName ?? null,
    msg.isPrivate ? 1 : 0,
    msg.text,
    msg.system ? 1 : 0,
    msg.deleted ? 1 : 0,
    msg.time || new Date().toISOString()
  );
}

export function saveGameEvent(
  roomId: number,
  sessionId: number | null,
  eventType: string,
  payload: Record<string, unknown> = {}
): void {
  db.prepare(
    `INSERT INTO room_game_log (room_id, session_id, event_type, payload) VALUES (?, ?, ?, ?)`
  ).run(roomId, sessionId || null, eventType, JSON.stringify(payload));
}

export function markChatDeleted(msgKey: string): void {
  db.prepare(
    `UPDATE room_chat_log SET deleted = 1, text = ? WHERE msg_key = ?`
  ).run('[сообщение удалено модератором]', String(msgKey));
}

export function deleteRoomChatLog(roomId: number): void {
  db.prepare('DELETE FROM room_chat_log WHERE room_id = ?').run(roomId);
}

export function loadRoomChatHistory(
  roomId: number,
  limit = 300
): {
  chat: ChatMessage[];
  mafiaChat: ChatMessage[];
  deadChat: ChatMessage[];
  spectatorChat: ChatMessage[];
  privateChat: ChatMessage[];
} {
  const rows = db
    .prepare(
      `SELECT * FROM room_chat_log WHERE room_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(roomId, limit) as ChatRow[];
  rows.reverse();

  const chat: ChatMessage[] = [];
  const mafiaChat: ChatMessage[] = [];
  const deadChat: ChatMessage[] = [];
  const spectatorChat: ChatMessage[] = [];
  const privateChat: ChatMessage[] = [];

  for (const row of rows) {
    const msg = rowToMsg(row);
    if (row.channel === 'mafia') mafiaChat.push(msg);
    else if (row.channel === 'dead') deadChat.push(msg);
    else if (row.channel === 'spectator') spectatorChat.push(msg);
    else if (row.channel === 'private') privateChat.push(msg);
    else chat.push(msg);
  }

  return { chat, mafiaChat, deadChat, spectatorChat, privateChat };
}

export interface GameEvent {
  id: number;
  roomId: number;
  sessionId: number | null;
  eventType: string;
  payload: Record<string, unknown>;
  time: string;
}

export function loadGameEvents(roomId: number, limit = 50): GameEvent[] {
  return (db
    .prepare(
      `SELECT * FROM room_game_log WHERE room_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(roomId, limit) as GameEventRow[]).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    payload: row.payload ? JSON.parse(row.payload) : {},
    time: row.created_at,
  }));
}

export function getRecentGameEvents(limit = 30): GameEvent[] {
  return (db
    .prepare(`SELECT * FROM room_game_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as GameEventRow[]).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    payload: row.payload ? JSON.parse(row.payload) : {},
    time: row.created_at,
  }));
}

export function hydrateRoomHistory(room: GameRoom): void {
  if (room.historyLoaded) return;
  const { chat, mafiaChat, deadChat, spectatorChat, privateChat } = loadRoomChatHistory(room.id);
  room.chat = chat.map((msg) =>
    msg.system ? { ...msg, playerName: normalizeSystemSender(msg.playerName) } : msg
  );
  room.mafiaChat = mafiaChat;
  room.deadChat = deadChat;
  room.spectatorChat = spectatorChat;
  room.privateChat = room.kind === 'chat' ? [] : privateChat;
  room.historyLoaded = true;
}

export function getRecentChatForAdmin(limit = 100): (ChatMessage & { roomId: number; channel: string })[] {
  const rows = db
    .prepare(`SELECT * FROM room_chat_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as ChatRow[];
  return rows.map((row) => ({
    ...rowToMsg(row),
    roomId: row.room_id,
    channel: row.channel,
  }));
}

export function getUserMessageCount(userId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM room_chat_log
       WHERE user_id = ? AND is_system = 0 AND deleted = 0`
    )
    .get(userId) as { c: number } | undefined;
  return row?.c ?? 0;
}

export function getAdminChatHistory(roomId: number, limit = 200): ChatMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM room_chat_log WHERE room_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(roomId, limit) as ChatRow[];
  return rows.map(rowToMsg).reverse();
}
