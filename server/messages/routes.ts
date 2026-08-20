import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { findUserById, findUserByUsername, isStaff } from '../auth/db.js';
import { createRateLimitMiddleware, pmRateLimiter } from '../security/rateLimit.js';
import { MAX_PM_MESSAGE_LENGTH } from '../security/constants.js';
import { parseViolationType } from '../security/validate.js';
import { addViolation } from '../moderation/violationLog.js';
import { ADVERTISING_BLOCK_MESSAGE, looksLikeAdvertising } from '../moderation/advertising.js';
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
  findPrivateMessageForModeration,
  moderateDeletePrivateMessage,
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
  onOutgoingRead?: (senderId: number, payload: { readerId: number; messageIds: number[] }) => void;
}

export function createMessagesRouter({ onMessageSent, onMessageRead, onOutgoingRead }: MessagesRouterOptions = {}) {
  const router = Router();
  router.use(authMiddleware);
  const pmRateLimit = createRateLimitMiddleware(pmRateLimiter, (req) => String(req.userId || 'anon'));
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
    const markedIds = markThreadRead(req.userId!, otherUserId);
    const unreadCount = getUnreadCount(req.userId!);
    onMessageRead?.(req.userId!, unreadCount);
    if (markedIds.length > 0) {
      onOutgoingRead?.(otherUserId, { readerId: req.userId!, messageIds: markedIds });
    }
    const page = listThread(req.userId!, otherUserId, {
      limit,
      beforeId: beforeId && !Number.isNaN(beforeId) ? beforeId : undefined,
    });
    res.json({ ...page, unreadCount });
  });

  router.post('/', pmRateLimit, (req, res) => {
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
    if (text.length > MAX_PM_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Слишком длинное сообщение (макс. ${MAX_PM_MESSAGE_LENGTH})` });
    }

    const recipient = findUserById(toUserId);
    if (!recipient) return res.status(404).json({ error: 'Пользователь не найден' });

    if (!isStaff(req.user) && looksLikeAdvertising(text)) {
      const sender = findUserById(req.userId!);
      addViolation({
        violationType: 'advertising',
        messageText: text,
        authorUserId: req.userId!,
        authorName: sender?.username || sender?.display_name || 'Игрок',
        roomId: 0,
        roomName: 'Письма',
        channel: 'mail',
        messageId: `auto-mail-${Date.now()}-${req.userId}`,
        moderatorId: 0,
        moderatorName: 'Авто',
        messageAt: new Date().toISOString(),
      });
      return res.status(400).json({ error: ADVERTISING_BLOCK_MESSAGE });
    }

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
    const marked = markMessageRead(Number(req.params.messageId), req.userId!);
    if (!marked) return res.status(404).json({ error: 'Сообщение не найдено' });
    const unreadCount = getUnreadCount(req.userId!);
    onMessageRead?.(req.userId!, unreadCount);
    onOutgoingRead?.(marked.senderId, { readerId: req.userId!, messageIds: [marked.id] });
    res.json({ ok: true, unreadCount });
  });

  /** Recipient or staff: delete letter for violation and write to moderation journal. */
  router.post('/:messageId/report', (req, res) => {
    const messageId = Number(req.params.messageId);
    if (!Number.isFinite(messageId)) {
      return res.status(400).json({ error: 'Некорректный id сообщения' });
    }
    const vType = parseViolationType(req.body?.violationType);
    if (!vType) return res.status(400).json({ error: 'Укажите тип нарушения' });

    const found = findPrivateMessageForModeration(messageId);
    if (!found) return res.status(404).json({ error: 'Сообщение не найдено' });

    const reporterId = req.userId!;
    const staff = isStaff(req.user);
    const isRecipient = found.recipientId === reporterId;
    if (!isRecipient && !staff) {
      return res.status(403).json({ error: 'Можно отметить только входящее письмо' });
    }
    if (found.senderId === reporterId) {
      return res.status(400).json({ error: 'Нельзя отметить своё письмо' });
    }

    const deleted = moderateDeletePrivateMessage(messageId);
    if (!deleted) return res.status(404).json({ error: 'Сообщение не найдено' });

    addViolation({
      violationType: vType,
      messageText: deleted.text,
      authorUserId: deleted.senderId,
      authorName: deleted.senderName,
      roomId: 0,
      roomName: 'Письма',
      channel: 'mail',
      messageId: String(deleted.id),
      moderatorId: reporterId,
      messageAt: deleted.createdAt,
    });

    res.json({ ok: true });
  });

  return router;
}
