import path from 'path';
import { fileURLToPath } from 'url';

/** Корень каталога server/ — одинаковый в dev (tsx) и prod (dist/*.js) */
export function getServerRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  // server/dist/paths.js, server/dist/server.js
  if (moduleDir.endsWith(`${path.sep}dist`)) {
    return path.resolve(moduleDir, '..');
  }

  // server/paths.ts при npm run dev
  if (path.basename(moduleDir) === 'server') {
    return moduleDir;
  }

  // server/dist/auth/..., server/dist/history/...
  if (moduleDir.includes(`${path.sep}dist${path.sep}`)) {
    return path.resolve(moduleDir, '..', '..');
  }

  return path.resolve(moduleDir, '..');
}

export function getDataDir(): string {
  if (process.env.DB_PATH) {
    return path.dirname(process.env.DB_PATH);
  }
  return path.join(getServerRoot(), 'data');
}

export function getDbPath(): string {
  return process.env.DB_PATH || path.join(getDataDir(), 'mafia.db');
}

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(getServerRoot(), 'uploads', 'avatars');
}

export function getNewsUploadsDir(): string {
  return process.env.NEWS_UPLOADS_DIR || path.join(getServerRoot(), 'uploads', 'news');
}
