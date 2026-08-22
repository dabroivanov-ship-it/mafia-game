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
    key: 'atmosphere.homeless',
    group: 'Ночь',
    label: 'Атмосфера: бомж',
    type: 'lines',
    defaultValue: [
      'Бомж шарится по дворам и заглядывает в чужие окна...',
      'У помойки кто-то решает, к кому подслушать этой ночью...',
    ].join('\n'),
  },
  {
    key: 'atmosphere.prostitute',
    group: 'Ночь',
    label: 'Атмосфера: путана',
    type: 'lines',
    defaultValue: [
      'Путана выбирает, кого оставить без ночного хода...',
      'В одном из окон ещё горит свет — путана уже в деле...',
      'Кто-то этой ночью не успеет сделать свой ход...',
    ].join('\n'),
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
    key: 'atmosphere.samurai',
    group: 'Ночь',
    label: 'Атмосфера: самурай',
    type: 'lines',
    defaultValue: [
      'Самурай этой ночью встаёт у чужой двери...',
      'Кто-то готов закрыть другого ценой своей жизни...',
    ].join('\n'),
  },
  {
    key: 'atmosphere.clown',
    group: 'Ночь',
    label: 'Атмосфера: клоун',
    type: 'lines',
    defaultValue: [
      'Клоун этой ночью затевает обмен ролями...',
      'В темноте клоун выбирает, кого поменять местами...',
    ].join('\n'),
  },
  {
    key: 'atmosphere.commissar_wife',
    group: 'Ночь',
    label: 'Атмосфера: жена комиссара',
    type: 'lines',
    defaultValue: [
      'Жена комиссара этой ночью мстит за Катани...',
      'После гибели инспектора кто-то выходит на месть...',
    ].join('\n'),
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
    key: 'morning.deaths',
    group: 'Утро',
    label: 'Утро: список погибших',
    type: 'text',
    placeholders: ['{list}'],
    defaultValue: 'Этой ночью погибли: {list}.',
  },
  {
    key: 'morning.after_kills',
    group: 'Утро',
    label: 'Утро после ночных убийств',
    type: 'text',
    defaultValue: 'Вот и день наступил. Но все ли дожили до него?',
  },
  {
    key: 'report.commissar_check',
    group: 'Сводка дня',
    label: 'Катани проверил игрока',
    type: 'lines',
    hint: 'Одна фраза на строку. Результат проверки в общий чат не пишите.',
    placeholders: ['{nick}'],
    defaultValue: [
      'Инспектор Катани времени зря не терял. Проведя тщательное расследование, он наконец-то выяснил, кто такой {nick}!',
      'Катани не спал. К утру у него было имя: {nick}.',
      'Инспектор Катани провёл ночь за делом и вышел к городу: он знает, кто такой {nick}.',
    ].join('\n'),
  },
  {
    key: 'report.homeless_check',
    group: 'Сводка дня',
    label: 'Бомж проверил игрока',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Бомж этой ночью заглянул не в те окна и теперь знает, кто такой {nick}.',
      'По дворам ходил бомж. К рассвету он выяснил, кто такой {nick}.',
    ].join('\n'),
  },
  {
    key: 'report.prostitute',
    group: 'Сводка дня',
    label: 'Путана соблазнила',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Путана не дала {nick} заняться своими ночными делами.',
      '{nick} этой ночью был(а) занят(а) — до своих дел так и не добрался(ась).',
    ].join('\n'),
  },
  {
    key: 'report.doctor_heal',
    group: 'Сводка дня',
    label: 'Доктор лечил',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Доктор не сидел сложа руки: к утру {nick} был(а) цел(а).',
      'Этой ночью кто-то успел к {nick} с аптечкой.',
    ].join('\n'),
  },
  {
    key: 'report.doctor_self',
    group: 'Сводка дня',
    label: 'Доктор лечил себя',
    type: 'lines',
    placeholders: [],
    defaultValue: ['Доктор занимался самолечением.'].join('\n'),
  },
  {
    key: 'report.advocate_cover',
    group: 'Сводка дня',
    label: 'Адвокат укрыл',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Адвокат этой ночью заметал следы вокруг {nick}.',
    ].join('\n'),
  },
  {
    key: 'report.commissar_kill_don',
    group: 'Сводка дня',
    label: 'Комиссар убил дона',
    type: 'text',
    placeholders: ['{role}', '{nick}'],
    defaultValue:
      'Катани этой ночью не проверял — стрелял. Не стало {nick}.',
  },
  {
    key: 'report.commissar_kill_mafioso',
    group: 'Сводка дня',
    label: 'Комиссар убил мафиози',
    type: 'text',
    placeholders: ['{role}', '{nick}'],
    defaultValue: 'Катани этой ночью сам нажал на курок. Не стало {nick}.',
  },
  {
    key: 'report.commissar_kill_other',
    group: 'Сводка дня',
    label: 'Комиссар убил игрока',
    type: 'text',
    placeholders: ['{role}', '{roleName}', '{nick}'],
    defaultValue: 'Инспектор Катани этой ночью выстрелил. Не стало {nick}.',
  },
  {
    key: 'report.commissar_saved',
    group: 'Сводка дня',
    label: 'Доктор спас от выстрела Катани',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Катани выстрелил в {nick}, но тот дожил до утра: доктор успел.',
    ].join('\n'),
  },
  {
    key: 'report.mafia_kill',
    group: 'Сводка дня',
    label: 'Мафия убила жертву',
    type: 'lines',
    placeholders: ['{role}', '{nick}'],
    defaultValue: [
      'Главарь мафии этой ночью оставил без зубов {nick}.',
      'Главарь мафии этой ночью разобрался с {nick}.',
      'Мафия этой ночью не оставила {nick} шанса.',
    ].join('\n'),
  },
  {
    key: 'report.mafia_saved',
    group: 'Сводка дня',
    label: 'Доктор спас от мафии',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Мафия устроила терракт, но {nick} выбрался живым: доктор был рядом.',
    ].join('\n'),
  },
  {
    key: 'report.highlander',
    group: 'Сводка дня',
    label: 'Горец пережил атаку мафии',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Мафия била в {nick}, но горец встал и ушёл.',
    ].join('\n'),
  },
  {
    key: 'report.samurai_die',
    group: 'Сводка дня',
    label: 'Самурай погиб, закрыв игрока',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Самурай закрыл {nick} собой и не дожил до утра.',
      '{nick} остался жив: самурай принял удар на себя.',
    ].join('\n'),
  },
  {
    key: 'report.samurai_saved',
    group: 'Сводка дня',
    label: 'Доктор спас самурая после закрытия',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Самурай закрыл {nick} собой, но доктор успел к самураю.',
      '{nick} был под защитой самурая — и доктор не дал самураю погибнуть.',
    ].join('\n'),
  },
  {
    key: 'report.maniac_kill',
    group: 'Сводка дня',
    label: 'Маньяк убил',
    type: 'lines',
    placeholders: ['{role}', '{nick}'],
    defaultValue: [
      'Маньяк этой ночью оставил без зубов {nick}.',
      'Маньяк этой ночью разобрался с {nick}.',
    ].join('\n'),
  },
  {
    key: 'report.maniac_saved',
    group: 'Сводка дня',
    label: 'Доктор спас от маньяка',
    type: 'lines',
    placeholders: ['{nick}'],
    defaultValue: [
      'Маньяк напал на {nick}, но доктор вытащил его до рассвета.',
    ].join('\n'),
  },
  {
    key: 'report.wife_kill',
    group: 'Сводка дня',
    label: 'Месть жены комиссара',
    type: 'text',
    placeholders: ['{role}', '{nick}'],
    defaultValue: 'Жена комиссара этой ночью отомстила. Не стало {nick}.',
  },
  {
    key: 'report.clown_swap',
    group: 'Сводка дня',
    label: 'Клоун поменял роли',
    type: 'lines',
    placeholders: ['{a}', '{b}'],
    defaultValue: [
      'К утру {a} и {b} будто поменялись местами — клоун постарался.',
    ].join('\n'),
  },
  {
    key: 'day.discussion',
    group: 'День',
    label: 'Начало дня',
    type: 'text',
    placeholders: ['{day}'],
    defaultValue: 'День {day}. Город просыпается. Пора решать, кто ответит за эту ночь.',
  },
  {
    key: 'day.discussion_private',
    group: 'День',
    label: 'День: личное напоминание',
    type: 'text',
    placeholders: ['{day}'],
    defaultValue: '☀️ День {day}. Выдвиньте кандидата на казнь в панели действий.',
  },
  {
    key: 'voting.start',
    group: 'Голосование',
    label: 'Старт голосования',
    type: 'text',
    defaultValue: '🗳️ Выдвиньте кандидата на казнь. Когда одного выберут не меньше половины — появится голосование «да» или «нет».',
  },
  {
    key: 'voting.timeout',
    group: 'Голосование',
    label: 'Время голосования вышло',
    type: 'text',
    defaultValue: '⏱ Время голосования вышло. Город не выбрал, кого казнить.',
  },
  {
    key: 'voting.cast',
    group: 'Голосование',
    label: 'Игрок отдал голос',
    type: 'text',
    placeholders: ['{voter}', '{target}'],
    defaultValue: '🗳️ {voter} голосует за {target}.',
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
    key: 'report.mafia_no_decision',
    group: 'Ночь',
    label: 'Главарь не выбрал жертву',
    type: 'text',
    defaultValue: 'Главарь мафии не определился с жертвой — от их рук никто не пострадал.',
  },
  {
    key: 'voting.majority',
    group: 'Голосование',
    label: 'Кандидат на казнь',
    type: 'text',
    placeholders: ['{name}', '{votes}', '{total}'],
    defaultValue:
      'Жители, вы уверены, что хотите казнить {name}?(да или нет) {name}, у вас есть время оправдаться.',
  },
  {
    key: 'voting.hang_choice',
    group: 'Голосование',
    label: 'Голос да/нет',
    type: 'text',
    placeholders: ['{voter}', '{choice}', '{accused}'],
    defaultValue: '{voter} — {choice} ({accused}).',
  },
  {
    key: 'voting.spared',
    group: 'Голосование',
    label: 'Город пощадил',
    type: 'text',
    placeholders: ['{name}'],
    defaultValue: 'Город оправдал {name}. Можно выдвинуть другого кандидата.',
  },
  {
    key: 'voting.restart',
    group: 'Голосование',
    label: 'Новый этап отбора',
    type: 'text',
    defaultValue: '🗳️ Выберите заново, кого выдвинуть.',
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
    defaultValue: 'Вы — главарь мафии. Выберите жертву в панели действий — только ваш выбор решает.',
  },
  {
    key: 'prompt.mafia',
    group: 'Подсказки ролей',
    label: 'Мафия',
    type: 'text',
    defaultValue: 'Жертву выбирает главарь мафии. Если он погибнет или дважды подряд не выберет жертву, будучи в сети — главой станете вы.',
  },
  {
    key: 'prompt.mafia.wait',
    group: 'Подсказки ролей',
    label: 'Мафия: ожидание главаря',
    type: 'text',
    defaultValue: 'Главарь мафии выбирает жертву. Дождитесь его решения — при его гибели или если он дважды подряд не выберет жертву, будучи в сети, вы станете новым главарём.',
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
    defaultValue: 'Выберите, кого вылечить этой ночью (себя — не чаще раза в 3 ночи). Спасает от мафии, маньяка и выстрела Катани. Если самурай принял удар на себя — лечите самурая, не его цель.',
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
    defaultValue: 'Выберите, кого соблазнить — ночной ход цели этой ночью не сработает (дон, Катани, доктор, маньяк, самурай, клоун и любой другой, кто ходит).',
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
    key: 'prompt.samurai',
    group: 'Подсказки ролей',
    label: 'Самурай',
    type: 'text',
    defaultValue:
      'Кого закрыть этой ночью? Смертельный удар по цели примите на себя. Себя закрывать нельзя. Доктор может спасти вас, если вылечит именно вас.',
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
    key: 'note.mafia_allies',
    group: 'Личные сообщения',
    label: 'Союзники мафии',
    type: 'text',
    placeholders: ['{list}'],
    defaultValue: 'Союзники: {list}.',
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

export function pickPhraseLine(key: string, vars?: Record<string, string | number>): string {
  const lines = getPhraseLines(key);
  if (lines.length === 0) return vars ? getPhraseText(key, vars) : '';
  const line = lines[Math.floor(Math.random() * lines.length)];
  return vars ? renderPhraseTemplate(line, vars) : line;
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
