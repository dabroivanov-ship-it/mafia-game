import db from '../auth/db.js';
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from './themes.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const DEFAULT_THEME_KEY = 'default_theme';
const TELEGRAM_BOT_USERNAME_KEY = 'telegram_bot_username';
const TELEGRAM_WEBAPP_URL_KEY = 'telegram_webapp_url';

export function getDefaultTheme(): ThemeId {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(DEFAULT_THEME_KEY) as
    | { value: string }
    | undefined;
  if (row && isValidThemeId(row.value)) return row.value;
  return DEFAULT_THEME;
}

export function setDefaultTheme(themeId: ThemeId): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(DEFAULT_THEME_KEY, themeId);
}

export function getTelegramSettings(): { botUsername: string | null; webAppUrl: string | null } {
  const rows = db
    .prepare('SELECT key, value FROM app_settings WHERE key IN (?, ?)')
    .all(TELEGRAM_BOT_USERNAME_KEY, TELEGRAM_WEBAPP_URL_KEY) as { key: string; value: string }[];
  let botUsername: string | null = null;
  let webAppUrl: string | null = null;
  for (const row of rows) {
    if (row.key === TELEGRAM_BOT_USERNAME_KEY) botUsername = row.value || null;
    if (row.key === TELEGRAM_WEBAPP_URL_KEY) webAppUrl = row.value || null;
  }
  return { botUsername, webAppUrl };
}

export function setTelegramSettings(botUsername: string, webAppUrl: string): void {
  const normalizedBot = botUsername.trim().replace(/^@/, '');
  const normalizedUrl = webAppUrl.trim();
  const upsert =
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  db.prepare(upsert).run(TELEGRAM_BOT_USERNAME_KEY, normalizedBot);
  db.prepare(upsert).run(TELEGRAM_WEBAPP_URL_KEY, normalizedUrl);
}
