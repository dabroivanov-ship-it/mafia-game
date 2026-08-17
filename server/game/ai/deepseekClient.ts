import {
  getDeepSeekApiKey,
  getDeepSeekChatUrl,
  getDeepSeekSettings,
} from '../../settings/deepseekStore.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function deepSeekJsonChat<T>(
  messages: ChatMessage[],
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('DeepSeek API key не настроен');
  }
  const { model } = getDeepSeekSettings();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);

  try {
    const res = await fetch(getDeepSeekChatUrl(), {
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
  } finally {
    clearTimeout(timeout);
  }
}

export async function testDeepSeekConnection(): Promise<void> {
  const result = await deepSeekJsonChat<{ ok?: boolean }>(
    [
      { role: 'system', content: 'Ответь JSON: {"ok":true}' },
      { role: 'user', content: 'ping' },
    ],
    { timeoutMs: 15_000 }
  );
  if (!result?.ok) {
    throw new Error('Неожиданный ответ DeepSeek');
  }
}
