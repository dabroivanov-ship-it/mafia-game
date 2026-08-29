import db from '../auth/db.js';
import { createBackup, deleteBackup, listBackups } from './service.js';
import { getTelegramBackupSettings } from './telegramSettings.js';
import { sendBackupToTelegram } from './telegram.js';

const KEY_ENABLED = 'backup_schedule_enabled';
const KEY_TIME = 'backup_schedule_time';
const KEY_INCLUDE_UPLOADS = 'backup_schedule_include_uploads';
const KEY_KEEP_COUNT = 'backup_schedule_keep_count';
const KEY_SEND_TELEGRAM = 'backup_schedule_send_telegram';
const KEY_LAST_RUN = 'backup_schedule_last_run';

const DEFAULT_TIME = '03:00';
const DEFAULT_KEEP_COUNT = 7;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface BackupScheduleSettings {
  enabled: boolean;
  time: string;
  includeUploads: boolean;
  keepCount: number;
  sendToTelegram: boolean;
  lastRunAt: string | null;
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

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === 'true' || value === '1';
}

function parseKeepCount(value: string | null): number {
  if (value === null) return DEFAULT_KEEP_COUNT;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) return DEFAULT_KEEP_COUNT;
  return n;
}

function normalizeTime(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Укажите время в формате ЧЧ:ММ');
  const trimmed = value.trim();
  if (!TIME_RE.test(trimmed)) throw new Error('Неверный формат времени (ЧЧ:ММ, 00:00–23:59)');
  return trimmed;
}

export function getBackupScheduleSettings(): BackupScheduleSettings {
  const timeRaw = readSetting(KEY_TIME);
  return {
    enabled: parseBool(readSetting(KEY_ENABLED), false),
    time: timeRaw && TIME_RE.test(timeRaw) ? timeRaw : DEFAULT_TIME,
    includeUploads: parseBool(readSetting(KEY_INCLUDE_UPLOADS), true),
    keepCount: parseKeepCount(readSetting(KEY_KEEP_COUNT)),
    sendToTelegram: parseBool(readSetting(KEY_SEND_TELEGRAM), false),
    lastRunAt: readSetting(KEY_LAST_RUN),
  };
}

export function setBackupScheduleSettings(input: {
  enabled?: boolean;
  time?: string;
  includeUploads?: boolean;
  keepCount?: number;
  sendToTelegram?: boolean;
}): BackupScheduleSettings {
  if (input.enabled !== undefined) {
    writeSetting(KEY_ENABLED, input.enabled ? 'true' : 'false');
  }
  if (input.time !== undefined) {
    writeSetting(KEY_TIME, normalizeTime(input.time));
  }
  if (input.includeUploads !== undefined) {
    writeSetting(KEY_INCLUDE_UPLOADS, input.includeUploads ? 'true' : 'false');
  }
  if (input.keepCount !== undefined) {
    const keepCount = Number(input.keepCount);
    if (!Number.isInteger(keepCount) || keepCount < 0 || keepCount > 100) {
      throw new Error('Хранить копий: от 0 до 100 (0 — все)');
    }
    writeSetting(KEY_KEEP_COUNT, String(keepCount));
  }
  if (input.sendToTelegram !== undefined) {
    writeSetting(KEY_SEND_TELEGRAM, input.sendToTelegram ? 'true' : 'false');
  }

  return getBackupScheduleSettings();
}

export function pruneOldBackups(keepCount: number): number {
  if (keepCount <= 0) return 0;
  const backups = listBackups();
  if (backups.length <= keepCount) return 0;
  const toDelete = backups.slice(keepCount);
  for (const backup of toDelete) {
    deleteBackup(backup.id);
  }
  return toDelete.length;
}

function scheduledMomentToday(time: string, now: Date): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

function shouldRunNow(settings: BackupScheduleSettings, now = new Date()): boolean {
  if (!settings.enabled) return false;

  const scheduled = scheduledMomentToday(settings.time, now);
  if (now < scheduled) return false;

  if (!settings.lastRunAt) return true;

  const lastRun = new Date(settings.lastRunAt);
  if (Number.isNaN(lastRun.getTime())) return true;

  if (lastRun.toDateString() !== now.toDateString()) return true;

  return lastRun < scheduled;
}

let running = false;
let tickTimer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (running) return;

  const settings = getBackupScheduleSettings();
  if (!shouldRunNow(settings)) return;

  running = true;
  try {
    const backup = await createBackup(settings.includeUploads);
    writeSetting(KEY_LAST_RUN, new Date().toISOString());
    const removed = pruneOldBackups(settings.keepCount);
    console.log(
      `[backup] Автокопия создана (${settings.time}, uploads: ${settings.includeUploads ? 'да' : 'нет'}${
        removed > 0 ? `, удалено старых: ${removed}` : ''
      })`
    );

    if (settings.sendToTelegram) {
      const telegram = getTelegramBackupSettings();
      if (!telegram.ready) {
        console.warn(
          '[backup] Автоотправка в Telegram включена, но бот или chat ID не настроены — пропуск'
        );
      } else {
        try {
          await sendBackupToTelegram(backup.id);
          console.log('[backup] Автокопия отправлена в Telegram');
        } catch (err) {
          console.error('[backup] Не удалось отправить автокопию в Telegram:', err);
        }
      }
    }
  } catch (err) {
    console.error('[backup] Ошибка автокопии:', err);
  } finally {
    running = false;
  }
}

export function startBackupScheduler(): void {
  if (tickTimer) return;
  void tick();
  tickTimer = setInterval(() => void tick(), 60_000);
}
