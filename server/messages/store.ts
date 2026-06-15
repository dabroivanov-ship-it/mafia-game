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
  direction?: 'in' | 'out';
  otherUser: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
  };
}

export interface ConversationPreview {
  otherUser: PrivateMessageView['otherUser'];
  lastMessage: {
    id: number;
    text: string;
    createdAt: string;
    direction: 'in' | 'out';
  };
  unreadCount: number;
}

export interface ThreadPage {
  messages: PrivateMessageView[];
  hasMore: boolean;
  total: number;
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

function rowToHistoryView(row: MessageRow, userId: number): PrivateMessageView {
  const incoming = row.recipient_id === userId;
  const otherId = incoming ? row.sender_id : row.recipient_id;
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
    isRead: incoming ? !!row.is_read : true,
    direction: incoming ? 'in' : 'out',
    otherUser: mapOtherUser(otherId),
  };
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

export function listHistory(userId: number, limit = 100): PrivateMessageView[] {
  const rows = db
    .prepare(
      `SELECT * FROM private_messages
       WHERE sender_id = ? OR recipient_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, userId, limit) as MessageRow[];
  return rows.map((row) => rowToHistoryView(row, userId));
}

export function listConversations(userId: number, limit = 50): ConversationPreview[] {
  const rows = db
    .prepare(
      `SELECT pm.* FROM private_messages pm
       INNER JOIN (
         SELECT
           CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS other_id,
           MAX(id) AS max_id
         FROM private_messages
         WHERE sender_id = ? OR recipient_id = ?
         GROUP BY other_id
       ) latest ON pm.id = latest.max_id
       ORDER BY pm.created_at DESC
       LIMIT ?`
    )
    .all(userId, userId, userId, limit) as MessageRow[];

  return rows.map((row) => {
    const view = rowToHistoryView(row, userId);
    const unreadRow = db
      .prepare(
        `SELECT COUNT(*) AS c FROM private_messages
         WHERE recipient_id = ? AND sender_id = ? AND is_read = 0`
      )
      .get(userId, view.otherUser.id) as { c: number };
    return {
      otherUser: view.otherUser,
      lastMessage: {
        id: view.id,
        text: view.text,
        createdAt: view.createdAt,
        direction: view.direction || 'in',
      },
      unreadCount: unreadRow?.c ?? 0,
    };
  });
}

function countThreadMessages(userId: number, otherUserId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM private_messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)`
    )
    .get(userId, otherUserId, otherUserId, userId) as { c: number };
  return row?.c ?? 0;
}

export function listThread(
  userId: number,
  otherUserId: number,
  options: { limit?: number; beforeId?: number } = {}
): ThreadPage {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
  const total = countThreadMessages(userId, otherUserId);

  let rows: MessageRow[];
  if (options.beforeId) {
    rows = db
      .prepare(
        `SELECT * FROM private_messages
         WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
           AND id < ?
         ORDER BY id DESC LIMIT ?`
      )
      .all(userId, otherUserId, otherUserId, userId, options.beforeId, limit) as MessageRow[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM private_messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
         ORDER BY id DESC LIMIT ?`
      )
      .all(userId, otherUserId, otherUserId, userId, limit) as MessageRow[];
  }

  rows.reverse();
  const messages = rows.map((row) => rowToHistoryView(row, userId));
  const oldestId = messages[0]?.id;
  let hasMore = false;
  if (oldestId) {
    const older = db
      .prepare(
        `SELECT COUNT(*) AS c FROM private_messages
         WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
           AND id < ?`
      )
      .get(userId, otherUserId, otherUserId, userId, oldestId) as { c: number };
    hasMore = (older?.c ?? 0) > 0;
  }

  return { messages, hasMore, total };
}

export function markThreadRead(userId: number, otherUserId: number): number {
  const result = db
    .prepare(
      `UPDATE private_messages SET is_read = 1
       WHERE recipient_id = ? AND sender_id = ? AND is_read = 0`
    )
    .run(userId, otherUserId);
  return Number(result.changes);
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
