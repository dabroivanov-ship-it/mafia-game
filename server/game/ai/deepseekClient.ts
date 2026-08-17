import {
  getDeepSeekApiKey,
  getDeepSeekChatUrl,
  getDeepSeekSettings,
} from '../../settings/deepseekStore.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function abortErrorMessage(err: unknown): string | null {
  if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
    return 'Нет ответа от API (таймаут). Проверьте Base URL и Model ID, затем сохраните настройки.';
  }
  return null;
}

export async function deepSeekJsonChat<T>(
  messages: ChatMessage[],
  options: { timeoutMs?: number; model?: string; baseUrl?: string; apiKey?: string } = {}
): Promise<T> {
  const saved = getDeepSeekSettings();
  const apiKey = options.apiKey?.trim() || getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('DeepSeek API key не настроен');
  }
  const model = options.model?.trim() || saved.model;
  const url = getDeepSeekChatUrl(options.baseUrl || saved.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DeepSeek API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Пустой ответ DeepSeek');
    return JSON.parse(content) as T;
  } catch (err) {
    const abortMessage = abortErrorMessage(err);
    if (abortMessage) throw new Error(abortMessage);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testDeepSeekConnection(options: {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
} = {}): Promise<{ model: string }> {
  const saved = getDeepSeekSettings();
  const apiKey = options.apiKey?.trim() || getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('DeepSeek API key не настроен. Вставьте ключ и нажмите «Сохранить DeepSeek».');
  }
  const model = options.model?.trim() || saved.model;
  const url = getDeepSeekChatUrl(options.baseUrl || saved.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`DeepSeek API ${res.status}: ${text.slice(0, 220)}`);
    }
    const data = JSON.parse(text || '{}') as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (data.error?.message) {
      throw new Error(data.error.message);
    }
    if (!data.choices?.[0]?.message) {
      throw new Error('API ответил, но без текста модели. Проверьте Model ID.');
    }
    return { model };
  } catch (err) {
    const abortMessage = abortErrorMessage(err);
    if (abortMessage) throw new Error(abortMessage);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
