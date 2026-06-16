import multer from 'multer';
import type { Request } from 'express';
import { uploadsDir } from '../auth/db.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function createAvatarUpload(getUserId: (req: Request) => string | number) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const uid = String(getUserId(req)).replace(/[^a-zA-Z0-9_-]/g, '');
      const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
      cb(null, `${uid}_${Date.now()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ok = file.mimetype in EXT_BY_MIME;
      if (ok) {
        cb(null, true);
      } else {
        cb(new Error('Только JPG, PNG, WebP, GIF'));
      }
    },
  });
}
