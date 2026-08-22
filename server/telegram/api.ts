import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.telegram.org';

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export async function callBotApi<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed`);
  }
  return data.result as T;
}

export async function sendDocument(
  token: string,
  chatId: string,
  filePath: string,
  caption?: string
): Promise<void> {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption.slice(0, 1024));

  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  form.append('document', new Blob([fileBuffer]), fileName);

  const res = await fetch(`${API_BASE}/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description || 'Telegram sendDocument failed');
  }
}
