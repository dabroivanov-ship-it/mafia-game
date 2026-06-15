// Настройки игры (можно менять)
import type { GamePhase, RoleId } from '../types/index.js';

export const CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 10,
  DEFAULT_MAX_PLAYERS: 6,
  REGISTRATION_SEC: 60,
  ROLE_REVEAL_SEC: 20,
  JOIN_GAME_COOLDOWN_SEC: 15,
  DISCONNECT_GRACE_SEC: 90,
  DAY_DISCUSSION_SEC: 60,
  NIGHT_ACTIONS_SEC: 60,
  ROOM_COUNT: 3,
} as const;

export const PHASE = {
  WAITING: 'waiting',
  REGISTRATION: 'registration',
  ROLES: 'roles',
  DAY: 'day',
  VOTING: 'voting',
  NIGHT: 'night',
  ENDED: 'ended',
} as const satisfies Record<string, GamePhase>;

export const ROLE_LABELS: Record<RoleId, string> = {
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
export const MAFIA_ROLES: RoleId[] = ['mafia'];
export const EVIL_ROLES: RoleId[] = ['mafia', 'maniac'];
export const TOWN_ROLES: RoleId[] = [
  'commissar',
  'doctor',
  'homeless',
  'prostitute',
  'clown',
  'commissar_wife',
  'highlander',
  'civilian',
];

export function isLobbyPhase(phase: GamePhase): phase is 'waiting' | 'ended' {
  return phase === PHASE.WAITING || phase === PHASE.ENDED;
}

export function isActiveGamePhase(phase: GamePhase): boolean {
  return phase === PHASE.ROLES || phase === PHASE.DAY || phase === PHASE.VOTING || phase === PHASE.NIGHT;
}
