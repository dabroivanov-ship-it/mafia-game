import db from '../auth/db.js';
import { getBotToken } from '../telegram/api.js';

const KEY_CHAT_ID = 'telegram_backup_chat_id';

function readSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row?.value?.trim()) return null;
  return row.value.trim();
}

function writeSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function normalizeTelegramChatId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!/^-?\d+$/.test(raw)) {
    throw new Error('Chat ID должен быть числом (например, из @userinfobot)');
  }
  return raw;
}

export function getTelegramBackupChatId(): string | null {
  return readSetting(KEY_CHAT_ID) || process.env.TELEGRAM_BACKUP_CHAT_ID?.trim() || null;
}

export interface TelegramBackupSettings {
  chatId: string | null;
  botConfigured: boolean;
  ready: boolean;
}

export function getTelegramBackupSettings(): TelegramBackupSettings {
  const chatId = getTelegramBackupChatId();
  const botConfigured = !!getBotToken();
  return {
    chatId,
    botConfigured,
    ready: botConfigured && !!chatId,
  };
}

export function setTelegramBackupChatId(value: unknown): TelegramBackupSettings {
  const chatId = normalizeTelegramChatId(value);
  writeSetting(KEY_CHAT_ID, chatId);
  return getTelegramBackupSettings();
}
