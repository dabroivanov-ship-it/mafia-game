import db from '../auth/db.js';

const BOT_PHRASES_KEY = 'bot_phrases_json';

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

let cache: Record<string, string> | null = null;

function loadOverrides(): Record<string, string> {
  if (cache) return cache;
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(BOT_PHRASES_KEY) as
    | { value: string }
    | undefined;
  if (!row?.value) {
    cache = {};
    return cache;
  }
  try {
    const parsed = JSON.parse(row.value) as Record<string, string>;
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function getBotPhraseOverrides(): Record<string, string> {
  return { ...loadOverrides() };
}

export function setBotPhraseOverrides(overrides: Record<string, string>): void {
  cache = { ...overrides };
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(BOT_PHRASES_KEY, JSON.stringify(cache));
}
