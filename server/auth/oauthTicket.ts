import crypto from 'crypto';

const TICKET_TTL_MS = 2 * 60 * 1000;

interface OauthTicket {
  token: string;
  createdAt: number;
}

const tickets = new Map<string, OauthTicket>();

function purgeExpiredTickets(): void {
  const now = Date.now();
  for (const [id, ticket] of tickets.entries()) {
    if (now - ticket.createdAt > TICKET_TTL_MS) tickets.delete(id);
  }
}

export function createOauthLoginTicket(token: string): string {
  purgeExpiredTickets();
  const id = crypto.randomBytes(32).toString('base64url');
  tickets.set(id, { token, createdAt: Date.now() });
  return id;
}

export function consumeOauthLoginTicket(id: string): string | null {
  purgeExpiredTickets();
  const ticket = tickets.get(id);
  if (!ticket) return null;
  tickets.delete(id);
  if (Date.now() - ticket.createdAt > TICKET_TTL_MS) return null;
  return ticket.token;
}
