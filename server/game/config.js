// Настройки игры (можно менять)
export const CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 10,
  DEFAULT_MAX_PLAYERS: 6,
  REGISTRATION_SEC: 60,
  DAY_DISCUSSION_SEC: 60,
  NIGHT_ACTIONS_SEC: 60,
  ROOM_COUNT: 3,
};

export const PHASE = {
  WAITING: 'waiting',
  REGISTRATION: 'registration',
  DAY: 'day',
  VOTING: 'voting',
  NIGHT: 'night',
  ENDED: 'ended',
};

export const ROLE_LABELS = {
  mafia: 'Мафия',
  commissar: 'Катани',
  doctor: 'Доктор',
  homeless: 'Бомж',
  prostitute: 'Путана',
  maniac: 'Маньяк',
  clown: 'Клоун',
  commissar_wife: 'Жена комиссара',
  highlander: 'Горец',
  civilian: 'Мирный гражданин',
};

// Категории для проверок победы и очков
export const MAFIA_ROLES = ['mafia'];
export const EVIL_ROLES = ['mafia', 'maniac'];
export const TOWN_ROLES = [
  'commissar',
  'doctor',
  'homeless',
  'prostitute',
  'clown',
  'commissar_wife',
  'highlander',
  'civilian',
];
