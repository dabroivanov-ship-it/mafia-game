import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './store.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const notifications = listNotifications(req.userId!, 40);
  res.json({
    notifications,
    unreadCount: getUnreadNotificationCount(req.userId!),
  });
});

router.post('/read-all', (req, res) => {
  markAllNotificationsRead(req.userId!);
  res.json({ unreadCount: 0 });
});

router.post('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Некорректный id' });
  markNotificationRead(req.userId!, id);
  res.json({ unreadCount: getUnreadNotificationCount(req.userId!) });
});

export default router;
