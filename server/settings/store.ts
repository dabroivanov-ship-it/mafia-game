import db from '../auth/db.js';
import fs from 'fs';
import path from 'path';
import { getSiteBrandingUploadsDir } from '../paths.js';
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from './themes.js';
import { isTelegramOidcConfigured, getTelegramOidcRedirectUri } from '../auth/telegramOidc.js';
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
const SITE_LOGO_URL_KEY = 'site_logo_url';
const SITE_LOGO_TEXT_KEY = 'site_logo_text';
const SITE_LOGO_MARK_KEY = 'site_logo_mark';
const SITE_FOOTER_TEXT_KEY = 'site_footer_text';
const LEGACY_METRIKA_ID = 109982503;

const DEFAULT_LOGO_TEXT = 'Mafia';
const DEFAULT_LOGO_MARK = '♠';

export interface SiteBranding {
  logoUrl: string | null;
  logoText: string;
  logoMark: string;
  footerText: string;
}
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

export function getTelegramSettings(): {
  botUsername: string | null;
  webAppUrl: string | null;
  oidcClientId: string | null;
  oidcRedirectUri: string | null;
  loginReady: boolean;
} {
  const rows = db
    .prepare('SELECT key, value FROM app_settings WHERE key IN (?, ?)')
    .all(TELEGRAM_BOT_USERNAME_KEY, TELEGRAM_WEBAPP_URL_KEY) as { key: string; value: string }[];
  let botUsername: string | null = null;
  let webAppUrl: string | null = null;
  for (const row of rows) {
    if (row.key === TELEGRAM_BOT_USERNAME_KEY) botUsername = row.value || null;
    if (row.key === TELEGRAM_WEBAPP_URL_KEY) webAppUrl = row.value || null;
  }
  const oidcClientId = process.env.TELEGRAM_OIDC_CLIENT_ID?.trim() || null;
  const loginReady = isTelegramOidcConfigured();
  const oidcRedirectUri = oidcClientId ? getTelegramOidcRedirectUri() : null;
  return { botUsername, webAppUrl, oidcClientId, oidcRedirectUri, loginReady };
}

export function setTelegramSettings(botUsername: string, webAppUrl: string): void {
  const normalizedBot = botUsername.trim().replace(/^@/, '');
  const normalizedUrl = webAppUrl.trim();
  const upsert =
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  db.prepare(upsert).run(TELEGRAM_BOT_USERNAME_KEY, normalizedBot);
  db.prepare(upsert).run(TELEGRAM_WEBAPP_URL_KEY, normalizedUrl);
}

function readSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row?.value?.trim()) return null;
  return row.value;
}

function writeSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function deleteSiteLogoFile(logoPath: string | null | undefined): void {
  if (!logoPath?.startsWith('/uploads/branding/')) return;
  const dir = getSiteBrandingUploadsDir();
  const filePath = path.join(dir, path.basename(logoPath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function getSiteBranding(): SiteBranding {
  return {
    logoUrl: readSetting(SITE_LOGO_URL_KEY),
    logoText: readSetting(SITE_LOGO_TEXT_KEY) || DEFAULT_LOGO_TEXT,
    logoMark: readSetting(SITE_LOGO_MARK_KEY) || DEFAULT_LOGO_MARK,
    footerText: readSetting(SITE_FOOTER_TEXT_KEY) || '',
  };
}

export function setSiteBrandingFields(fields: {
  logoText: string;
  logoMark: string;
  footerText: string;
}): SiteBranding {
  writeSetting(SITE_LOGO_TEXT_KEY, fields.logoText.trim() || DEFAULT_LOGO_TEXT);
  writeSetting(SITE_LOGO_MARK_KEY, fields.logoMark.trim() || DEFAULT_LOGO_MARK);
  writeSetting(SITE_FOOTER_TEXT_KEY, fields.footerText.trim());
  return getSiteBranding();
}

export function setSiteLogoUrl(logoUrl: string | null): SiteBranding {
  const current = getSiteBranding().logoUrl;
  if (current && current !== logoUrl) deleteSiteLogoFile(current);
  writeSetting(SITE_LOGO_URL_KEY, logoUrl || '');
  return getSiteBranding();
}
