import fs from 'fs';
import { Router } from 'express';
import { authMiddleware, staffMiddleware } from '../auth/jwt.js';
import { findUserById, listStaffUsers } from '../auth/db.js';
import { createRateLimitMiddleware, supportRateLimiter } from '../security/rateLimit.js';
import { MAX_SUPPORT_MESSAGE_LENGTH } from '../security/constants.js';
import { validateImageFile } from '../security/validate.js';
import { supportImageUpload, supportImagePublicPath } from '../upload/supportImage.js';
import {
  countOpenSupportTickets,
  createSupportTicket,
  listSupportTickets,
  setSupportTicketStatus,
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
}

export function createSupportRouter({ onTicketCreated }: SupportRouterOptions = {}) {
  const router = Router();
  router.use(authMiddleware);
  const supportRateLimit = createRateLimitMiddleware(supportRateLimiter, (req) =>
    String(req.userId || 'anon')
  );

  router.get('/tickets', staffMiddleware, (req, res) => {
    const statusRaw = String(req.query.status || 'all');
    const status: SupportTicketStatus | 'all' =
      statusRaw === 'open' || statusRaw === 'done' ? statusRaw : 'all';
    res.json({
      tickets: listSupportTickets(status),
      openCount: countOpenSupportTickets(),
    });
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

  router.post('/', supportRateLimit, (req, res) => {
    supportImageUpload.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });

      const text = String(req.body.text || '').trim();
      if (!text) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Опишите проблему' });
      }
      if (text.length > MAX_SUPPORT_MESSAGE_LENGTH) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: `Слишком длинное сообщение (макс. ${MAX_SUPPORT_MESSAGE_LENGTH})`,
        });
      }

      let attachmentUrl: string | null = null;
      if (req.file) {
        if (!validateImageFile(req.file.path, req.file.mimetype)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'Файл не является допустимым изображением' });
        }
        attachmentUrl = supportImagePublicPath(req.file.filename);
      }

      const ticket = createSupportTicket(req.userId!, text, attachmentUrl);
      const sender = findUserById(req.userId!);
      onTicketCreated?.({
        id: ticket.id,
        userId: ticket.userId,
        username: sender?.username || '',
        displayName: sender?.display_name || sender?.username || 'Игрок',
        preview: text.slice(0, 120),
        staffUserIds: listStaffUsers().map((s) => s.id),
      });

      res.status(201).json({ ok: true });
    });
  });

  return router;
}
