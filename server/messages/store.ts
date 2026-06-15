import db, { findUserById } from '../auth/db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS private_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pm_recipient ON private_messages(recipient_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pm_sender ON private_messages(sender_id, created_at DESC);
`);

interface MessageRow {
  id: number;
  sender_id: number;
  recipient_id: number;
  text: string;
  is_read: number;
  created_at: string;
}

export interface PrivateMessageView {
  id: number;
  text: string;
  createdAt: string;
  isRead: boolean;
  otherUser: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
  };
}

function mapOtherUser(userId: number) {
  const user = findUserById(userId);
  return {
    id: userId,
    username: user?.username || '?',
    displayName: user?.display_name || '?',
    avatar: user?.avatar || null,
  };
}

function rowToView(row: MessageRow, perspective: 'inbox' | 'outbox'): PrivateMessageView {
  const otherId = perspective === 'inbox' ? row.sender_id : row.recipient_id;
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
    isRead: !!row.is_read,
    otherUser: mapOtherUser(otherId),
  };
}

export function sendPrivateMessage(
  senderId: number,
  recipientId: number,
  text: string
): PrivateMessageView | null {
  if (senderId === recipientId) return null;
  if (!findUserById(recipientId)) return null;

  const result = db
    .prepare('INSERT INTO private_messages (sender_id, recipient_id, text) VALUES (?, ?, ?)')
    .run(senderId, recipientId, text);

  const row = db
    .prepare('SELECT * FROM private_messages WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as MessageRow | undefined;
  if (!row) return null;
  return rowToView(row, 'outbox');
}

export function listInbox(userId: number, limit = 50): PrivateMessageView[] {
  const rows = db
    .prepare(
      `SELECT * FROM private_messages WHERE recipient_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit) as MessageRow[];
  return rows.map((row) => rowToView(row, 'inbox'));
}

export function listOutbox(userId: number, limit = 50): PrivateMessageView[] {
  const rows = db
    .prepare(
      `SELECT * FROM private_messages WHERE sender_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit) as MessageRow[];
  return rows.map((row) => rowToView(row, 'outbox'));
}

export function getUnreadCount(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM private_messages WHERE recipient_id = ? AND is_read = 0')
    .get(userId) as { c: number } | undefined;
  return row?.c ?? 0;
}

export function markMessageRead(messageId: number, userId: number): boolean {
  const result = db
    .prepare(
      'UPDATE private_messages SET is_read = 1 WHERE id = ? AND recipient_id = ? AND is_read = 0'
    )
    .run(messageId, userId);
  return Number(result.changes) > 0;
}
