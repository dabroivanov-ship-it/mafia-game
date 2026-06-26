import { getBotPhraseOverrides, setBotPhraseOverrides } from '../settings/botPhrasesStore.js';

export type BotPhraseType = 'text' | 'lines';

export interface BotPhraseDefinition {
  key: string;
  group: string;
  label: string;
  hint?: string;
  type: BotPhraseType;
  placeholders?: string[];
  defaultValue: string;
}

export const BOT_PHRASE_DEFINITIONS: BotPhraseDefinition[] = [
  {
    key: 'game.start',
    group: 'Игра',
    label: 'Старт игры',
    type: 'text',
    placeholders: ['{count}'],
    defaultValue: 'Начинается игра «Мафия»! Зарегистрировалось игроков: {count}.',
  },
  {
    key: 'game.roles_reveal',
    group: 'Игра',
    label: 'После раздачи ролей',
    type: 'text',
    placeholders: ['{seconds}'],
    defaultValue: 'Раздача ролей окончена! Ночь начнётся через {seconds} сек.',
  },
  {
    key: 'night.complete',
    group: 'Ночь',
    label: 'Ночь завершена',
    type: 'text',
    defaultValue: 'Всё, что могло свершиться ночью, свершилось.',
  },
  {
    key: 'night.fall',
    group: 'Ночь',
    label: 'Наступление ночи (варианты)',
    type: 'lines',
    hint: 'Одна фраза на строку. Выбирается случайная.',
    defaultValue: [
      'Наступает ночь, все жители засыпают, кроме некоторых...',
      'Город погружаетcя в темноту. Ночь начинается...',
      'Фонари гаснут. Наступает ночь...',
    ].join('\n'),
  },
  {
    key: 'atmosphere.mafia',
    group: 'Ночь',
    label: 'Атмосфера: мафия',
    type: 'lines',
    defaultValue: [
      'Главарь мафии высматривает свою жертву. За ним следуют его союзники...',
      'Мафиози, вооружившись до зубов, направляются на встречу со своей жертвой...',
      'В тени переулков мафия выбирает, кто не доживёт до рассвета...',
    ].join('\n'),
  },
  {
    key: 'atmosphere.commissar',
    group: 'Ночь',
    label: 'Атмосфера: комиссар',
    type: 'lines',
    defaultValue: [
      'Комиссар Катани ходит по комнате и вычисляет мафию...',
      'Комиссар Катани лежит в засаде и следит за мафией...',
      'Инспектор Катани внимательно изучает поведение игроков...',
    ].join('\n'),
  },
  {
    key: 'atmosphere.doctor',
    group: 'Ночь',
    label: 'Атмосфера: доктор',
    type: 'lines',
    defaultValue: ['Доктор готовит аптечку и выбирает, кого спасти этой ночью...'].join('\n'),
  },
  {
    key: 'atmosphere.maniac',
    group: 'Ночь',
    label: 'Атмосфера: маньяк',
    type: 'lines',
    defaultValue: ['Где-то в темноте маньяк выбирает новую жертву...'].join('\n'),
  },
  {
    key: 'atmosphere.advocate',
    group: 'Ночь',
    label: 'Атмосфера: адвокат',
    type: 'lines',
    defaultValue: ['Адвокат готовит алиби для своих клиентов из тени...'].join('\n'),
  },
  {
    key: 'morning.all_alive',
    group: 'Утро',
    label: 'Утро: все живы',
    type: 'text',
    defaultValue: 'Вот и день наступил. Этой ночью все остались живы.',
  },
  {
    key: 'morning.intro_prefix',
    group: 'Утро',
    label: 'Утро: есть погибшие (начало)',
    type: 'text',
    defaultValue: 'Вот и день наступил. Но все ли дожили до него?',
  },
  {
    key: 'morning.killed_commissar',
    group: 'Утро',
    label: 'Утро: погиб комиссар',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Не все дожили до рассвета — среди погибших комиссар {nick}.',
  },
  {
    key: 'morning.killed_player',
    group: 'Утро',
    label: 'Утро: погиб игрок',
    type: 'text',
    placeholders: ['{nick}', '{role}'],
    defaultValue: '{nick} ({role}) не дожил(а) до утра.',
  },
  {
    key: 'morning.after_kills',
    group: 'Утро',
    label: 'Утро после ночных убийств',
    type: 'text',
    defaultValue: 'Вот и день наступил.',
  },
  {
    key: 'report.commissar_kill_don',
    group: 'Сводка ночи',
    label: 'Комиссар убил дона',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Комиссар Катани убил Главаря мафии {nick}',
  },
  {
    key: 'report.commissar_kill_mafioso',
    group: 'Сводка ночи',
    label: 'Комиссар убил мафиози',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Комиссар Катани убил мафиози {nick}',
  },
  {
    key: 'report.commissar_kill_other',
    group: 'Сводка ночи',
    label: 'Комиссар убил игрока',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Комиссар Катани убил {nick}',
  },
  {
    key: 'report.mafia_kill',
    group: 'Сводка ночи',
    label: 'Мафия убила жертву',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Мафия убила обывателя {nick}.',
  },
  {
    key: 'report.maniac_kill',
    group: 'Сводка ночи',
    label: 'Маньяк убил',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Маньяк убил {nick}.',
  },
  {
    key: 'report.wife_kill',
    group: 'Сводка ночи',
    label: 'Месть жены комиссара',
    type: 'text',
    placeholders: ['{nick}'],
    defaultValue: 'Жена комиссара отомстила — убила {nick}.',
  },
  {
    key: 'day.discussion',
    group: 'День',
    label: 'Начало дня',
    type: 'text',
    placeholders: ['{day}'],
    defaultValue: '☀️ День {day}. Обсуждайте подозреваемых и готовьтесь к голосованию.',
  },
  {
    key: 'day.discussion_private',
    group: 'День',
    label: 'День: личное напоминание',
    type: 'text',
    placeholders: ['{day}'],
    defaultValue:
      '☀️ День {day}. Обсудите подозреваемых в общем чате. Когда будете готовы — нажмите «Начать голосование» в панели действий.',
  },
  {
    key: 'voting.start',
    group: 'Голосование',
    label: 'Старт голосования',
    type: 'text',
    defaultValue: '🗳️ Голосование началось! Выберите, кого повесить.',
  },
  {
    key: 'voting.tie',
    group: 'Голосование',
    label: 'Ничья при голосовании',
    type: 'text',
    defaultValue: 'Голоса разделились — казнь не состоялась. Начинается новый этап отбора.',
  },
  {
    key: 'voting.count',
    group: 'Голосование',
    label: 'Подсчёт голосов',
    type: 'text',
    defaultValue: '🗳️ Все проголосовали. Подсчёт голосов...',
  },
  {
    key: 'voting.restart',
    group: 'Голосование',
    label: 'Новый этап отбора',
    type: 'text',
    defaultValue: '🗳️ Выберите заново, кого казнить.',
  },
  {
    key: 'voting.hang',
    group: 'Голосование',
    label: 'Вердикт: повешен',
    type: 'text',
    placeholders: ['{nick}', '{role}'],
    defaultValue: 'Город решил повесить {nick}. Он оказался {role}.',
  },
  {
    key: 'check.commissar',
    group: 'Проверки',
    label: 'Результат проверки Катани',
    type: 'text',
    placeholders: ['{nick}', '{role}', '{verdict}'],
    defaultValue: '🔍 Результат проверки: {nick} — {role}. {verdict}',
  },
  {
    key: 'check.commissar_verdict_evil',
    group: 'Проверки',
    label: 'Вердикт: мафия/зло',
    type: 'text',
    defaultValue: 'Это мафия (или зло)!',
  },
  {
    key: 'check.commissar_verdict_town',
    group: 'Проверки',
    label: 'Вердикт: не мафия',
    type: 'text',
    defaultValue: 'Это не мафия.',
  },
  {
    key: 'check.commissar_masked_role',
    group: 'Проверки',
    label: 'Роль при укрытии адвокатом',
    type: 'text',
    defaultValue: 'Мирный житель',
  },
  {
    key: 'check.homeless',
    group: 'Проверки',
    label: 'Результат проверки бомжа',
    type: 'text',
    placeholders: ['{nick}', '{role}'],
    defaultValue: '🔍 Результат проверки: {nick} — {role}.',
  },
  {
    key: 'prompt.mafia.don',
    group: 'Подсказки ролей',
    label: 'Мафия: дон',
    type: 'text',
    defaultValue: 'Вы — главарь мафии. Выберите жертву в панели действий (ваш голос решающий).',
  },
  {
    key: 'prompt.mafia',
    group: 'Подсказки ролей',
    label: 'Мафия',
    type: 'text',
    defaultValue: 'Выберите жертву вместе с мафией в панели действий.',
  },
  {
    key: 'prompt.commissar',
    group: 'Подсказки ролей',
    label: 'Комиссар Катани',
    type: 'text',
    defaultValue:
      'Комиссар Катани: проверьте игрока (узнаете роль в личном сообщении) или совершите выстрел.',
  },
  {
    key: 'prompt.doctor',
    group: 'Подсказки ролей',
    label: 'Доктор',
    type: 'text',
    defaultValue: 'Выберите, кого вылечить этой ночью (себя — не чаще раза в 3 ночи).',
  },
  {
    key: 'prompt.homeless',
    group: 'Подсказки ролей',
    label: 'Бомж',
    type: 'text',
    defaultValue: 'Выберите игрока для проверки — роль узнаете в личном сообщении.',
  },
  {
    key: 'prompt.prostitute',
    group: 'Подсказки ролей',
    label: 'Путана',
    type: 'text',
    defaultValue: 'Выберите, кого соблазнить — его ночное действие будет заблокировано.',
  },
  {
    key: 'prompt.maniac',
    group: 'Подсказки ролей',
    label: 'Маньяк',
    type: 'text',
    defaultValue: 'Выберите жертву для убийства.',
  },
  {
    key: 'prompt.clown',
    group: 'Подсказки ролей',
    label: 'Клоун (активен)',
    type: 'text',
    defaultValue: 'Один раз за игру: выберите двух игроков для обмена ролями.',
  },
  {
    key: 'prompt.clown_used',
    group: 'Подсказки ролей',
    label: 'Клоун (использован)',
    type: 'text',
    defaultValue: 'Способность клоуна уже использована.',
  },
  {
    key: 'prompt.wife_revenge',
    group: 'Подсказки ролей',
    label: 'Жена комиссара: месть',
    type: 'text',
    defaultValue: 'Доступна месть! Выберите игрока для убийства.',
  },
  {
    key: 'prompt.wife_idle',
    group: 'Подсказки ролей',
    label: 'Жена комиссара: ожидание',
    type: 'text',
    defaultValue: 'Пока комиссар жив — особых действий нет.',
  },
  {
    key: 'prompt.highlander',
    group: 'Подсказки ролей',
    label: 'Горец',
    type: 'text',
    defaultValue: 'Вы горец — мафия не может вас убить. Ночных действий нет.',
  },
  {
    key: 'prompt.advocate',
    group: 'Подсказки ролей',
    label: 'Адвокат',
    type: 'text',
    defaultValue: 'Выберите мафиози, кого укрыть от проверки Катани этой ночью (не себя).',
  },
  {
    key: 'prompt.civilian',
    group: 'Подсказки ролей',
    label: 'Без ночного действия',
    type: 'text',
    defaultValue: 'У вашей роли нет ночных действий. Дождитесь утра.',
  },
  {
    key: 'prompt.players_suffix',
    group: 'Подсказки ролей',
    label: 'Список игроков (суффикс)',
    type: 'text',
    placeholders: ['{list}'],
    defaultValue: '\nИгроки: {list}.',
  },
  {
    key: 'note.role_reveal',
    group: 'Личные сообщения',
    label: 'Раздача роли',
    type: 'text',
    placeholders: ['{role}', '{donLine}', '{hint}'],
    defaultValue: '🎭 Ваша роль: {role}.{donLine}\n{hint}',
  },
  {
    key: 'note.night_reminder',
    group: 'Личные сообщения',
    label: 'Напоминание ночью',
    type: 'text',
    placeholders: ['{night}', '{prompt}'],
    defaultValue: '🌙 Ночь {night}.\n{prompt}',
  },
  {
    key: 'note.voting_reminder',
    group: 'Личные сообщения',
    label: 'Напоминание о голосовании',
    type: 'text',
    placeholders: ['{others}'],
    defaultValue: '🗳️ Голосование! Кого подозреваете? Выберите игрока в панели действий.\n{others}',
  },
  {
    key: 'note.voting_others',
    group: 'Личные сообщения',
    label: 'Список при голосовании',
    type: 'text',
    placeholders: ['{list}'],
    defaultValue: 'Участники: {list}.',
  },
];

const DEFINITION_BY_KEY = new Map(BOT_PHRASE_DEFINITIONS.map((d) => [d.key, d]));

export function renderPhraseTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = vars[key];
    return val === undefined || val === null ? `{${key}}` : String(val);
  });
}

function defaultFor(key: string): string {
  return DEFINITION_BY_KEY.get(key)?.defaultValue ?? '';
}

export function getPhraseText(key: string, vars?: Record<string, string | number>): string {
  const overrides = getBotPhraseOverrides();
  const raw = overrides[key] ?? defaultFor(key);
  if (!vars) return raw;
  return renderPhraseTemplate(raw, vars);
}

export function getPhraseLines(key: string): string[] {
  const text = getPhraseText(key);
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function pickPhraseLine(key: string): string {
  const lines = getPhraseLines(key);
  if (lines.length === 0) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}

export function listBotPhrasesForAdmin(): {
  phrases: {
    key: string;
    group: string;
    label: string;
    hint?: string;
    type: BotPhraseType;
    placeholders?: string[];
    value: string;
    defaultValue: string;
  }[];
} {
  const overrides = getBotPhraseOverrides();
  return {
    phrases: BOT_PHRASE_DEFINITIONS.map((def) => ({
      key: def.key,
      group: def.group,
      label: def.label,
      hint: def.hint,
      type: def.type,
      placeholders: def.placeholders,
      value: overrides[def.key] ?? def.defaultValue,
      defaultValue: def.defaultValue,
    })),
  };
}

export function updateBotPhrasesFromAdmin(
  updates: Record<string, string>
): { updated: number } {
  const overrides = getBotPhraseOverrides();
  let updated = 0;

  for (const [key, value] of Object.entries(updates)) {
    const def = DEFINITION_BY_KEY.get(key);
    if (!def) continue;
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      if (key in overrides) {
        delete overrides[key];
        updated++;
      }
      continue;
    }
    if (normalized === def.defaultValue) {
      if (key in overrides) {
        delete overrides[key];
        updated++;
      }
      continue;
    }
    if (overrides[key] !== normalized) {
      overrides[key] = normalized;
      updated++;
    }
  }

  setBotPhraseOverrides(overrides);
  return { updated };
}

export function resetBotPhrase(key: string): boolean {
  const def = DEFINITION_BY_KEY.get(key);
  if (!def) return false;
  const overrides = getBotPhraseOverrides();
  if (!(key in overrides)) return false;
  delete overrides[key];
  setBotPhraseOverrides(overrides);
  return true;
}
