import fs from 'fs';
import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { findUserById, findPrimaryAdminId } from '../auth/db.js';
import { createRateLimitMiddleware, supportRateLimiter } from '../security/rateLimit.js';
import { MAX_SUPPORT_MESSAGE_LENGTH } from '../security/constants.js';
import { validateImageFile } from '../security/validate.js';
import { supportImageUpload, supportImagePublicPath } from '../upload/supportImage.js';
import { sendPrivateMessage, getUnreadCount } from '../messages/store.js';

const SUPPORT_PREFIX = '🆘 Поддержка';

export interface SupportRouterOptions {
  onMessageSent?: (recipientId: number, payload: {
    fromUserId: number;
    fromUsername: string;
    fromDisplayName: string;
    preview: string;
    unreadCount: number;
  }) => void;
}

export function createSupportRouter({ onMessageSent }: SupportRouterOptions = {}) {
  const router = Router();
  router.use(authMiddleware);
  const supportRateLimit = createRateLimitMiddleware(supportRateLimiter, (req) =>
    String(req.userId || 'anon')
  );

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

      const adminId = findPrimaryAdminId();
      if (!adminId) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(503).json({ error: 'Поддержка временно недоступна' });
      }

      const fullText = `${SUPPORT_PREFIX}\n\n${text}`;
      const message = sendPrivateMessage(req.userId!, adminId, fullText, attachmentUrl);
      if (!message) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Не удалось отправить обращение' });
      }

      const sender = findUserById(req.userId!);
      const unreadCount = getUnreadCount(adminId);
      onMessageSent?.(adminId, {
        fromUserId: req.userId!,
        fromUsername: sender?.username || '',
        fromDisplayName: sender?.display_name || '',
        preview: fullText.slice(0, 120),
        unreadCount,
      });

      res.status(201).json({ ok: true });
    });
  });

  return router;
}
