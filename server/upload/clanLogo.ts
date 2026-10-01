import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getClanLogosUploadsDir } from '../paths.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const clanLogosDir = getClanLogosUploadsDir();
if (!fs.existsSync(clanLogosDir)) fs.mkdirSync(clanLogosDir, { recursive: true });

export const clanLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, clanLogosDir),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.png';
    cb(null, `clan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const clanLogoUpload = multer({
  storage: clanLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in EXT_BY_MIME) cb(null, true);
    else cb(new Error('Только JPG, PNG, WebP или GIF'));
  },
});

export function ensureClanLogosUploadsDir(): string {
  return clanLogosDir;
}

export function clanLogoPublicPath(filename: string): string {
  return `/uploads/clans/${path.basename(filename)}`;
}

export function deleteClanLogoFile(logoPath: string | null | undefined): void {
  if (!logoPath?.startsWith('/uploads/clans/')) return;
  const filePath = path.join(clanLogosDir, path.basename(logoPath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
