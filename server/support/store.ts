import db, { findUserById } from '../auth/db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at DESC);
`);

export type SupportTicketStatus = 'open' | 'done';

export interface SupportTicket {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  text: string;
  attachmentUrl: string | null;
  status: SupportTicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
}

interface TicketRow {
  id: number;
  user_id: number;
  text: string;
  attachment_url: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

function rowToTicket(row: TicketRow): SupportTicket {
  const user = findUserById(row.user_id);
  return {
    id: row.id,
    userId: row.user_id,
    username: user?.username || '',
    displayName: user?.display_name || user?.username || 'Игрок',
    text: row.text,
    attachmentUrl: row.attachment_url,
    status: row.status === 'done' ? 'done' : 'open',
    createdAt: toIso(row.created_at) || row.created_at,
    resolvedAt: toIso(row.resolved_at),
    resolvedBy: row.resolved_by,
  };
}

export function createSupportTicket(
  userId: number,
  text: string,
  attachmentUrl: string | null
): SupportTicket {
  const result = db
    .prepare(
      `INSERT INTO support_tickets (user_id, text, attachment_url)
       VALUES (?, ?, ?)`
    )
    .run(userId, text, attachmentUrl);
  const row = db
    .prepare('SELECT * FROM support_tickets WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as TicketRow;
  return rowToTicket(row);
}

export function listSupportTickets(status?: SupportTicketStatus | 'all', limit = 200): SupportTicket[] {
  const cap = Math.min(Math.max(limit, 1), 500);
  const rows =
    status && status !== 'all'
      ? (db
          .prepare(
            `SELECT * FROM support_tickets
             WHERE status = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ?`
          )
          .all(status, cap) as TicketRow[])
      : (db
          .prepare(
            `SELECT * FROM support_tickets
             ORDER BY created_at DESC, id DESC
             LIMIT ?`
          )
          .all(cap) as TicketRow[]);
  return rows.map(rowToTicket);
}

export function countOpenSupportTickets(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'open'`)
    .get() as { c: number };
  return row?.c ?? 0;
}

export function setSupportTicketStatus(
  ticketId: number,
  status: SupportTicketStatus,
  staffUserId: number
): SupportTicket | null {
  const existing = db
    .prepare('SELECT * FROM support_tickets WHERE id = ?')
    .get(ticketId) as TicketRow | undefined;
  if (!existing) return null;

  if (status === 'done') {
    db.prepare(
      `UPDATE support_tickets
       SET status = 'done', resolved_at = datetime('now'), resolved_by = ?
       WHERE id = ?`
    ).run(staffUserId, ticketId);
  } else {
    db.prepare(
      `UPDATE support_tickets
       SET status = 'open', resolved_at = NULL, resolved_by = NULL
       WHERE id = ?`
    ).run(ticketId);
  }

  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as TicketRow;
  return rowToTicket(row);
}
