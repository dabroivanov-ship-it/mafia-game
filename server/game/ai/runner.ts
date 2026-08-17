import { PHASE } from '../config.js';
import { getRoleLabel, isMafiaTeam } from '../roles.js';
import {
  addChatMessage,
  castDayVote,
  submitNightAction,
  isPlayerSilenced,
} from '../engine.js';
import type { GamePlayer, GameRoom, NightAction, RoleId } from '../../types/index.js';
import { isDeepSeekEnabled } from '../../settings/deepseekStore.js';
import { deepSeekJsonChat } from './deepseekClient.js';

const BOT_DELAY_MS = 600;
const DAY_CHAT_MESSAGES = 2;

let broadcastRoom: (roomId: number) => void = () => {};

export function initGameAiRunner(broadcast: (roomId: number) => void): void {
  broadcastRoom = broadcast;
}

function phaseKey(room: GameRoom): string | null {
  if (room.phase === PHASE.DAY) return `day:${room.sessionId}:${room.nightNumber}`;
  if (room.phase === PHASE.VOTING) {
    return `voting:${room.sessionId}:${room.nightNumber}:${room.votingRound ?? 0}`;
  }
  if (room.phase === PHASE.NIGHT) return `night:${room.sessionId}:${room.nightNumber}`;
  return null;
}

function ensureHandledSet(room: GameRoom): Set<string> {
  if (!room.aiHandledPhases) room.aiHandledPhases = new Set();
  return room.aiHandledPhases;
}

export function triggerGameAi(room: GameRoom): void {
  if (!room.aiEnabled || (room.aiCount ?? 0) <= 0) return;
  const key = phaseKey(room);
  if (!key) return;
  const handled = ensureHandledSet(room);
  if (handled.has(key)) return;
  handled.add(key);

  void runAiForRoom(room)
    .catch((err) => console.error(`[ai] room ${room.id}:`, err))
    .finally(() => broadcastRoom(room.id));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aliveBots(room: GameRoom): GamePlayer[] {
  return room.players.filter((p) => p.isBot && p.alive && p.inGame && p.role && p.connected);
}

function aliveTargets(room: GameRoom, excludeId: number): GamePlayer[] {
  return room.players.filter(
    (p) => p.alive && p.inGame && p.role && p.connected && p.id !== excludeId
  );
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function buildPublicState(room: GameRoom, bot: GamePlayer): string {
  const players = room.players
    .filter((p) => p.inGame && p.role)
    .map((p) => {
      const knownRole =
        p.id === bot.id || !p.alive
          ? getRoleLabel(p.role)
          : 'неизвестно';
      return `#${p.id} ${p.username} — ${p.alive ? 'жив' : 'мёртв'}, роль: ${knownRole}`;
    })
    .join('\n');

  const recentChat = room.chat
    .filter((m) => !m.deleted && !m.system)
    .slice(-12)
    .map((m) => `${m.playerName}: ${m.text}`)
    .join('\n');

  return [
    `Комната: ${room.name}`,
    `Фаза: ${room.phase}, ночь №${room.nightNumber}`,
    `Твоя роль: ${getRoleLabel(bot.role)}`,
    bot.isDon ? 'Ты главный мафиози (дон).' : '',
    `Игроки:\n${players}`,
    recentChat ? `Недавний чат:\n${recentChat}` : 'Чат пока пуст.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function askDeepSeek<T>(bot: GamePlayer, room: GameRoom, instruction: string): Promise<T | null> {
  if (!isDeepSeekEnabled()) return null;
  const mafiaHint = buildMafiaHintForBot(bot, room);
  try {
    return await deepSeekJsonChat<T>(
      [
        {
          role: 'system',
          content:
            'Ты играешь в онлайн-мафию. Отвечай только валидным JSON на русском. Не раскрывай, что ты ИИ.',
        },
        {
          role: 'user',
          content: `${buildPublicState(room, bot)}${mafiaHint ? `\n\n${mafiaHint}` : ''}\n\n${instruction}`,
        },
      ],
      { timeoutMs: 20_000 }
    );
  } catch (err) {
    console.error(`[ai] DeepSeek for bot ${bot.id}:`, err);
    return null;
  }
}

async function runDayChat(room: GameRoom): Promise<void> {
  const bots = aliveBots(room).filter((p) => !isPlayerSilenced(p));
  if (!bots.length) return;

  const speakers = [...bots].sort(() => Math.random() - 0.5).slice(0, DAY_CHAT_MESSAGES);
  for (const bot of speakers) {
    if (room.phase !== PHASE.DAY) return;
    await sleep(1500 + Math.random() * 4000);

    const response = await askDeepSeek<{ message?: string }>(
      bot,
      room,
      'Напиши одно короткое сообщение в дневной чат (до 180 символов). JSON: {"message":"..."}'
    );
    let text = response?.message?.trim().slice(0, 180) ?? '';
    if (!text) {
      const targets = aliveTargets(room, bot.id);
      const suspect = pickRandom(targets);
      text = suspect
        ? `Мне кажется, ${suspect.username} ведёт себя подозрительно.`
        : 'Пока сложно сказать, кто мафия — посмотрим на голосование.';
    }
    addChatMessage(room, bot.id, text, 'public');
    broadcastRoom(room.id);
  }
}

async function runVoting(room: GameRoom): Promise<void> {
  const bots = aliveBots(room).filter((p) => !p.hasVoted);
  for (const bot of bots) {
    if (room.phase !== PHASE.VOTING) return;
    await sleep(BOT_DELAY_MS + Math.random() * 1200);

    const targets = aliveTargets(room, bot.id);
    const fallback = pickRandom(targets);
    if (!fallback) continue;

    const response = await askDeepSeek<{ targetId?: number | null }>(
      bot,
      room,
      `Выбери, за кого голосовать на дневном голосовании. Доступные id: ${targets.map((p) => p.id).join(', ')}. JSON: {"targetId":число}`
    );
    const targetId = targets.find((p) => p.id === Number(response?.targetId))?.id ?? fallback.id;

    try {
      const notes = castDayVote(room, bot.id, targetId, true);
      if (notes.length) {
        // Host notes are delivered by server timer path; voting may resolve game state.
      }
    } catch (err) {
      console.error(`[ai] vote bot ${bot.id}:`, err);
    }
    broadcastRoom(room.id);
  }
}

function fallbackNightAction(bot: GamePlayer, room: GameRoom): NightAction | null {
  const targets = aliveTargets(room, bot.id);
  const target = pickRandom(targets);
  if (!target || !bot.role) return null;

  switch (bot.role) {
    case 'mafia':
    case 'maniac':
      return { type: 'kill', targetId: target.id };
    case 'commissar':
      return room.nightNumber <= 1
        ? { type: 'check', targetId: target.id }
        : { type: 'kill', targetId: target.id };
    case 'doctor':
      return { type: 'heal', targetId: target.id };
    case 'prostitute':
      return { type: 'seduce', targetId: target.id };
    case 'homeless':
      return { type: 'check', targetId: target.id };
    case 'advocate':
      return { type: 'cover', targetId: target.id };
    case 'clown': {
      const second = pickRandom(targets.filter((p) => p.id !== target.id));
      if (!second) return null;
      return { type: 'swap', targetId: target.id, targetId2: second.id };
    }
    case 'commissar_wife':
      if (room.wifeRevengeAvailable && !room.wifeRevengeUsed) {
        return { type: 'revenge', targetId: target.id };
      }
      return null;
    default:
      return null;
  }
}

function nightInstruction(role: RoleId | null): string {
  if (!role) return '';
  switch (role) {
    case 'mafia':
      return 'Выбери жертву для убийства. JSON: {"action":"kill","targetId":число}';
    case 'commissar':
      return 'Проверь или убей игрока. JSON: {"action":"check"|"kill","targetId":число}';
    case 'doctor':
      return 'Кого лечить? JSON: {"action":"heal","targetId":число}';
    case 'prostitute':
      return 'Кого соблазнить? JSON: {"action":"seduce","targetId":число}';
    case 'homeless':
      return 'Кого проверить? JSON: {"action":"check","targetId":число}';
    case 'maniac':
      return 'Кого убить? JSON: {"action":"kill","targetId":число}';
    case 'clown':
      return 'Поменяй роли двух игроков. JSON: {"action":"swap","targetId":число,"targetId2":число}';
    case 'commissar_wife':
      return 'Месть жены комиссара. JSON: {"action":"revenge","targetId":число}';
    case 'advocate':
      return 'Кого защитить адвокатом? JSON: {"action":"cover","targetId":число}';
    default:
      return '';
  }
}

function parseNightAction(
  bot: GamePlayer,
  room: GameRoom,
  raw: { action?: string; targetId?: number; targetId2?: number } | null
): NightAction | null {
  if (!raw?.action || !bot.role) return fallbackNightAction(bot, room);
  const targets = aliveTargets(room, bot.id);
  const target = targets.find((p) => p.id === Number(raw.targetId));
  if (!target) return fallbackNightAction(bot, room);

  switch (raw.action) {
    case 'kill':
      if (bot.role === 'mafia' || bot.role === 'commissar' || bot.role === 'maniac') {
        return { type: 'kill', targetId: target.id };
      }
      break;
    case 'check':
      if (bot.role === 'commissar' || bot.role === 'homeless') {
        return { type: 'check', targetId: target.id };
      }
      break;
    case 'heal':
      if (bot.role === 'doctor') return { type: 'heal', targetId: target.id };
      break;
    case 'seduce':
      if (bot.role === 'prostitute') return { type: 'seduce', targetId: target.id };
      break;
    case 'cover':
      if (bot.role === 'advocate' && target.id !== bot.id) {
        return { type: 'cover', targetId: target.id };
      }
      break;
    case 'revenge':
      if (bot.role === 'commissar_wife') return { type: 'revenge', targetId: target.id };
      break;
    case 'swap': {
      const second = targets.find((p) => p.id === Number(raw.targetId2) && p.id !== target.id);
      if (bot.role === 'clown' && second) {
        return { type: 'swap', targetId: target.id, targetId2: second.id };
      }
      break;
    }
  }
  return fallbackNightAction(bot, room);
}

async function runNightActions(room: GameRoom): Promise<void> {
  const bots = aliveBots(room).filter((p) => !p.nightActionDone && nightInstruction(p.role));
  for (const bot of bots) {
    if (room.phase !== PHASE.NIGHT) return;
    await sleep(BOT_DELAY_MS + Math.random() * 1500);

    const targets = aliveTargets(room, bot.id);
    const instruction = `${nightInstruction(bot.role)}\nДоступные id: ${targets.map((p) => p.id).join(', ')}`;
    const response = await askDeepSeek<{ action?: string; targetId?: number; targetId2?: number }>(
      bot,
      room,
      instruction
    );
    const action = parseNightAction(bot, room, response);
    if (!action) continue;

    try {
      submitNightAction(room, bot.id, action);
    } catch (err) {
      const fallback = fallbackNightAction(bot, room);
      if (fallback) {
        try {
          submitNightAction(room, bot.id, fallback);
        } catch (inner) {
          console.error(`[ai] night fallback bot ${bot.id}:`, inner);
        }
      } else {
        console.error(`[ai] night bot ${bot.id}:`, err);
      }
    }
    broadcastRoom(room.id);
  }
}

async function runAiForRoom(room: GameRoom): Promise<void> {
  if (room.phase === PHASE.DAY) {
    await runDayChat(room);
  } else if (room.phase === PHASE.VOTING) {
    await runVoting(room);
  } else if (room.phase === PHASE.NIGHT) {
    await runNightActions(room);
  }
}

export function buildMafiaHintForBot(bot: GamePlayer, room: GameRoom): string {
  if (!bot.role || !isMafiaTeam(bot.role)) return '';
  const team = room.players
    .filter((p) => p.alive && p.inGame && isMafiaTeam(p.role))
    .map((p) => `${p.username} (#${p.id})`)
    .join(', ');
  return team ? `Твоя мафиозная команда: ${team}` : '';
}
