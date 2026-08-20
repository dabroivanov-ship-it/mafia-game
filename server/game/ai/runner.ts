import { PHASE } from '../config.js';
import { isMafiaTeam } from '../roles.js';
import {
  addChatMessage,
  castDayVote,
  castHangVote,
  submitNightAction,
  isPlayerSilenced,
} from '../engine.js';
import type { ChatMessage, GamePlayer, GameRoom, NightAction } from '../../types/index.js';
import { isDeepSeekEnabled } from '../../settings/deepseekStore.js';
import { deepSeekJsonChat } from './deepseekClient.js';
import {
  MAFIA_RULES_PROMPT,
  alivePlayers,
  buildGameContextForBot,
  heuristicHangYes,
  heuristicNightAction,
  heuristicNominateTarget,
  nightInstruction,
  nightTargetsForBot,
} from './knowledge.js';

const BOT_DELAY_MS = 600;
const REPLY_DELAY_MS = 900;
const REPLY_COOLDOWN_MS = 1200;
const MAX_REPLIES_PER_MINUTE = 20;
const DAY_OPENING_MESSAGES = 2;
const CHAT_TIMEOUT_MS = 8000;

const REGISTRATION_LINES = [
  'Всем привет!',
  'Я за столом.',
  'Ну что, кто ещё зайдёт?',
  'Готов играть.',
  'Давайте наберёмся и стартуем.',
  'Жду старта.',
  'Место занял, можно начинать.',
];

const TABLE_TALK_LINES = [
  'Давайте по фактам, не по эмоциям.',
  'Кто молчит — того бы я первым и смотрел.',
  'Предлагаю смотреть, кто давит на голосовании.',
  'Мне по этой партии пока не всё ясно.',
  'Давайте не торопиться — лучше спокойно разобрать ночь.',
  'Сводка есть, давайте не вешать первого попавшегося.',
  'Мне важнее, кто как голосует, а не кто громче орёт.',
  'Пока расклад мутный. Не суетимся.',
];

function suspicionLines(name: string): string[] {
  return [
    `Я пока смотрю на ${name}.`,
    `${name} как-то удобно отмалчивается.`,
    `${name}, объяснись — чего такой спокойный?`,
    `Давайте ${name} на стол, хочу послушать.`,
    `Меня смущает ${name}, не все сразу.`,
    `Голосую за ${name} — давайте разберём.`,
    `${name} мне сегодня не ложится.`,
    `У меня вопрос к ${name}.`,
    `Не ${name} орёт, а ведёт себя слишком ровно.`,
    `${name} как будто заранее знает, чем ночь кончится.`,
  ];
}

function hangTalkLines(name: string, yes: boolean): string[] {
  if (yes) {
    return [
      `${name} на столе — я за казнь.`,
      `Вешаем ${name}, иначе опять уйдём в ночь вслепую.`,
      `По ${name} фактов хватает, я за.`,
      `${name} пусть объясняет, но голос мой — да.`,
    ];
  }
  return [
    `${name} на столе, но я пока против. Мало.`,
    `Не вешаем ${name} из-за шума.`,
    `По ${name} казни не вижу. Нет.`,
    `${name} рано на стол. Я против.`,
  ];
}

const FALLBACK_REPLIES = [
  (name: string) => `${name}, ок, слышу. Давайте по сводке, не по кругу.`,
  (name: string) => `${name}, я бы не повторял одно и то же — давай по голосам.`,
  (name: string) => `${name}, понял. Мне важнее, кто молчит.`,
  (name: string) => `${name}, давай без общих слов — кто конкретно и почему.`,
  (name: string) => `${name}, я здесь. По этой катке пока держусь своего.`,
];

let broadcastRoom: (roomId: number) => void = () => {};
const replyTimestampsByRoom = new Map<number, number[]>();
const replyInFlightByRoom = new Set<number>();

export function initGameAiRunner(broadcast: (roomId: number) => void): void {
  broadcastRoom = broadcast;
}

function phaseKey(room: GameRoom): string | null {
  if (room.phase === PHASE.REGISTRATION) return `registration:${room.sessionId}`;
  if (room.phase === PHASE.DAY) return `day:${room.sessionId}:${room.nightNumber}`;
  if (room.phase === PHASE.VOTING) {
    return `voting:${room.sessionId}:${room.nightNumber}:${room.votingRound ?? 0}:${room.votingStage ?? 'nominate'}`;
  }
  if (room.phase === PHASE.NIGHT) return `night:${room.sessionId}:${room.nightNumber}`;
  return null;
}

function isBotChatPhase(room: GameRoom): boolean {
  return (
    room.phase === PHASE.REGISTRATION ||
    room.phase === PHASE.DAY ||
    room.phase === PHASE.VOTING
  );
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
  if (!isBotChatPhase(room)) return;

  void runBotChatReply(room, author, text, msg).catch((err) =>
    console.error(`[ai] chat reply room ${room.id}:`, err)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function talkingBots(room: GameRoom): GamePlayer[] {
  return room.players.filter((p) => {
    if (!p.isBot || !p.connected || !p.inGame || isPlayerSilenced(p)) return false;
    if (room.phase === PHASE.REGISTRATION) return true;
    return p.alive && !!p.role;
  });
}

function aliveBots(room: GameRoom): GamePlayer[] {
  return room.players.filter((p) => p.isBot && p.alive && p.inGame && p.role && p.connected);
}

function aliveTargets(room: GameRoom, excludeId: number): GamePlayer[] {
  return alivePlayers(room, { excludeId });
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function normalizeTalk(text: string, room: GameRoom): string {
  const names = room.players
    .flatMap((p) => [p.username, p.name])
    .filter((n): n is string => !!n)
    .sort((a, b) => b.length - a.length);
  let s = text.toLowerCase();
  for (const name of names) {
    s = s.split(name.toLowerCase()).join('#');
  }
  return s.replace(/[^\p{L}\s#]/gu, '').replace(/\s+/g, ' ').trim();
}

function recentTalkKeys(room: GameRoom): Set<string> {
  const keys = new Set<string>();
  for (const msg of room.chat) {
    if (msg.system || msg.deleted || !msg.text) continue;
    const key = normalizeTalk(msg.text, room);
    if (key) keys.add(key);
  }
  return keys;
}

function pickFreshLine(candidates: string[], used: Set<string>, room: GameRoom): string {
  const fresh = candidates.filter((line) => !used.has(normalizeTalk(line, room)));
  return pickRandom(fresh.length ? fresh : candidates) || candidates[0] || '';
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

async function askDeepSeek<T>(
  bot: GamePlayer,
  room: GameRoom,
  instruction: string,
  trigger?: { authorName: string; authorId: number; text: string; toPlayerId?: number | null },
  temperature = 0.45,
  timeoutMs = 22_000
): Promise<T | null> {
  if (!isDeepSeekEnabled()) return null;
  try {
    return await deepSeekJsonChat<T>(
      [
        {
          role: 'system',
          content: MAFIA_RULES_PROMPT,
        },
        {
          role: 'user',
          content: `${buildGameContextForBot(room, bot, trigger)}\n\n${instruction}`,
        },
      ],
      { timeoutMs, temperature }
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
  const bots = talkingBots(room).filter((p) => p.id !== author.id);
  if (!bots.length) return null;

  if (msg?.toPlayerId != null) {
    const targeted = bots.find((b) => b.id === msg.toPlayerId);
    if (targeted) return targeted;
  }

  const mentioned = bots.find((b) => messageMentionsBot(text, b));
  if (mentioned) return mentioned;

  const lower = text.toLowerCase();
  const isShort = text.trim().length < 3;
  if (isShort && Math.random() > 0.35) return null;

  const isEngaging =
    lower.includes('?') ||
    lower.includes('кто ') ||
    lower.includes('почему') ||
    lower.includes('как ') ||
    lower.includes('думаешь') ||
    lower.includes('соглас') ||
    lower.includes('голос') ||
    lower.includes('маф') ||
    text.trim().length >= 4;

  const replyChance = isEngaging ? 1 : 0.85;
  if (Math.random() > replyChance) return null;

  return pickRandom(bots);
}

function buildFallbackReply(
  bot: GamePlayer,
  author: GamePlayer,
  text: string,
  room: GameRoom
): string {
  const name = author.username || author.name;
  const lower = text.toLowerCase();
  if (room.phase === PHASE.REGISTRATION) {
    if (lower.includes('?')) return `${name}, давайте дождёмся старта — я уже за столом.`;
    if (messageMentionsBot(text, bot)) return `${name}, я здесь, можно начинать.`;
    return `${name}, ок, жду остальную компанию.`;
  }
  if (lower.includes('?')) {
    return `${name}, хороший вопрос — я бы смотрел на поведение в этой партии, не только на слова.`;
  }
  if (messageMentionsBot(text, bot)) {
    return `${name}, я здесь. Давай разбираться по фактам — кто молчал и кто давил на голосовании.`;
  }
  const used = recentTalkKeys(room);
  return pickFreshLine(
    FALLBACK_REPLIES.map((line) => line(name)),
    used,
    room
  );
}

function choosePublicReply(
  room: GameRoom,
  proposed: string,
  fallback: string
): string {
  const text = proposed.trim();
  if (!text) return fallback;
  if (recentTalkKeys(room).has(normalizeTalk(text, room))) return fallback;
  return text;
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
    await sleep(REPLY_DELAY_MS + Math.random() * 1400);
    if (!isBotChatPhase(room)) return;

    const trigger = {
      authorName: author.username || author.name,
      authorId: author.id,
      text,
      toPlayerId: msg?.toPlayerId ?? null,
    };

    const addressed =
      msg?.toPlayerId === bot.id || messageMentionsBot(text, bot);
    const response = await askDeepSeek<{ shouldReply?: boolean; message?: string }>(
      bot,
      room,
      room.phase === PHASE.REGISTRATION
        ? `Игрок написал в чат на регистрации. Коротко ответь как живой игрок за столом (до 140 символов), без мета-речи про ИИ. JSON: {"shouldReply":true,"message":"..."}`
        : `Игрок написал в чат. Реши, нужен ли ответ по ходу ЭТОЙ партии. Если спам, смайлик, «ок» — {"shouldReply":false}. Иначе коротко (до 180 символов) ответь по фактам, голосам и сводке, без раскрытия своей роли. Не копируй чужие фразы и не пиши «стоит присмотреться». JSON: {"shouldReply":true,"message":"..."}`,
      trigger,
      0.7,
      CHAT_TIMEOUT_MS
    );

    if (response?.shouldReply === false && !addressed) return;

    let replyText = response?.message?.trim().slice(0, 180) ?? '';
    replyText = choosePublicReply(room, replyText, buildFallbackReply(bot, author, text, room));

    addChatMessage(room, bot.id, replyText, 'public');
    markReply(room.id);
    broadcastRoom(room.id);
  } finally {
    replyInFlightByRoom.delete(room.id);
  }
}

function fallbackTableTalk(bot: GamePlayer, room: GameRoom): string {
  const used = recentTalkKeys(room);
  if (room.phase === PHASE.REGISTRATION) {
    return pickFreshLine(REGISTRATION_LINES, used, room);
  }

  if (room.phase === PHASE.VOTING && room.votingStage === 'confirm' && room.accusedId != null) {
    const accused = room.players.find((p) => p.id === room.accusedId);
    const name = accused?.username || accused?.name;
    if (name) {
      return pickFreshLine(hangTalkLines(name, heuristicHangYes(bot, room)), used, room);
    }
  }

  const targets = aliveTargets(room, bot.id);
  const suspect = heuristicNominateTarget(bot, room, targets);
  const named = suspect ? suspicionLines(suspect.username || suspect.name) : [];
  const mix =
    Math.random() < 0.45 || !named.length
      ? [...TABLE_TALK_LINES, ...named]
      : [...named, ...TABLE_TALK_LINES];
  return pickFreshLine(mix, used, room);
}

function tableTalkInstruction(room: GameRoom): string {
  const unique =
    'Фраза должна быть новой: не копируй чат и не используй шаблон «стоит присмотреться». Не признавайся, что ты ИИ.';
  if (room.phase === PHASE.REGISTRATION) {
    return `Регистрация в комнате. Одно короткое сообщение (до 120 символов) как живой игрок: приветствие или «готов играть». ${unique} JSON: {"message":"..."}`;
  }
  if (room.phase === PHASE.VOTING && room.votingStage === 'confirm') {
    const accused = room.players.find((p) => p.id === room.accusedId);
    const name = accused?.username || 'кандидат';
    return `На столе ${name}. Одно короткое сообщение (до 180 символов): казнить или оправдать и почему, без новой случайной фамилии. ${unique} JSON: {"message":"..."}`;
  }
  const dayNumber = room.nightNumber + 1;
  return `День ${dayNumber} / голосование. Одно короткое сообщение (до 180 символов): сводка, голос или подозрение по ЭТОЙ партии. Говори своим словами. ${unique} JSON: {"message":"..."}`;
}

function inspectorRevealBots(room: GameRoom): GamePlayer[] {
  return talkingBots(room).filter((p) => {
    const check = p.lastNightCheck;
    if (!check?.isThreat || check.nightNumber !== room.nightNumber) return false;
    return p.role === 'commissar' || p.role === 'homeless';
  });
}

function inspectorRevealText(bot: GamePlayer): string {
  const check = bot.lastNightCheck;
  const name = check?.targetName || 'игрок';
  if (bot.role === 'homeless') {
    return `Я бомж. Ночью проверил ${name} — это ${check?.seenAs || 'мафия'}. Предлагаю вешать.`;
  }
  return `Я Катани. Ночью проверил ${name} — это мафия. Предлагаю вешать.`;
}

async function runInspectorReveals(room: GameRoom): Promise<void> {
  if (room.phase !== PHASE.DAY && room.phase !== PHASE.VOTING) return;
  const handled = ensureHandledSet(room);
  const key = `check-reveal:${room.sessionId}:${room.nightNumber}`;
  if (handled.has(key)) return;
  handled.add(key);

  const bots = inspectorRevealBots(room);
  for (const bot of bots) {
    if (room.phase !== PHASE.DAY && room.phase !== PHASE.VOTING) return;
    await sleep(400 + Math.random() * 700);
    addChatMessage(room, bot.id, inspectorRevealText(bot), 'public');
    broadcastRoom(room.id);
  }
}

async function runTableTalk(room: GameRoom): Promise<void> {
  if (room.phase === PHASE.VOTING && room.votingStage === 'confirm') return;
  const revealIds = new Set(inspectorRevealBots(room).map((p) => p.id));
  const bots = talkingBots(room).filter((p) => !revealIds.has(p.id));
  if (!bots.length) return;

  const count =
    room.phase === PHASE.REGISTRATION
      ? Math.min(2, bots.length)
      : Math.min(DAY_OPENING_MESSAGES, bots.length);
  const speakers = [...bots].sort(() => Math.random() - 0.5).slice(0, count);
  for (const bot of speakers) {
    if (!isBotChatPhase(room)) return;
    await sleep(800 + Math.random() * 1600);
    if (!isBotChatPhase(room)) return;

    const response = await askDeepSeek<{ message?: string }>(
      bot,
      room,
      tableTalkInstruction(room),
      undefined,
      0.9,
      CHAT_TIMEOUT_MS
    );
    const fallback = fallbackTableTalk(bot, room);
    const text = choosePublicReply(
      room,
      response?.message?.trim().slice(0, 180) ?? '',
      fallback
    );
    addChatMessage(room, bot.id, text, 'public');
    broadcastRoom(room.id);
  }
}

async function runVoting(room: GameRoom): Promise<void> {
  if (room.votingStage === 'confirm') {
    await runHangConfirm(room);
    return;
  }

  await runNominations(room);
}

async function runNominations(room: GameRoom): Promise<void> {
  const bots = aliveBots(room).filter((p) => !p.hasVoted);
  for (const bot of bots) {
    if (room.phase !== PHASE.VOTING || room.votingStage === 'confirm') return;
    await sleep(BOT_DELAY_MS + Math.random() * 1200);

    const targets = aliveTargets(room, bot.id);
    const fallback = heuristicNominateTarget(bot, room, targets);
    if (!fallback) continue;

    const response = await askDeepSeek<{ targetId?: number | null }>(
      bot,
      room,
      `Выдвижение на казнь. Выбери id из списка: ${targets.map((p) => p.id).join(', ')}. Если ночью твоя проверка показала мафию/зло — обязательно голосуй за этого игрока. Учитывай сводку, чат и свою роль: мафия не сдаёт союзников. Это ещё не казнь. JSON: {"targetId":число,"reason":"..."}`,
      undefined,
      0.35
    );
    const chosen = targets.find((p) => p.id === Number(response?.targetId));
    const safeChosen =
      chosen && !(isMafiaTeam(bot.role) && isMafiaTeam(chosen.role)) ? chosen : null;
    const checkedId =
      bot.lastNightCheck?.isThreat && bot.lastNightCheck.nightNumber === room.nightNumber
        ? bot.lastNightCheck.targetId
        : null;
    const forced = checkedId != null ? targets.find((p) => p.id === checkedId) : null;
    const targetId = forced?.id ?? safeChosen?.id ?? fallback.id;

    try {
      castDayVote(room, bot.id, targetId);
    } catch (err) {
      console.error(`[ai] vote bot ${bot.id}:`, err);
    }
    broadcastRoom(room.id);
  }
}

async function runHangConfirm(room: GameRoom): Promise<void> {
  const accused = room.players.find((p) => p.id === room.accusedId);
  const accusedName = accused?.username || accused?.name || 'кандидат';
  const bots = aliveBots(room).filter((p) => !p.hasHangVoted);
  for (const bot of bots) {
    if (room.phase !== PHASE.VOTING || room.votingStage !== 'confirm') return;
    await sleep(BOT_DELAY_MS + Math.random() * 900);

    const response = await askDeepSeek<{ yes?: boolean }>(
      bot,
      room,
      `Кандидат ${accusedName} (id ${room.accusedId}). Казнить — yes:true, оправдать — yes:false. Мафия не вешает союзника. Город вешает, если факты против кандидата сильнее защиты. JSON: {"yes":true|false,"reason":"..."}`,
      undefined,
      0.3
    );
    let yes =
      typeof response?.yes === 'boolean' ? response.yes : heuristicHangYes(bot, room);
    if (accused && isMafiaTeam(bot.role) && isMafiaTeam(accused.role)) yes = false;
    if (accused?.id === bot.id) yes = false;
    if (
      accused &&
      bot.lastNightCheck?.isThreat &&
      bot.lastNightCheck.nightNumber === room.nightNumber &&
      accused.id === bot.lastNightCheck.targetId
    ) {
      yes = true;
    }

    try {
      castHangVote(room, bot.id, yes);
    } catch (err) {
      console.error(`[ai] hang vote bot ${bot.id}:`, err);
    }
    broadcastRoom(room.id);
  }
}

function parseNightAction(
  bot: GamePlayer,
  room: GameRoom,
  raw: { action?: string; targetId?: number; targetId2?: number } | null
): NightAction | null {
  const fallback = heuristicNightAction(bot, room);
  if (!raw?.action || !bot.role) return fallback;

  const targets = nightTargetsForBot(bot, room);
  const target = targets.find((p) => p.id === Number(raw.targetId));
  if (!target) return fallback;

  switch (raw.action) {
    case 'kill':
      if (bot.role === 'mafia' && bot.isDon && !isMafiaTeam(target.role)) {
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
  return fallback;
}

async function runNightActions(room: GameRoom): Promise<void> {
  const bots = aliveBots(room).filter((p) => !p.nightActionDone && nightInstruction(p, room));
  for (const bot of bots) {
    if (room.phase !== PHASE.NIGHT) return;
    await sleep(BOT_DELAY_MS + Math.random() * 1500);

    const instruction = nightInstruction(bot, room);
    const response = await askDeepSeek<{ action?: string; targetId?: number; targetId2?: number }>(
      bot,
      room,
      instruction,
      undefined,
      0.3
    );
    const action = parseNightAction(bot, room, response);
    if (!action) continue;

    try {
      submitNightAction(room, bot.id, action);
    } catch (err) {
      const fallback = heuristicNightAction(bot, room);
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
  if (room.phase === PHASE.REGISTRATION) {
    await runTableTalk(room);
    return;
  }
  if (room.phase === PHASE.DAY) {
    await runInspectorReveals(room);
    await runTableTalk(room);
    return;
  }
  if (room.phase === PHASE.VOTING) {
    await runInspectorReveals(room);
    await Promise.all([runTableTalk(room), runVoting(room)]);
    return;
  }
  if (room.phase === PHASE.NIGHT) {
    await runNightActions(room);
  }
}
