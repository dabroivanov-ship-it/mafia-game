import { getTelegramSettings } from '../settings/store.js';
import { isValidWebAppUrl } from '../security/validate.js';

const API_BASE = 'https://api.telegram.org';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
  };
}

function resolveWebAppUrl(): string | null {
  const candidates = [
    getTelegramSettings().webAppUrl?.trim(),
    process.env.TELEGRAM_WEBAPP_URL?.trim(),
    process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).find(Boolean),
  ];
  for (const url of candidates) {
    if (!url || !isValidWebAppUrl(url)) continue;
    if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) continue;
    return url;
  }
  return null;
}

async function callBotApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
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

async function sendStartMessage(token: string, chatId: number): Promise<void> {
  const webAppUrl = resolveWebAppUrl();
  const text = webAppUrl
    ? 'Добро пожаловать в игру «Мафия»!\n\nНажмите кнопку ниже, чтобы открыть игру.'
    : 'Добро пожаловать в игру «Мафия»!\n\nWeb App пока не настроен — укажите URL сайта в админ-панели.';

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (webAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: '🎮 Играть',
            web_app: { url: webAppUrl },
          },
        ],
      ],
    };
  }

  await callBotApi(token, 'sendMessage', payload);
}

async function handleUpdate(token: string, update: TelegramUpdate): Promise<void> {
  const text = update.message?.text?.trim();
  if (!text || !update.message) return;

  const chatId = update.message.chat.id;
  const command = text.split(/\s+/)[0]?.toLowerCase();
  if (command !== '/start') return;

  await sendStartMessage(token, chatId);
}

async function pollUpdates(token: string, signal: AbortSignal): Promise<void> {
  let offset = 0;

  while (!signal.aborted) {
    try {
      const res = await fetch(
        `${API_BASE}/bot${token}/getUpdates?timeout=30&offset=${offset}&allowed_updates=${encodeURIComponent(JSON.stringify(['message']))}`,
        { signal }
      );
      const data = (await res.json()) as { ok: boolean; result?: TelegramUpdate[]; description?: string };
      if (!data.ok) {
        console.error('Telegram getUpdates error:', data.description || 'unknown');
        await sleep(5000, signal);
        continue;
      }

      for (const update of data.result || []) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(token, update);
        } catch (err) {
          console.error('Telegram update handler error:', err);
        }
      }
    } catch (err) {
      if (signal.aborted) break;
      console.error('Telegram polling error:', err);
      await sleep(5000, signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

async function configureMenuButton(token: string): Promise<void> {
  const webAppUrl = resolveWebAppUrl();
  if (!webAppUrl) return;

  await callBotApi(token, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Играть',
      web_app: { url: webAppUrl },
    },
  });
}

export async function startTelegramBot(): Promise<() => void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return () => {};
  }

  const controller = new AbortController();

  try {
    await callBotApi(token, 'deleteWebhook', { drop_pending_updates: false });
    await configureMenuButton(token);
    console.log('🤖 Telegram bot: polling started (/start → кнопка «Играть»)');
  } catch (err) {
    console.error('Telegram bot init error:', err);
  }

  void pollUpdates(token, controller.signal);

  return () => controller.abort();
}
