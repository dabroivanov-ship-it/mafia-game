import fs from 'fs';
import path from 'path';
import { getServerRoot } from '../paths.js';

function isUnsetEnv(value: string | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return !trimmed || trimmed === 'undefined';
}

function applyEnvFile(contents: string, overwrite: boolean): void {
  for (const line of contents.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (overwrite || isUnsetEnv(process.env[key])) {
      process.env[key] = val;
    }
  }
}

/** Fill holes (and PM2's string "undefined") from server/.env. File wins for empty keys. */
export function loadServerEnvFile(): void {
  const envPath = path.join(getServerRoot(), '.env');
  if (!fs.existsSync(envPath)) return;
  applyEnvFile(fs.readFileSync(envPath, 'utf8'), false);
}

loadServerEnvFile();
