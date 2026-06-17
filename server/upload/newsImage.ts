import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getNewsUploadsDir } from '../paths.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const newsUploadsDir = getNewsUploadsDir();
if (!fs.existsSync(newsUploadsDir)) fs.mkdirSync(newsUploadsDir, { recursive: true });

export const newsImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, newsUploadsDir),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
    cb(null, `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const newsImageUpload = multer({
  storage: newsImageStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in EXT_BY_MIME) cb(null, true);
    else cb(new Error('Только JPG, PNG, WebP, GIF'));
  },
});

export function ensureNewsUploadsDir(): string {
  return newsUploadsDir;
}

export function newsImagePublicPath(filename: string): string {
  return `/uploads/news/${path.basename(filename)}`;
}
