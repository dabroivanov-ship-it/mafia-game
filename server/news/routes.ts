import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { listPublishedNews } from './store.js';

export function createNewsRouter() {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (_req, res) => {
    res.json({ news: listPublishedNews() });
  });

  return router;
}
