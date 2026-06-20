import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { isStaff, isUserBanned } from '../auth/db.js';
import { listPublishedNews } from './store.js';
import { addNewsComment, deleteNewsComment, listNewsComments } from './comments.js';

export function createNewsRouter() {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (_req, res) => {
    res.json({ news: listPublishedNews() });
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
      const comment = addNewsComment(newsId, req.userId!, String(req.body?.body ?? ''));
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
