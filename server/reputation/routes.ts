import { Router } from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { findUserById } from '../auth/db.js';
import { castReputationVote } from '../social/store.js';

const router = Router();

router.post('/:userId', authMiddleware, (req, res) => {
  const targetId = Number(req.params.userId);
  const raw = req.body?.value;
  const value = raw === -1 || raw === '-1' ? -1 : raw === 1 || raw === '1' ? 1 : null;
  if (value === null) {
    return res.status(400).json({ error: 'Укажите value: 1 или -1' });
  }
  if (!findUserById(targetId)) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  try {
    const { reputation } = castReputationVote(req.userId!, targetId, value);
    res.json({ reputation });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
  }
});

export default router;
