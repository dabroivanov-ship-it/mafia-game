import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { findBlogById, listPublishedBlog } from './store.js';

export function createBlogRouter() {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (_req, res) => {
    try {
      res.json({ posts: listPublishedBlog(30) });
    } catch (e) {
      const err = e as Error;
      console.error('[blog] list failed:', err);
      res.status(500).json({ error: err.message || 'Не удалось загрузить блог' });
    }
  });

  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Некорректный id статьи' });
    }
    const post = findBlogById(id);
    if (!post || !post.isPublished) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }
    res.json({ post });
  });

  return router;
}
