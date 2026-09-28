import fs from 'fs';
import path from 'path';
import { getServerRoot } from '../paths.js';

/** Fill missing process.env from server/.env (PM2 dump is a subset and can drop OIDC/VK). */
export function loadServerEnvFile(): void {
  const envPath = path.join(getServerRoot(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
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
    if (!process.env[key]?.trim()) {
      process.env[key] = val;
    }
  }
}

loadServerEnvFile();
