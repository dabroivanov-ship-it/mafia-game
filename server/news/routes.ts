import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { isStaff, isUserBanned } from '../auth/db.js';
import { getUnreadNewsCount, listPublishedNews, markAllNewsRead } from './store.js';
import { addNewsComment, deleteNewsComment, listNewsComments } from './comments.js';
import { castPollVote } from './polls.js';

export function createNewsRouter() {
  const router = Router();
  router.use(authMiddleware);

  router.get('/unread-count', (req, res) => {
    res.json({ count: getUnreadNewsCount(req.userId!) });
  });

  router.post('/mark-read', (req, res) => {
    try {
      const count = markAllNewsRead(req.userId!);
      res.json({ count });
    } catch (e) {
      const err = e as Error;
      console.error('[news] mark-read failed:', err);
      res.status(500).json({ error: err.message || 'Не удалось отметить новости прочитанными' });
    }
  });

  router.get('/', (req, res) => {
    try {
      res.json({ news: listPublishedNews(50, req.userId!) });
    } catch (e) {
      const err = e as Error;
      console.error('[news] list failed:', err);
      res.status(500).json({ error: err.message || 'Не удалось загрузить новости' });
    }
  });

  router.post('/:newsId/poll/vote', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const newsId = Number(req.params.newsId);
    const optionId = Number(req.body?.optionId);
    if (!Number.isFinite(newsId) || !Number.isFinite(optionId)) {
      return res.status(400).json({ error: 'Некорректные данные голосования' });
    }
    try {
      const poll = castPollVote(newsId, optionId, req.userId!);
      res.json({ poll });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось проголосовать' });
    }
  });

  router.get('/:newsId/comments', (req, res) => {
    const newsId = Number(req.params.newsId);
    if (!Number.isFinite(newsId)) {
      return res.status(400).json({ error: 'Некорректный id новости' });
    }
    res.json({ comments: listNewsComments(newsId) });
  });

  router.post('/:newsId/comments', (req, res) => {
    if (isUserBanned(req.user)) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }
    const newsId = Number(req.params.newsId);
    if (!Number.isFinite(newsId)) {
      return res.status(400).json({ error: 'Некорректный id новости' });
    }
    try {
      const parentId =
        req.body?.parentId != null && req.body.parentId !== ''
          ? Number(req.body.parentId)
          : null;
      const comment = addNewsComment(
        newsId,
        req.userId!,
        String(req.body?.body ?? ''),
        Number.isFinite(parentId) ? parentId : null
      );
      res.status(201).json({ comment });
    } catch (e) {
      const err = e as Error;
      res.status(400).json({ error: err.message || 'Не удалось добавить комментарий' });
    }
  });

  router.delete('/comments/:commentId', (req, res) => {
    const commentId = Number(req.params.commentId);
    if (!Number.isFinite(commentId)) {
      return res.status(400).json({ error: 'Некорректный id комментария' });
    }
    const deleted = deleteNewsComment(commentId, req.userId!, isStaff(req.user));
    if (!deleted) {
      return res.status(404).json({ error: 'Комментарий не найден' });
    }
    res.json({ ok: true });
  });

  return router;
}
