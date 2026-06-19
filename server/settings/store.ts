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
const YANDEX_METRIKA_ID_KEY = 'yandex_metrika_id';
const LEGACY_METRIKA_ID = 109982503;

export function isValidYandexMetrikaId(value: unknown): value is number {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(id) && id >= 10_000 && id <= 999_999_999_999;
}

export function getYandexMetrikaId(): number | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(YANDEX_METRIKA_ID_KEY) as
    | { value: string }
    | undefined;
  if (!row) return LEGACY_METRIKA_ID;
  const raw = row.value.trim();
  if (!raw) return null;
  if (/^\d{5,12}$/.test(raw)) return Number(raw);
  return LEGACY_METRIKA_ID;
}

export function setYandexMetrikaId(id: number | null): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(YANDEX_METRIKA_ID_KEY, id === null ? '' : String(id));
}

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
