import db from '../auth/db.js';
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from './themes.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const DEFAULT_THEME_KEY = 'default_theme';

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
