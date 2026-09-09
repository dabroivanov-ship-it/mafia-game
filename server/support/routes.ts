import fs from 'fs';
import { Router } from 'express';
import { authMiddleware, staffMiddleware } from '../auth/jwt.js';
import { findUserById, isStaff, listStaffUsers } from '../auth/db.js';
import { createRateLimitMiddleware, supportRateLimiter } from '../security/rateLimit.js';
import { MAX_SUPPORT_MESSAGE_LENGTH } from '../security/constants.js';
import { validateImageFile } from '../security/validate.js';
import { supportImageUpload, supportImagePublicPath } from '../upload/supportImage.js';
import {
  addSupportMessage,
  countOpenSupportTickets,
  createSupportTicket,
  getSupportTicket,
  listSupportMessages,
  listSupportTickets,
  listSupportTicketsForUser,
  setSupportTicketStatus,
  staffPublicName,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketStatus,
} from './store.js';

export interface SupportRouterOptions {
  onTicketCreated?: (ticket: {
    id: number;
    userId: number;
    username: string;
    displayName: string;
    preview: string;
    staffUserIds: number[];
  }) => void;
  onTicketReply?: (payload: {
    ticketId: number;
    ticketOwnerId: number;
    authorUserId: number;
    authorName: string;
    isStaffReply: boolean;
    preview: string;
    staffUserIds: number[];
  }) => void;
}

function unlinkFile(path: string | undefined): void {
  if (!path) return;
  try {
    fs.unlinkSync(path);
  } catch {
    /* ignore */
  }
}

function readMessageBody(
  req: { body?: { text?: unknown }; file?: { path: string; filename: string; mimetype: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } }
): { text: string; attachmentUrl: string | null } | null {
  const text = String(req.body?.text || '').trim();
  if (!text) {
    unlinkFile(req.file?.path);
    res.status(400).json({ error: 'Опишите проблему' });
    return null;
  }
  if (text.length > MAX_SUPPORT_MESSAGE_LENGTH) {
    unlinkFile(req.file?.path);
    res.status(400).json({
      error: `Слишком длинное сообщение (макс. ${MAX_SUPPORT_MESSAGE_LENGTH})`,
    });
    return null;
  }

  let attachmentUrl: string | null = null;
  if (req.file) {
    if (!validateImageFile(req.file.path, req.file.mimetype)) {
      unlinkFile(req.file.path);
      res.status(400).json({ error: 'Файл не является допустимым изображением' });
      return null;
    }
    attachmentUrl = supportImagePublicPath(req.file.filename);
  }
  return { text, attachmentUrl };
}

function ticketPayload(ticket: SupportTicket, messages?: SupportTicketMessage[]) {
  return { ticket, messages: messages ?? listSupportMessages(ticket.id) };
}

export function createSupportRouter({ onTicketCreated, onTicketReply }: SupportRouterOptions = {}) {
  const router = Router();
  router.use(authMiddleware);
  const supportRateLimit = createRateLimitMiddleware(supportRateLimiter, (req) =>
    String(req.userId || 'anon')
  );

  router.get('/mine', (req, res) => {
    res.json({ tickets: listSupportTicketsForUser(req.userId!) });
  });

  router.get('/tickets', staffMiddleware, (req, res) => {
    const statusRaw = String(req.query.status || 'all');
    const status: SupportTicketStatus | 'all' =
      statusRaw === 'open' || statusRaw === 'done' ? statusRaw : 'all';
    res.json({
      tickets: listSupportTickets(status),
      openCount: countOpenSupportTickets(),
    });
  });

  router.get('/tickets/:id', (req, res) => {
    const ticketId = Number(req.params.id);
    const ticket = getSupportTicket(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });
    const staff = isStaff(req.user);
    if (!staff && ticket.userId !== req.userId) {
      return res.status(403).json({ error: 'Нет доступа к обращению' });
    }
    const messages = listSupportMessages(ticket.id).map((msg) =>
      staff || msg.role === 'player'
        ? msg
        : { ...msg, authorName: staffPublicName() }
    );
    res.json(ticketPayload(ticket, messages));
  });

  router.patch('/tickets/:id', staffMiddleware, (req, res) => {
    const ticketId = Number(req.params.id);
    const status = req.body?.status === 'done' ? 'done' : req.body?.status === 'open' ? 'open' : null;
    if (!ticketId || !status) {
      return res.status(400).json({ error: 'Укажите статус обращения' });
    }
    const ticket = setSupportTicketStatus(ticketId, status, req.userId!);
    if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });
    res.json({ ticket, openCount: countOpenSupportTickets() });
  });

  router.post('/tickets/:id/messages', (req, res) => {
    supportImageUpload.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });

      const ticketId = Number(req.params.id);
      const ticket = getSupportTicket(ticketId);
      if (!ticket) {
        unlinkFile(req.file?.path);
        return res.status(404).json({ error: 'Обращение не найдено' });
      }

      const staff = isStaff(req.user);
      const isOwner = ticket.userId === req.userId;
      if (!staff && !isOwner) {
        unlinkFile(req.file?.path);
        return res.status(403).json({ error: 'Нет доступа к обращению' });
      }

      const parsed = readMessageBody(req, res);
      if (!parsed) return;

      const role = staff ? 'staff' : 'player';
      const saved = addSupportMessage(ticketId, req.userId!, role, parsed.text, parsed.attachmentUrl);
      if (!saved) {
        unlinkFile(req.file?.path);
        return res.status(400).json({ error: 'Не удалось отправить сообщение' });
      }

      const messages = listSupportMessages(saved.ticket.id).map((msg) =>
        staff || msg.role === 'player'
          ? msg
          : { ...msg, authorName: staffPublicName() }
      );

      const sender = findUserById(req.userId!);
      onTicketReply?.({
        ticketId: saved.ticket.id,
        ticketOwnerId: saved.ticket.userId,
        authorUserId: req.userId!,
        authorName: sender?.display_name || sender?.username || 'Игрок',
        isStaffReply: role === 'staff',
        preview: parsed.text.slice(0, 120),
        staffUserIds: listStaffUsers().map((s) => s.id),
      });

      res.status(201).json({
        ...ticketPayload(saved.ticket, messages),
        openCount: countOpenSupportTickets(),
      });
    });
  });

  router.post('/', supportRateLimit, (req, res) => {
    supportImageUpload.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });

      const parsed = readMessageBody(req, res);
      if (!parsed) return;

      const ticket = createSupportTicket(req.userId!, parsed.text, parsed.attachmentUrl);
      const sender = findUserById(req.userId!);
      onTicketCreated?.({
        id: ticket.id,
        userId: ticket.userId,
        username: sender?.username || '',
        displayName: sender?.display_name || sender?.username || 'Игрок',
        preview: parsed.text.slice(0, 120),
        staffUserIds: listStaffUsers().map((s) => s.id),
      });

      res.status(201).json({
        ok: true,
        ...ticketPayload(ticket),
      });
    });
  });

  return router;
}
