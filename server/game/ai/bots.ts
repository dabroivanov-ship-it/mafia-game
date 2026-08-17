import type { GamePlayer, GameRoom } from '../../types/index.js';

export const MAX_AI_BOTS = 10;

const BOT_NAMES = [
  'Анна',
  'Борис',
  'Вика',
  'Глеб',
  'Даша',
  'Егор',
  'Женя',
  'Илья',
  'Кира',
  'Лёша',
  'Мила',
  'Никита',
  'Оля',
  'Павел',
  'Рита',
  'Саша',
  'Таня',
  'Федя',
  'Юля',
  'Яна',
];

let nextBotNameIndex = 0;

export function clampAiCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_AI_BOTS, Math.floor(n)));
}

function pickBotName(room: GameRoom): string {
  const used = new Set(
    room.players.filter((p) => p.isBot).map((p) => p.name.toLowerCase())
  );
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const name = BOT_NAMES[(nextBotNameIndex + i) % BOT_NAMES.length];
    if (!used.has(name.toLowerCase())) {
      nextBotNameIndex = (nextBotNameIndex + i + 1) % BOT_NAMES.length;
      return name;
    }
  }
  nextBotNameIndex += 1;
  return `Бот ${nextBotNameIndex}`;
}

export function createBotPlayer(room: GameRoom, playerId: number): GamePlayer {
  const name = pickBotName(room);
  return {
    id: playerId,
    userId: null,
    name,
    username: name,
    socketId: null,
    inGame: true,
    role: null,
    alive: true,
    score: 0,
    connected: true,
    isDon: false,
    hasVoted: false,
    nightActionDone: false,
    isBot: true,
    leftEarly: false,
    joinGameAvailableAt: 0,
    disconnectedAt: null,
    silencedUntil: null,
    silenceReason: null,
    mutedChat: [],
  };
}

export function removeAiBots(room: GameRoom): void {
  room.players = room.players.filter((p) => !p.isBot);
}

export function ensureAiBots(room: GameRoom, allocatePlayerId: () => number): GamePlayer[] {
  if (!room.aiEnabled || room.aiCount <= 0) return [];

  const added: GamePlayer[] = [];
  const currentBots = room.players.filter((p) => p.isBot).length;
  const toAdd = Math.min(room.aiCount - currentBots, room.maxPlayers - room.players.length);
  for (let i = 0; i < toAdd; i++) {
    const bot = createBotPlayer(room, allocatePlayerId());
    room.players.push(bot);
    added.push(bot);
  }
  return added;
}
