import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { findUserById, findUserByUsername } from '../auth/db.js';
import {
  sendPrivateMessage,
  listInbox,
  listOutbox,
  listHistory,
  listConversations,
  listThread,
  markThreadRead,
  getUnreadCount,
  markMessageRead,
} from './store.js';

export interface MessagesRouterOptions {
  onMessageSent?: (recipientId: number, payload: {
    fromUserId: number;
    fromUsername: string;
    fromDisplayName: string;
    preview: string;
    unreadCount: number;
  }) => void;
  onMessageRead?: (userId: number, unreadCount: number) => void;
}

export function createMessagesRouter({ onMessageSent, onMessageRead }: MessagesRouterOptions = {}) {
  const router = Router();
  router.use(authMiddleware);

  router.get('/unread-count', (req, res) => {
    res.json({ count: getUnreadCount(req.userId!) });
  });

  router.get('/inbox', (req, res) => {
    res.json({ messages: listInbox(req.userId!) });
  });

  router.get('/outbox', (req, res) => {
    res.json({ messages: listOutbox(req.userId!) });
  });

  router.get('/history', (req, res) => {
    res.json({ messages: listHistory(req.userId!) });
  });

  router.get('/conversations', (req, res) => {
    res.json({ conversations: listConversations(req.userId!) });
  });

  router.get('/thread/:otherUserId', (req, res) => {
    const otherUserId = Number(req.params.otherUserId);
    if (!otherUserId) return res.status(400).json({ error: 'Некорректный пользователь' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;
    markThreadRead(req.userId!, otherUserId);
    const unreadCount = getUnreadCount(req.userId!);
    onMessageRead?.(req.userId!, unreadCount);
    const page = listThread(req.userId!, otherUserId, {
      limit,
      beforeId: beforeId && !Number.isNaN(beforeId) ? beforeId : undefined,
    });
    res.json({ ...page, unreadCount });
  });

  router.post('/', (req, res) => {
    let toUserId = Number(req.body.toUserId);
    if (!toUserId && req.body.toUsername) {
      const name = String(req.body.toUsername).trim().replace(/^@/, '');
      const byName = findUserByUsername(name);
      if (!byName) return res.status(404).json({ error: 'Пользователь не найден' });
      toUserId = byName.id;
    }
    const text = String(req.body.text || '').trim();
    if (!toUserId) return res.status(400).json({ error: 'Укажите получателя (логин или ID)' });
    if (!text) return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    if (text.length > 2000) return res.status(400).json({ error: 'Слишком длинное сообщение' });

    const recipient = findUserById(toUserId);
    if (!recipient) return res.status(404).json({ error: 'Пользователь не найден' });

    const message = sendPrivateMessage(req.userId!, toUserId, text);
    if (!message) return res.status(400).json({ error: 'Нельзя отправить сообщение' });

    const sender = findUserById(req.userId!);
    const unreadCount = getUnreadCount(toUserId);
    onMessageSent?.(toUserId, {
      fromUserId: req.userId!,
      fromUsername: sender?.username || '',
      fromDisplayName: sender?.display_name || '',
      preview: text.slice(0, 120),
      unreadCount,
    });

    res.status(201).json({ message, unreadCount });
  });

  router.post('/:messageId/read', (req, res) => {
    const ok = markMessageRead(Number(req.params.messageId), req.userId!);
    if (!ok) return res.status(404).json({ error: 'Сообщение не найдено' });
    const unreadCount = getUnreadCount(req.userId!);
    onMessageRead?.(req.userId!, unreadCount);
    res.json({ ok: true, unreadCount });
  });

  return router;
}
