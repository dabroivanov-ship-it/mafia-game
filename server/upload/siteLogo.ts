import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getSiteBrandingUploadsDir } from '../paths.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const siteBrandingDir = getSiteBrandingUploadsDir();
if (!fs.existsSync(siteBrandingDir)) fs.mkdirSync(siteBrandingDir, { recursive: true });

export const siteLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, siteBrandingDir),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.png';
    cb(null, `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const siteLogoUpload = multer({
  storage: siteLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in EXT_BY_MIME) cb(null, true);
    else cb(new Error('Только JPG, PNG, WebP, GIF или SVG'));
  },
});

export function ensureSiteBrandingUploadsDir(): string {
  return siteBrandingDir;
}

export function siteLogoPublicPath(filename: string): string {
  return `/uploads/branding/${path.basename(filename)}`;
}
