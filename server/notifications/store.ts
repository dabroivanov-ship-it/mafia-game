import db from '../auth/db.js';

export type NotificationType = 'mail' | 'reputation_up' | 'reputation_down' | 'system';

export interface UserNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  action: string | null;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  action: string | null;
  payload: string | null;
  is_read: number;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action TEXT,
    payload TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read);
`);

function rowToNotification(row: NotificationRow): UserNotification {
  let payload: Record<string, unknown> | null = null;
  if (row.payload) {
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    action: row.action,
    payload,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}

export function createNotification(
  userId: number,
  input: {
    type: NotificationType;
    title: string;
    body: string;
    action?: string | null;
    payload?: Record<string, unknown> | null;
  }
): UserNotification {
  const result = db
    .prepare(
      `INSERT INTO user_notifications (user_id, type, title, body, action, payload)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      input.type,
      input.title,
      input.body,
      input.action ?? null,
      input.payload ? JSON.stringify(input.payload) : null
    );

  const row = db
    .prepare('SELECT * FROM user_notifications WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as NotificationRow;

  pruneOldNotifications(userId, 100);
  return rowToNotification(row);
}

function pruneOldNotifications(userId: number, keep: number): void {
  db.prepare(
    `DELETE FROM user_notifications
     WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM user_notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?
       )`
  ).run(userId, userId, keep);
}

export function listNotifications(userId: number, limit = 30): UserNotification[] {
  const rows = db
    .prepare(
      `SELECT * FROM user_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(userId, limit) as NotificationRow[];
  return rows.map(rowToNotification);
}

export function getUnreadNotificationCount(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0')
    .get(userId) as { c: number };
  return row?.c ?? 0;
}

export function markNotificationRead(userId: number, notificationId: number): boolean {
  const result = db
    .prepare(
      `UPDATE user_notifications SET is_read = 1
       WHERE id = ? AND user_id = ? AND is_read = 0`
    )
    .run(notificationId, userId);
  return result.changes > 0;
}

export function markAllNotificationsRead(userId: number): void {
  db.prepare('UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
}

export function markNotificationsReadByAction(userId: number, action: string): void {
  db.prepare(
    `UPDATE user_notifications SET is_read = 1
     WHERE user_id = ? AND action = ? AND is_read = 0`
  ).run(userId, action);
}
