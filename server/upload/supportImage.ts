import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getSupportUploadsDir } from '../paths.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const supportUploadsDir = getSupportUploadsDir();
if (!fs.existsSync(supportUploadsDir)) fs.mkdirSync(supportUploadsDir, { recursive: true });

export const supportImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, supportUploadsDir),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
    cb(null, `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const supportImageUpload = multer({
  storage: supportImageStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in EXT_BY_MIME) cb(null, true);
    else cb(new Error('Только JPG, PNG, WebP, GIF'));
  },
});

export function ensureSupportUploadsDir(): string {
  return supportUploadsDir;
}

export function supportImagePublicPath(filename: string): string {
  return `/uploads/support/${path.basename(filename)}`;
}
