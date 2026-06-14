import multer from 'multer';
import path from 'path';
import { uploadsDir } from '../auth/db.js';

export function createAvatarUpload(getUserId) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const uid = getUserId(req);
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${uid}_${Date.now()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
      cb(ok ? null : new Error('Только JPG, PNG, WebP, GIF'), ok);
    },
  });
}
