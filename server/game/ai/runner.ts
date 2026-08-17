import { PHASE } from '../config.js';
import { getRoleLabel, isMafiaTeam } from '../roles.js';
import {
  addChatMessage,
  castDayVote,
  submitNightAction,
  isPlayerSilenced,
} from '../engine.js';
import type { ChatMessage, GamePhase, GamePlayer, GameRoom, NightAction, RoleId } from '../../types/index.js';
import { isDeepSeekEnabled } from '../../settings/deepseekStore.js';
import { deepSeekJsonChat } from './deepseekClient.js';

const BOT_DELAY_MS = 600;
const REPLY_DELAY_MS = 1800;
const REPLY_COOLDOWN_MS = 3500;
const MAX_REPLIES_PER_MINUTE = 10;

let broadcastRoom: (roomId: number) => void = () => {};
const replyTimestampsByRoom = new Map<number, number[]>();
const replyInFlightByRoom = new Set<number>();

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

/** Вызывается, когда живой игрок пишет в общий чат — бот может ответить. */
export function triggerBotChatResponse(
  room: GameRoom,
  author: GamePlayer,
  text: string,
  msg?: ChatMessage | null
): void {
  if (!room.aiEnabled || (room.aiCount ?? 0) <= 0) return;
  if (author.isBot) return;
  if (room.phase !== PHASE.DAY && room.phase !== PHASE.VOTING) return;

  void runBotChatReply(room, author, text, msg).catch((err) =>
    console.error(`[ai] chat reply room ${room.id}:`, err)
  );
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

function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case PHASE.DAY:
      return 'дневное обсуждение';
    case PHASE.VOTING:
      return 'голосование';
    case PHASE.NIGHT:
      return 'ночь';
    case PHASE.REGISTRATION:
      return 'регистрация';
    case PHASE.ROLES:
      return 'раздача ролей';
    case PHASE.ENDED:
      return 'игра окончена';
    default:
      return 'ожидание';
  }
}

function canReplyNow(roomId: number): boolean {
  const now = Date.now();
  const recent = (replyTimestampsByRoom.get(roomId) ?? []).filter((t) => now - t < 60_000);
  replyTimestampsByRoom.set(roomId, recent);
  if (recent.length >= MAX_REPLIES_PER_MINUTE) return false;
  const last = recent[recent.length - 1];
  if (last != null && now - last < REPLY_COOLDOWN_MS) return false;
  return true;
}

function markReply(roomId: number): void {
  const now = Date.now();
  const recent = (replyTimestampsByRoom.get(roomId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  replyTimestampsByRoom.set(roomId, recent);
}

function buildGameContextForBot(
  room: GameRoom,
  bot: GamePlayer,
  trigger?: { authorName: string; authorId: number; text: string; toPlayerId?: number | null }
): string {
  const dayNumber = room.nightNumber + 1;

  const playerLines = room.players
    .filter((p) => p.inGame && p.role)
    .map((p) => {
      if (p.id === bot.id) {
        return `#${p.id} ${p.username} — жив, это ты, роль: ${getRoleLabel(p.role)}`;
      }
      if (!p.alive) {
        return `#${p.id} ${p.username} — мёртв (роль могла быть названа ведущим)`;
      }
      return `#${p.id} ${p.username} — жив, роль неизвестна`;
    })
    .join('\n');

  const hostEvents = room.chat
    .filter((m) => m.system && !m.deleted)
    .slice(-12)
    .map((m) => `[${m.playerName}] ${m.text}`)
    .join('\n');

  const playerChat = room.chat
    .filter((m) => !m.deleted && !m.system && m.playerId != null)
    .slice(-25)
    .map((m) => {
      const to = m.toPlayerName ? ` → ${m.toPlayerName}` : '';
      return `${m.playerName}${to}: ${m.text}`;
    })
    .join('\n');

  let votingInfo = '';
  if (room.phase === PHASE.VOTING && Object.keys(room.votes).length > 0) {
    votingInfo = Object.entries(room.votes)
      .map(([voterId, targetId]) => {
        const voter = room.players.find((p) => p.id === Number(voterId));
        const target = room.players.find((p) => p.id === targetId);
        return `${voter?.username ?? voterId} голосует за ${target?.username ?? targetId}`;
      })
      .join('\n');
  }

  const parts = [
    `=== Текущая партия (сессия ${room.sessionId ?? '?'}) ===`,
    `Комната: ${room.name}`,
    `Фаза: ${phaseLabel(room.phase)}, день ${dayNumber}, прошло ночей: ${room.nightNumber}`,
    `Твоя роль: ${getRoleLabel(bot.role)}`,
    bot.isDon ? 'Ты главный мафиози (дон).' : '',
    `Участники:\n${playerLines}`,
    hostEvents ? `Сообщения ведущего (официальные факты этой игры):\n${hostEvents}` : '',
    votingInfo ? `Текущие голоса:\n${votingInfo}` : '',
    playerChat ? `Переписка в этой партии:\n${playerChat}` : 'Переписки пока нет.',
  ];

  if (trigger) {
    parts.push(
      `\n=== Сообщение игрока ===\n${trigger.authorName} (#${trigger.authorId}): «${trigger.text}»`
    );
    if (trigger.toPlayerId === bot.id) {
      parts.push('Это сообщение обращено лично к тебе — ответь по делу.');
    }
  }

  return parts.filter(Boolean).join('\n\n');
}

function buildDonDayHint(bot: GamePlayer, room: GameRoom): string {
  if (!bot.isDon || (room.phase !== PHASE.DAY && room.phase !== PHASE.VOTING)) return '';
  return 'Ты главарь мафии. Днём веди себя как мирный: не раскрывай роль, вводи город в заблуждение, голосуй вместе с большинством или против явных угроз, но не выделяйся.';
}

async function askDeepSeek<T>(
  bot: GamePlayer,
  room: GameRoom,
  instruction: string,
  trigger?: { authorName: string; authorId: number; text: string; toPlayerId?: number | null }
): Promise<T | null> {
  if (!isDeepSeekEnabled()) return null;
  const mafiaHint = buildMafiaHintForBot(bot, room);
  const donHint = buildDonDayHint(bot, room);
  try {
    return await deepSeekJsonChat<T>(
      [
        {
          role: 'system',
          content:
            'Ты играешь роль живого игрока в онлайн-мафию. Анализируй только факты ЭТОЙ партии из контекста: сообщения ведущего, кто жив/мёртв, переписку, голоса. Не выдумывай события и роли. Отвечай только валидным JSON на русском. Не раскрывай, что ты ИИ. Играй в соответствии со своей ролью (мафия может врать, мирный ищет мафию).',
        },
        {
          role: 'user',
          content: `${buildGameContextForBot(room, bot, trigger)}${mafiaHint ? `\n\n${mafiaHint}` : ''}${donHint ? `\n\n${donHint}` : ''}\n\n${instruction}`,
        },
      ],
      { timeoutMs: 20_000 }
    );
  } catch (err) {
    console.error(`[ai] DeepSeek for bot ${bot.id}:`, err);
    return null;
  }
}

function messageMentionsBot(text: string, bot: GamePlayer): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes(bot.username.toLowerCase()) ||
    lower.includes(bot.name.toLowerCase())
  );
}

function pickRespondingBot(
  room: GameRoom,
  author: GamePlayer,
  text: string,
  msg?: ChatMessage | null
): GamePlayer | null {
  const bots = aliveBots(room).filter((p) => !isPlayerSilenced(p) && p.id !== author.id);
  if (!bots.length) return null;

  if (msg?.toPlayerId != null) {
    const targeted = bots.find((b) => b.id === msg.toPlayerId);
    if (targeted) return targeted;
  }

  const mentioned = bots.find((b) => messageMentionsBot(text, b));
  if (mentioned) return mentioned;

  const lower = text.toLowerCase();
  const isEngaging =
    lower.includes('?') ||
    lower.includes('кто ') ||
    lower.includes('почему') ||
    lower.includes('как ') ||
    lower.includes('думаешь') ||
    lower.includes('соглас') ||
    text.trim().length >= 12;

  const replyChance = isEngaging ? 0.82 : 0.45;
  if (Math.random() > replyChance) return null;

  return pickRandom(bots);
}

function buildFallbackReply(bot: GamePlayer, author: GamePlayer, text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('?')) {
    return `${author.username}, хороший вопрос — я бы смотрел на поведение в этой партии, не только на слова.`;
  }
  if (messageMentionsBot(text, bot)) {
    return `${author.username}, я здесь. Давай разбираться по фактам — кто молчал и кто давил на голосовании.`;
  }
  return `${author.username}, понимаю. По этой игре мне тоже кажется, что стоит присмотреться к голосам.`;
}

async function runBotChatReply(
  room: GameRoom,
  author: GamePlayer,
  text: string,
  msg?: ChatMessage | null
): Promise<void> {
  if (replyInFlightByRoom.has(room.id) || !canReplyNow(room.id)) return;

  const bot = pickRespondingBot(room, author, text, msg);
  if (!bot) return;

  replyInFlightByRoom.add(room.id);
  try {
    await sleep(REPLY_DELAY_MS + Math.random() * 2200);
    if (room.phase !== PHASE.DAY && room.phase !== PHASE.VOTING) return;

    const trigger = {
      authorName: author.username || author.name,
      authorId: author.id,
      text,
      toPlayerId: msg?.toPlayerId ?? null,
    };

    const response = await askDeepSeek<{ shouldReply?: boolean; message?: string }>(
      bot,
      room,
      `Игрок написал в чат. Реши, нужен ли ответ в контексте ЭТОЙ партии. Если сообщение не требует ответа (спам, смайлик, «ок»), верни {"shouldReply":false}. Иначе ответь игроку коротко (до 180 символов), ссылаясь на события этой игры. JSON: {"shouldReply":true,"message":"..."}`,
      trigger
    );

    if (response?.shouldReply === false) return;

    let replyText = response?.message?.trim().slice(0, 180) ?? '';
    if (!replyText) {
      replyText = buildFallbackReply(bot, author, text);
    }

    addChatMessage(room, bot.id, replyText, 'public', { toPlayerId: author.id });
    markReply(room.id);
    broadcastRoom(room.id);
  } finally {
    replyInFlightByRoom.delete(room.id);
  }
}

async function runDayChat(room: GameRoom): Promise<void> {
  const bots = aliveBots(room).filter((p) => !isPlayerSilenced(p));
  const bot = pickRandom(bots);
  if (!bot) return;

  if (room.phase !== PHASE.DAY) return;
  await sleep(2000 + Math.random() * 2500);

  const dayNumber = room.nightNumber + 1;
  const response = await askDeepSeek<{ message?: string }>(
    bot,
    room,
    `Начался день ${dayNumber}. Напиши одно короткое сообщение в чат (до 180 символов): прокомментируй итог прошлой ночи или подозрения по фактам ЭТОЙ партии. JSON: {"message":"..."}`
  );
  let text = response?.message?.trim().slice(0, 180) ?? '';
  if (!text) {
    const targets = aliveTargets(room, bot.id);
    const suspect = pickRandom(targets);
    text = suspect
      ? `День ${dayNumber}. Мне кажется, стоит присмотреться к ${suspect.username} — по этой игре есть вопросы.`
      : `День ${dayNumber}. Давайте разбираться по фактам — кто вёл себя странно?`;
  }
  addChatMessage(room, bot.id, text, 'public');
  broadcastRoom(room.id);
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
      `Выбери, за кого голосовать на дневном голосовании в ЭТОЙ партии. Учитывай переписку, голоса и сообщения ведущего.${bot.isDon ? ' Ты главарь — голосуй вместе с городом или против угроз, не выделяйся.' : ''} Доступные id: ${targets.map((p) => p.id).join(', ')}. JSON: {"targetId":число}`
    );
    const targetId = targets.find((p) => p.id === Number(response?.targetId))?.id ?? fallback.id;

    try {
      castDayVote(room, bot.id, targetId, true);
    } catch (err) {
      console.error(`[ai] vote bot ${bot.id}:`, err);
    }
    broadcastRoom(room.id);
  }
}

function fallbackNightAction(bot: GamePlayer, room: GameRoom): NightAction | null {
  const allTargets = aliveTargets(room, bot.id);
  const killTargets = allTargets.filter((p) => !isMafiaTeam(p.role));
  const target = pickRandom(killTargets);
  if (!bot.role) return null;

  switch (bot.role) {
    case 'mafia':
      if (!bot.isDon || !target) return null;
      return { type: 'kill', targetId: target.id };
    case 'maniac': {
      const maniacTarget = pickRandom(allTargets);
      if (!maniacTarget) return null;
      return { type: 'kill', targetId: maniacTarget.id };
    }
    case 'commissar': {
      const commissarTarget = pickRandom(allTargets);
      if (!commissarTarget) return null;
      return room.nightNumber <= 1
        ? { type: 'check', targetId: commissarTarget.id }
        : { type: 'kill', targetId: commissarTarget.id };
    }
    case 'doctor': {
      const healTarget = pickRandom(allTargets);
      if (!healTarget) return null;
      return { type: 'heal', targetId: healTarget.id };
    }
    case 'prostitute': {
      const seduceTarget = pickRandom(allTargets);
      if (!seduceTarget) return null;
      return { type: 'seduce', targetId: seduceTarget.id };
    }
    case 'homeless': {
      const checkTarget = pickRandom(allTargets);
      if (!checkTarget) return null;
      return { type: 'check', targetId: checkTarget.id };
    }
    case 'advocate': {
      const coverTarget = pickRandom(allTargets.filter((p) => p.id !== bot.id));
      if (!coverTarget) return null;
      return { type: 'cover', targetId: coverTarget.id };
    }
    case 'clown': {
      const first = pickRandom(allTargets);
      if (!first) return null;
      const second = pickRandom(allTargets.filter((p) => p.id !== first.id));
      if (!second) return null;
      return { type: 'swap', targetId: first.id, targetId2: second.id };
    }
    case 'commissar_wife':
      if (room.wifeRevengeAvailable && !room.wifeRevengeUsed) {
        const revengeTarget = pickRandom(allTargets);
        if (!revengeTarget) return null;
        return { type: 'revenge', targetId: revengeTarget.id };
      }
      return null;
    default:
      return null;
  }
}

function nightInstruction(bot: GamePlayer): string {
  if (!bot.role) return '';
  if (bot.role === 'mafia' && !bot.isDon) return '';
  switch (bot.role) {
    case 'mafia':
      return 'Ты главарь мафии. Выбери жертву (не атакуй союзников). JSON: {"action":"kill","targetId":число}';
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
  const targets = aliveTargets(room, bot.id).filter((p) => !isMafiaTeam(p.role));
  const target = targets.find((p) => p.id === Number(raw.targetId));
  if (!target) return fallbackNightAction(bot, room);

  switch (raw.action) {
    case 'kill':
      if (bot.role === 'mafia' && bot.isDon) {
        return { type: 'kill', targetId: target.id };
      }
      if (bot.role === 'commissar' || bot.role === 'maniac') {
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
  const bots = aliveBots(room).filter((p) => !p.nightActionDone && nightInstruction(p));
  for (const bot of bots) {
    if (room.phase !== PHASE.NIGHT) return;
    await sleep(BOT_DELAY_MS + Math.random() * 1500);

    const targets = aliveTargets(room, bot.id).filter((p) => !isMafiaTeam(p.role));
    const instruction = `${nightInstruction(bot)}\nДоступные id: ${targets.map((p) => p.id).join(', ')}`;
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
