import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { findUserById } from '../auth/db.js';
import { addFriend, removeFriend, areFriends, listFriends } from './store.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  res.json({ friends: listFriends(req.userId!) });
});

router.get('/status/:userId', authMiddleware, (req, res) => {
  const targetId = Number(req.params.userId);
  if (!findUserById(targetId)) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  const isSelf = req.userId === targetId;
  res.json({
    isFriend: !isSelf && areFriends(req.userId!, targetId),
    isSelf,
  });
});

router.post('/:userId', authMiddleware, (req, res) => {
  const friendId = Number(req.params.userId);
  if (!Number.isFinite(friendId) || friendId <= 0) {
    return res.status(400).json({ error: 'Некорректный пользователь' });
  }
  if (friendId === req.userId) {
    return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
  }
  if (!findUserById(friendId)) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  addFriend(req.userId!, friendId);
  res.json({ isFriend: true });
});

router.delete('/:userId', authMiddleware, (req, res) => {
  const friendId = Number(req.params.userId);
  removeFriend(req.userId!, friendId);
  res.json({ isFriend: false });
});

export default router;
