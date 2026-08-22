import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { getBotToken, sendDocument } from '../telegram/api.js';
import { formatBackupSize, resolveBackupDir } from './service.js';
import { getTelegramBackupChatId } from './telegramSettings.js';

const execFileAsync = promisify(execFile);
const TELEGRAM_MAX_BYTES = 50 * 1024 * 1024;

export async function sendBackupToTelegram(backupId: string): Promise<void> {
  const token = getBotToken();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN не задан на сервере');
  }

  const chatId = getTelegramBackupChatId();
  if (!chatId) {
    throw new Error('Укажите chat ID получателя в настройках бэкапа');
  }

  const dir = resolveBackupDir(backupId);
  if (!fs.existsSync(path.join(dir, 'mafia.db'))) {
    throw new Error('Резервная копия не найдена');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mafia-backup-'));
  const archiveName = `mafia-backup-${backupId}.tar.gz`;
  const archivePath = path.join(tmpDir, archiveName);

  try {
    const parent = path.dirname(dir);
    const name = path.basename(dir);
    await execFileAsync('tar', ['-czf', archivePath, '-C', parent, name]);

    const size = fs.statSync(archivePath).size;
    if (size > TELEGRAM_MAX_BYTES) {
      throw new Error(
        `Архив слишком большой (${formatBackupSize(size)}). Лимит Telegram — 50 МБ. Создайте копию без uploads.`
      );
    }

    const createdAt = fs.existsSync(path.join(dir, 'manifest.json'))
      ? (JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as { createdAt?: string })
          .createdAt
      : null;

    const caption = [
      'Резервная копия Mafia',
      createdAt ? new Date(createdAt).toLocaleString('ru-RU') : backupId,
      `Размер: ${formatBackupSize(size)}`,
    ].join('\n');

    await sendDocument(token, chatId, archivePath, caption);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
