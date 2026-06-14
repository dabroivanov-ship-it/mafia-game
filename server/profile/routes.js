import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../auth/jwt.js';
import {
  findUserPublic,
  updateUserProfile,
  updateUserAvatar,
  uploadsDir,
} from '../auth/db.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.userId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Только JPG, PNG, WebP, GIF'), ok);
  },
});

router.put('/', authMiddleware, (req, res) => {
  const { displayName, city, bio } = req.body;
  if (!displayName?.trim()) {
    return res.status(400).json({ error: 'Укажите имя' });
  }
  const user = updateUserProfile(req.userId, {
    displayName: displayName.trim().slice(0, 30),
    city: (city || '').trim().slice(0, 50),
    bio: (bio || '').trim().slice(0, 500),
  });
  res.json({ user });
});

router.post('/avatar', authMiddleware, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не выбран' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const { oldAvatar, user } = updateUserAvatar(req.userId, avatarUrl);

    if (oldAvatar?.startsWith('/uploads/')) {
      const oldPath = path.join(uploadsDir, path.basename(oldAvatar));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    res.json({ user, avatar: avatarUrl });
  });
});

router.get('/:userId', authMiddleware, (req, res) => {
  const user = findUserPublic(Number(req.params.userId));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user });
});

export default router;
