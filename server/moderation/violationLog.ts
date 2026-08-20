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

try {
  db.exec(`ALTER TABLE violation_log ADD COLUMN message_at TEXT`);
} catch {
  /* column exists */
}

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
  /** When the original message was written (falls back to createdAt). */
  messageAt: string;
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
  message_at?: string | null;
}

function toIso(raw: string): string {
  return raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
}

function rowToEntry(row: ViolationRow): ViolationEntry {
  const createdAt = toIso(row.created_at);
  const messageAt = row.message_at ? toIso(row.message_at) : createdAt;
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
    createdAt,
    messageAt,
  };
}

export function countViolations(type?: ViolationType): number {
  if (type) {
    return (
      db.prepare('SELECT COUNT(*) AS c FROM violation_log WHERE violation_type = ?').get(type) as {
        c: number;
      }
    ).c;
  }
  return (db.prepare('SELECT COUNT(*) AS c FROM violation_log').get() as { c: number }).c;
}

export function listViolations(limit = 200, type?: ViolationType): ViolationEntry[] {
  if (type) {
    const rows = db
      .prepare(
        `SELECT * FROM violation_log WHERE violation_type = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(type, limit) as ViolationRow[];
    return rows.map(rowToEntry);
  }
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
  moderatorName?: string | null;
  messageAt?: string | null;
}): ViolationEntry {
  const mod = input.moderatorId > 0 ? findUserById(input.moderatorId) : null;
  const moderatorName =
    (input.moderatorName && String(input.moderatorName).trim()) ||
    mod?.display_name ||
    mod?.username ||
    (input.moderatorId <= 0 ? 'Авто' : 'Модератор');
  const text = String(input.messageText || '').trim().slice(0, 2000);
  const messageAt =
    input.messageAt && String(input.messageAt).trim()
      ? String(input.messageAt).trim().slice(0, 40)
      : null;

  const result = db
    .prepare(
      `INSERT INTO violation_log
      (violation_type, message_text, author_user_id, author_name, room_id, room_name, channel, message_id, moderator_id, moderator_name, message_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      moderatorName.slice(0, 80),
      messageAt
    );

  const row = db
    .prepare('SELECT * FROM violation_log WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as ViolationRow;
  return rowToEntry(row);
}

export function clearViolations(type?: ViolationType): number {
  if (type) {
    const result = db.prepare('DELETE FROM violation_log WHERE violation_type = ?').run(type);
    return Number(result.changes);
  }
  const result = db.prepare('DELETE FROM violation_log').run();
  return Number(result.changes);
}
