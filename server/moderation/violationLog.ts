import db, { findUserById } from '../auth/db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS violation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    violation_type TEXT NOT NULL,
    message_text TEXT NOT NULL,
    author_user_id INTEGER,
    author_name TEXT NOT NULL,
    room_id INTEGER NOT NULL,
    room_name TEXT NOT NULL,
    channel TEXT NOT NULL,
    message_id TEXT NOT NULL,
    moderator_id INTEGER NOT NULL,
    moderator_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_violation_log_created ON violation_log(created_at DESC);
`);

export type ViolationType = 'profanity' | 'advertising' | 'other';

export interface ViolationEntry {
  id: number;
  violationType: ViolationType;
  messageText: string;
  authorUserId: number | null;
  authorName: string;
  roomId: number;
  roomName: string;
  channel: string;
  messageId: string;
  moderatorId: number;
  moderatorName: string;
  createdAt: string;
}

interface ViolationRow {
  id: number;
  violation_type: string;
  message_text: string;
  author_user_id: number | null;
  author_name: string;
  room_id: number;
  room_name: string;
  channel: string;
  message_id: string;
  moderator_id: number;
  moderator_name: string;
  created_at: string;
}

function rowToEntry(row: ViolationRow): ViolationEntry {
  return {
    id: row.id,
    violationType: row.violation_type as ViolationType,
    messageText: row.message_text,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    roomId: row.room_id,
    roomName: row.room_name,
    channel: row.channel,
    messageId: row.message_id,
    moderatorId: row.moderator_id,
    moderatorName: row.moderator_name,
    createdAt: row.created_at.includes('T')
      ? row.created_at
      : `${row.created_at.replace(' ', 'T')}Z`,
  };
}

export function listViolations(limit = 200): ViolationEntry[] {
  const rows = db
    .prepare(`SELECT * FROM violation_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as ViolationRow[];
  return rows.map(rowToEntry);
}

export function addViolation(input: {
  violationType: ViolationType;
  messageText: string;
  authorUserId: number | null;
  authorName: string;
  roomId: number;
  roomName: string;
  channel: string;
  messageId: string;
  moderatorId: number;
}): ViolationEntry {
  const mod = findUserById(input.moderatorId);
  const moderatorName = mod?.display_name || mod?.username || 'Модератор';
  const text = String(input.messageText || '').trim().slice(0, 2000);

  const result = db
    .prepare(
      `INSERT INTO violation_log
      (violation_type, message_text, author_user_id, author_name, room_id, room_name, channel, message_id, moderator_id, moderator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.violationType,
      text,
      input.authorUserId,
      input.authorName.slice(0, 80),
      input.roomId,
      input.roomName.slice(0, 80),
      input.channel,
      String(input.messageId),
      input.moderatorId,
      moderatorName.slice(0, 80)
    );

  const row = db
    .prepare('SELECT * FROM violation_log WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as ViolationRow;
  return rowToEntry(row);
}

export function clearViolations(): number {
  const result = db.prepare('DELETE FROM violation_log').run();
  return Number(result.changes);
}
