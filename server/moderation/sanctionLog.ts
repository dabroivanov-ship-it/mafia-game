import db from '../auth/db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS user_sanctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sanction_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    moderator_id INTEGER,
    moderator_name TEXT NOT NULL,
    room_id INTEGER,
    room_name TEXT,
    until_at TEXT,
    lifted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_sanctions_user ON user_sanctions(user_id, created_at DESC);
`);

export type SanctionType = 'ban' | 'silence';

export interface UserSanctionEntry {
  id: number;
  sanctionType: SanctionType;
  reason: string;
  moderatorId: number | null;
  moderatorName: string;
  roomId: number | null;
  roomName: string | null;
  untilAt: string | null;
  liftedAt: string | null;
  createdAt: string;
}

interface SanctionRow {
  id: number;
  user_id: number;
  sanction_type: string;
  reason: string;
  moderator_id: number | null;
  moderator_name: string;
  moderator_username?: string | null;
  room_id: number | null;
  room_name: string | null;
  until_at: string | null;
  lifted_at: string | null;
  created_at: string;
}

function mapRow(row: SanctionRow): UserSanctionEntry {
  return {
    id: row.id,
    sanctionType: row.sanction_type as SanctionType,
    reason: row.reason,
    moderatorId: row.moderator_id,
    moderatorName: row.moderator_username || row.moderator_name,
    roomId: row.room_id,
    roomName: row.room_name,
    untilAt: row.until_at,
    liftedAt: row.lifted_at,
    createdAt: row.created_at,
  };
}

export function addUserSanction(input: {
  userId: number;
  sanctionType: SanctionType;
  reason: string;
  moderatorId?: number | null;
  moderatorName: string;
  roomId?: number | null;
  roomName?: string | null;
  untilAt?: string | null;
}): UserSanctionEntry {
  const result = db
    .prepare(
      `INSERT INTO user_sanctions
      (user_id, sanction_type, reason, moderator_id, moderator_name, room_id, room_name, until_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.userId,
      input.sanctionType,
      input.reason.trim() || 'Нарушение правил',
      input.moderatorId ?? null,
      input.moderatorName.trim() || 'Модерация',
      input.roomId ?? null,
      input.roomName ?? null,
      input.untilAt ?? null
    );
  const row = db
    .prepare('SELECT * FROM user_sanctions WHERE id = ?')
    .get(result.lastInsertRowid) as SanctionRow;
  return mapRow(row);
}

export function liftUserSanctions(userId: number, sanctionType: SanctionType): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE user_sanctions
     SET lifted_at = ?
     WHERE user_id = ? AND sanction_type = ? AND lifted_at IS NULL`
  ).run(now, userId, sanctionType);
}

export function listSanctionsForUser(userId: number, limit = 200): UserSanctionEntry[] {
  const rows = db
    .prepare(
      `SELECT s.*, m.username AS moderator_username
       FROM user_sanctions s
       LEFT JOIN users m ON m.id = s.moderator_id
       WHERE s.user_id = ?
       ORDER BY datetime(s.created_at) DESC
       LIMIT ?`
    )
    .all(userId, limit) as SanctionRow[];
  return rows.map(mapRow);
}
