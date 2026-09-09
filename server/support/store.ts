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

  CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    attachment_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
  );
  CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket
    ON support_ticket_messages(ticket_id, created_at ASC, id ASC);
`);

export type SupportTicketStatus = 'open' | 'done';
export type SupportMessageRole = 'player' | 'staff';

export interface SupportTicketMessage {
  id: number;
  ticketId: number;
  authorId: number;
  role: SupportMessageRole;
  authorName: string;
  text: string;
  attachmentUrl: string | null;
  createdAt: string;
}

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
  lastPreview: string;
  lastAt: string;
  lastRole: SupportMessageRole;
  messageCount: number;
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

interface MessageRow {
  id: number;
  ticket_id: number;
  author_id: number;
  role: string;
  text: string;
  attachment_url: string | null;
  created_at: string;
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

function staffPublicName(): string {
  return 'Поддержка';
}

function authorLabel(role: SupportMessageRole, authorId: number): string {
  if (role === 'staff') {
    const user = findUserById(authorId);
    return user?.display_name || user?.username || staffPublicName();
  }
  const user = findUserById(authorId);
  return user?.display_name || user?.username || 'Игрок';
}

function rowToMessage(row: MessageRow): SupportTicketMessage {
  const role: SupportMessageRole = row.role === 'staff' ? 'staff' : 'player';
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    role,
    authorName: authorLabel(role, row.author_id),
    text: row.text,
    attachmentUrl: row.attachment_url,
    createdAt: toIso(row.created_at) || row.created_at,
  };
}

function lastMessageForTicket(ticketId: number): MessageRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM support_ticket_messages
         WHERE ticket_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .get(ticketId) as MessageRow | undefined) ?? null
  );
}

function messageCountForTicket(ticketId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM support_ticket_messages WHERE ticket_id = ?')
    .get(ticketId) as { c: number };
  return row?.c ?? 0;
}

function rowToTicket(row: TicketRow): SupportTicket {
  const user = findUserById(row.user_id);
  const last = lastMessageForTicket(row.id);
  const createdAt = toIso(row.created_at) || row.created_at;
  const previewSource = last?.text || row.text;
  return {
    id: row.id,
    userId: row.user_id,
    username: user?.username || '',
    displayName: user?.display_name || user?.username || 'Игрок',
    text: row.text,
    attachmentUrl: row.attachment_url,
    status: row.status === 'done' ? 'done' : 'open',
    createdAt: createdAt,
    resolvedAt: toIso(row.resolved_at),
    resolvedBy: row.resolved_by,
    lastPreview: previewSource.slice(0, 160),
    lastAt: toIso(last?.created_at) || createdAt,
    lastRole: last?.role === 'staff' ? 'staff' : 'player',
    messageCount: messageCountForTicket(row.id),
  };
}

function insertMessage(
  ticketId: number,
  authorId: number,
  role: SupportMessageRole,
  text: string,
  attachmentUrl: string | null,
  createdAt?: string
): SupportTicketMessage {
  const result = createdAt
    ? db
        .prepare(
          `INSERT INTO support_ticket_messages (ticket_id, author_id, role, text, attachment_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(ticketId, authorId, role, text, attachmentUrl, createdAt)
    : db
        .prepare(
          `INSERT INTO support_ticket_messages (ticket_id, author_id, role, text, attachment_url)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(ticketId, authorId, role, text, attachmentUrl);
  const row = db
    .prepare('SELECT * FROM support_ticket_messages WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as MessageRow;
  return rowToMessage(row);
}

function migrateLegacyTicketBodies(): void {
  const tickets = db.prepare('SELECT * FROM support_tickets').all() as TicketRow[];
  const countStmt = db.prepare(
    'SELECT COUNT(*) AS c FROM support_ticket_messages WHERE ticket_id = ?'
  );
  for (const ticket of tickets) {
    const count = (countStmt.get(ticket.id) as { c: number }).c;
    if (count > 0) continue;
    if (!ticket.text?.trim()) continue;
    insertMessage(
      ticket.id,
      ticket.user_id,
      'player',
      ticket.text,
      ticket.attachment_url,
      ticket.created_at
    );
  }
}

migrateLegacyTicketBodies();

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
  const ticketId = Number(result.lastInsertRowid);
  insertMessage(ticketId, userId, 'player', text, attachmentUrl);
  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as TicketRow;
  return rowToTicket(row);
}

export function getSupportTicket(ticketId: number): SupportTicket | null {
  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as
    | TicketRow
    | undefined;
  return row ? rowToTicket(row) : null;
}

export function listSupportMessages(ticketId: number): SupportTicketMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM support_ticket_messages
       WHERE ticket_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(ticketId) as MessageRow[];
  return rows.map(rowToMessage);
}

export function addSupportMessage(
  ticketId: number,
  authorId: number,
  role: SupportMessageRole,
  text: string,
  attachmentUrl: string | null
): { ticket: SupportTicket; message: SupportTicketMessage } | null {
  const existing = db
    .prepare('SELECT * FROM support_tickets WHERE id = ?')
    .get(ticketId) as TicketRow | undefined;
  if (!existing) return null;

  const message = insertMessage(ticketId, authorId, role, text, attachmentUrl);

  if (existing.status === 'done') {
    db.prepare(
      `UPDATE support_tickets
       SET status = 'open', resolved_at = NULL, resolved_by = NULL
       WHERE id = ?`
    ).run(ticketId);
  }

  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as TicketRow;
  return { ticket: rowToTicket(row), message };
}

export function listSupportTickets(status?: SupportTicketStatus | 'all', limit = 200): SupportTicket[] {
  const cap = Math.min(Math.max(limit, 1), 500);
  const rows =
    status && status !== 'all'
      ? (db
          .prepare(
            `SELECT * FROM support_tickets
             WHERE status = ?
             ORDER BY datetime(COALESCE(
               (SELECT MAX(created_at) FROM support_ticket_messages m WHERE m.ticket_id = support_tickets.id),
               created_at
             )) DESC, id DESC
             LIMIT ?`
          )
          .all(status, cap) as TicketRow[])
      : (db
          .prepare(
            `SELECT * FROM support_tickets
             ORDER BY datetime(COALESCE(
               (SELECT MAX(created_at) FROM support_ticket_messages m WHERE m.ticket_id = support_tickets.id),
               created_at
             )) DESC, id DESC
             LIMIT ?`
          )
          .all(cap) as TicketRow[]);
  return rows.map(rowToTicket);
}

export function listSupportTicketsForUser(userId: number, limit = 50): SupportTicket[] {
  const cap = Math.min(Math.max(limit, 1), 100);
  const rows = db
    .prepare(
      `SELECT * FROM support_tickets
       WHERE user_id = ?
       ORDER BY datetime(COALESCE(
         (SELECT MAX(created_at) FROM support_ticket_messages m WHERE m.ticket_id = support_tickets.id),
         created_at
       )) DESC, id DESC
       LIMIT ?`
    )
    .all(userId, cap) as TicketRow[];
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

export { staffPublicName };
