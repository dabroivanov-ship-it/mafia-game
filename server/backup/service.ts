import Database from 'better-sqlite3';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { db } from '../auth/db.js';
import { getDataDir, getDbPath, getServerRoot } from '../paths.js';

export interface BackupInfo {
  id: string;
  createdAt: string;
  sizeBytes: number;
  includeUploads: boolean;
}

function getBackupsDir(): string {
  const dir = path.join(getDataDir(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Matches ids from createBackup: ISO time with colons/dots replaced by dashes. */
const BACKUP_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

export function resolveBackupDir(backupId: string): string {
  const id = String(backupId || '').trim();
  if (!BACKUP_ID_PATTERN.test(id)) {
    throw new Error('Некорректный идентификатор резервной копии');
  }
  const root = path.resolve(getBackupsDir());
  const dir = path.resolve(getBackupsDir(), id);
  if (dir !== root && !dir.startsWith(`${root}${path.sep}`)) {
    throw new Error('Некорректный идентификатор резервной копии');
  }
  return dir;
}

function readManifest(dir: string): { createdAt?: string; includeUploads?: boolean } {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      createdAt?: string;
      includeUploads?: boolean;
    };
  } catch {
    return {};
  }
}

function dirSizeBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

export function listBackups(): BackupInfo[] {
  const root = getBackupsDir();
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BACKUP_ID_PATTERN.test(entry.name))
    .map((entry) => {
      const dir = path.join(root, entry.name);
      const manifest = readManifest(dir);
      const dbFile = path.join(dir, 'mafia.db');
      if (!fs.existsSync(dbFile)) return null;
      return {
        id: entry.name,
        createdAt: manifest.createdAt || fs.statSync(dbFile).mtime.toISOString(),
        sizeBytes: dirSizeBytes(dir),
        includeUploads: !!manifest.includeUploads,
      } satisfies BackupInfo;
    })
    .filter((item): item is BackupInfo => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createBackup(includeUploads = true): Promise<BackupInfo> {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(getBackupsDir(), id);
  fs.mkdirSync(dir, { recursive: true });

  const dbDest = path.join(dir, 'mafia.db');
  await db.backup(dbDest);

  if (includeUploads) {
    const uploadsSrc = path.join(getServerRoot(), 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      fs.cpSync(uploadsSrc, path.join(dir, 'uploads'), { recursive: true });
    }
  }

  const createdAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ id, createdAt, includeUploads }, null, 2)
  );

  return {
    id,
    createdAt,
    sizeBytes: dirSizeBytes(dir),
    includeUploads,
  };
}

export async function restoreBackup(backupId: string): Promise<void> {
  const dir = resolveBackupDir(backupId);
  const backupDbPath = path.join(dir, 'mafia.db');
  if (!fs.existsSync(backupDbPath)) {
    throw new Error('Резервная копия не найдена');
  }

  const src = new Database(backupDbPath, { readonly: true });
  try {
    await src.backup(getDbPath());
  } finally {
    src.close();
  }

  const uploadsBackup = path.join(dir, 'uploads');
  if (fs.existsSync(uploadsBackup)) {
    const uploadsDest = path.join(getServerRoot(), 'uploads');
    fs.cpSync(uploadsBackup, uploadsDest, { recursive: true, force: true });
  }
}

/** Rooms and other state live in memory — restart PM2 after restore so DB changes apply. */
export function scheduleServerRestart(delayMs = 800): void {
  setTimeout(() => {
    exec('pm2 restart mafia-server', (err) => {
      if (err) console.error('[backup] pm2 restart failed:', err.message);
    });
  }, delayMs);
}

export function deleteBackup(backupId: string): void {
  const dir = resolveBackupDir(backupId);
  if (!fs.existsSync(dir)) {
    throw new Error('Резервная копия не найдена');
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getActiveDbPath(): string {
  return getDbPath();
}
