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
  // Старая формулировка выдвижения → «голосует за»
  const cast = cache['voting.cast'];
  if (typeof cast === 'string' && cast.includes('выдвигает')) {
    cache['voting.cast'] = cast.replace('выдвигает', 'голосует за');
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(BOT_PHRASES_KEY, JSON.stringify(cache));
  }
  // Старая формулировка выхода на стол
  const majority = cache['voting.majority'];
  const oldMajority =
    '🗳️ Половина и больше ({votes} из {total}) выдвинули {name}. Голосуйте: казнить или нет.';
  if (typeof majority === 'string' && majority.trim() === oldMajority) {
    delete cache['voting.majority'];
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(BOT_PHRASES_KEY, JSON.stringify(cache));
  }
  const prostitute = cache['report.prostitute'];
  const oldProstituteVariants = [
    [
      'Путана не дала {nick} заняться своими ночными делами.',
      '{nick} этой ночью был(а) занят(а) — до своих дел так и не добрался(ась).',
    ].join('\n'),
    [
      'Путана не отпускала {nick} до самого рассвета.',
      'Этой ночью {nick} был(а) не на месте — путана держала при себе.',
    ].join('\n'),
    '{nick} этой ночью был(а) занят(а) путаной — до своих дел так и не добрался.',
    '{nick} этой ночью был(а) занят(а) путаной — до своих дел так и не добрался(ась).',
  ];
  if (typeof prostitute === 'string' && oldProstituteVariants.includes(prostitute.trim())) {
    delete cache['report.prostitute'];
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(BOT_PHRASES_KEY, JSON.stringify(cache));
  } else if (typeof prostitute === 'string' && prostitute.includes('{nick}')) {
    cache['report.prostitute'] = prostitute.split('{nick}').join('{role}');
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(BOT_PHRASES_KEY, JSON.stringify(cache));
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
