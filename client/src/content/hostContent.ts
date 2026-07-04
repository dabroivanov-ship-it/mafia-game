export const HOST_SENDER_NAME = 'Ведущий';

export const HOST_SENDER_ALIASES = new Set([HOST_SENDER_NAME, '🤖 Ведущий']);

export function isHostSender(name: string | undefined | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return HOST_SENDER_ALIASES.has(trimmed) || trimmed.replace(/^🤖\s*/, '') === HOST_SENDER_NAME;
}

export const HOST_PROFILE_INTRO =
  'Автоматический ведущий онлайн-игры «Мафия». Живого человека в роли ведущего не требуется.';

export const HOST_PROFILE_DUTIES = [
  'Запускает регистрацию и раздаёт роли игрокам в личных сообщениях [P].',
  'Объявляет фазы дня и ночи, напоминает о таймере и ходе игры.',
  'Проводит голосование, подсчитывает голоса и объявляет результаты.',
  'Фиксирует ночные действия ролей и сообщает итоги раунда.',
  'Тексты объявлений настраиваются администратором в разделе «Фразы ведущего».',
];
