import db from '../auth/db.js';

const DEEPSEEK_API_KEY = 'deepseek_api_key';
const DEEPSEEK_MODEL = 'deepseek_model';
const DEEPSEEK_BASE_URL = 'deepseek_base_url';
const DEEPSEEK_ENABLED = 'deepseek_enabled';

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_BASE_URL = 'https://api.deepseek.com';

export interface DeepSeekSettings {
  enabled: boolean;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string | null;
}

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed;
}

export function getDeepSeekBaseUrl(): string {
  const fromDb = getSetting(DEEPSEEK_BASE_URL)?.trim();
  if (fromDb) return normalizeBaseUrl(fromDb);
  const fromEnv = process.env.DEEPSEEK_BASE_URL?.trim();
  return fromEnv ? normalizeBaseUrl(fromEnv) : DEFAULT_BASE_URL;
}

export function getDeepSeekChatUrl(): string {
  const base = getDeepSeekBaseUrl();
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/chat/completions`;
}

export function getDeepSeekSettings(): DeepSeekSettings {
  const enabledRaw = getSetting(DEEPSEEK_ENABLED);
  const modelRaw = getSetting(DEEPSEEK_MODEL);
  const key = getDeepSeekApiKey();
  return {
    enabled: enabledRaw === null ? true : enabledRaw === '1',
    model: modelRaw?.trim() || DEFAULT_MODEL,
    baseUrl: getDeepSeekBaseUrl(),
    apiKeyConfigured: !!key,
    apiKeyPreview: key ? maskApiKey(key) : null,
  };
}

export function getDeepSeekApiKey(): string | null {
  const fromDb = getSetting(DEEPSEEK_API_KEY)?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.DEEPSEEK_API_KEY?.trim();
  return fromEnv || null;
}

export function isDeepSeekEnabled(): boolean {
  return getDeepSeekSettings().enabled && !!getDeepSeekApiKey();
}

export function setDeepSeekSettings(input: {
  enabled?: boolean;
  model?: string;
  baseUrl?: string;
  apiKey?: string | null;
}): DeepSeekSettings {
  if (input.enabled !== undefined) {
    setSetting(DEEPSEEK_ENABLED, input.enabled ? '1' : '0');
  }
  if (input.model !== undefined) {
    const model = String(input.model || DEFAULT_MODEL).trim().slice(0, 64) || DEFAULT_MODEL;
    setSetting(DEEPSEEK_MODEL, model);
  }
  if (input.baseUrl !== undefined) {
    const baseUrl = normalizeBaseUrl(String(input.baseUrl || DEFAULT_BASE_URL)).slice(0, 300);
    setSetting(DEEPSEEK_BASE_URL, baseUrl);
  }
  if (input.apiKey !== undefined) {
    const key = input.apiKey === null ? '' : String(input.apiKey).trim();
    setSetting(DEEPSEEK_API_KEY, key);
  }
  return getDeepSeekSettings();
}
