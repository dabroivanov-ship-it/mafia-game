import fs from 'fs';
import type { GameRoom } from '../types/index.js';
import { addQuizBotMessage, QUIZ_BOT_NAME } from '../game/engine.js';
import { getQuizQuestionsPath } from '../paths.js';
import { incrementQuizCorrectAnswers } from './store.js';

export { QUIZ_BOT_NAME };

export interface QuizQuestion {
  question: string;
  answers: string[];
}

interface QuizRoomState {
  currentQuestion: QuizQuestion | null;
  lastQuestionIndex: number;
  answeredUserIds: Set<number>;
  timer: ReturnType<typeof setTimeout> | null;
}

const QUIZ_QUESTION_INTERVAL_MS = 60_000;
const roomStates = new Map<number, QuizRoomState>();
let questionsCache: QuizQuestion[] | null = null;
let quizBroadcast: ((roomId: number) => void) | null = null;

export function isQuizRoom(room: GameRoom): boolean {
  return room.kind === 'chat' && /викторин/i.test(room.name);
}

export function setQuizBroadcaster(fn: (roomId: number) => void): void {
  quizBroadcast = fn;
}

function notifyRoom(room: GameRoom): void {
  quizBroadcast?.(room.id);
}

function countCyrillic(text: string): number {
  const matches = text.match(/[\u0400-\u04FF]/g);
  return matches ? matches.length : 0;
}

function readQuestionsText(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const encoding = (process.env.QUIZ_QUESTIONS_ENCODING || '').trim().toLowerCase();

  if (encoding === 'utf8' || encoding === 'utf-8') {
    return buf.toString('utf8');
  }
  if (encoding === 'win1251' || encoding === 'windows-1251' || encoding === 'cp1251') {
    return new TextDecoder('windows-1251').decode(buf);
  }

  const utf8 = buf.toString('utf8');
  const win1251 = new TextDecoder('windows-1251').decode(buf);
  const sampleUtf8 = utf8.slice(0, 4000);
  const sampleWin = win1251.slice(0, 4000);

  if (utf8.includes('\uFFFD')) return win1251;
  if (countCyrillic(sampleWin) > countCyrillic(sampleUtf8)) return win1251;
  return utf8;
}

function parseQuestionsFile(raw: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sep = trimmed.indexOf('|');
    if (sep < 0) continue;

    const question = trimmed.slice(0, sep).trim();
    const answer = trimmed.slice(sep + 1).trim();
    if (!question || !answer) continue;

    questions.push({ question, answers: [answer] });
  }

  return questions;
}

export function loadQuizQuestions(): QuizQuestion[] {
  if (questionsCache) return questionsCache;

  const filePath = getQuizQuestionsPath();
  if (!fs.existsSync(filePath)) {
    console.warn(`[quiz] Файл с вопросами не найден: ${filePath}`);
    questionsCache = [];
    return questionsCache;
  }

  try {
    const raw = readQuestionsText(filePath);
    questionsCache = parseQuestionsFile(raw);
    console.log(`[quiz] Загружено вопросов: ${questionsCache.length}`);
    return questionsCache;
  } catch (err) {
    console.error('[quiz] Ошибка чтения вопросов:', err);
    questionsCache = [];
    return questionsCache;
  }
}

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getState(roomId: number): QuizRoomState {
  let state = roomStates.get(roomId);
  if (!state) {
    state = {
      currentQuestion: null,
      lastQuestionIndex: -1,
      answeredUserIds: new Set(),
      timer: null,
    };
    roomStates.set(roomId, state);
  }
  return state;
}

function pickRandomQuestion(state: QuizRoomState): QuizQuestion | null {
  const questions = loadQuizQuestions();
  if (questions.length === 0) return null;

  let index: number;
  if (questions.length === 1) {
    index = 0;
  } else {
    do {
      index = Math.floor(Math.random() * questions.length);
    } while (index === state.lastQuestionIndex);
  }

  state.lastQuestionIndex = index;
  state.currentQuestion = questions[index]!;
  return state.currentQuestion;
}

function formatQuestionMessage(question: QuizQuestion): string {
  return `❓ ${question.question}`;
}

function postRandomQuestion(room: GameRoom): void {
  const state = getState(room.id);
  const questions = loadQuizQuestions();
  if (questions.length === 0) {
    addQuizBotMessage(
      room,
      '⚠️ Викторина не настроена: добавьте вопросы в questions.txt в корне проекта.'
    );
    notifyRoom(room);
    return;
  }

  state.answeredUserIds.clear();
  const question = pickRandomQuestion(state);
  if (!question) return;

  addQuizBotMessage(room, formatQuestionMessage(question));
  notifyRoom(room);
}

function scheduleQuestionTimer(room: GameRoom): void {
  const state = getState(room.id);
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    postRandomQuestion(room);
    scheduleQuestionTimer(room);
  }, QUIZ_QUESTION_INTERVAL_MS);
}

export function stopQuizRoom(roomId: number): void {
  const state = roomStates.get(roomId);
  if (state?.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

export function initQuizRoom(room: GameRoom): void {
  if (!isQuizRoom(room)) return;

  stopQuizRoom(room.id);

  const questions = loadQuizQuestions();
  if (questions.length === 0) {
    addQuizBotMessage(
      room,
      '⚠️ Викторина не настроена: добавьте вопросы в questions.txt в корне проекта.'
    );
    notifyRoom(room);
    return;
  }

  const hasWelcome = room.chat.some(
    (msg) => msg.system && msg.playerName === QUIZ_BOT_NAME && msg.text.includes('викторину')
  );
  if (!hasWelcome) {
    addQuizBotMessage(
      room,
      '🧠 Добро пожаловать в викторину! Отвечайте в чат — бот засчитает верный ответ.'
    );
  }

  postRandomQuestion(room);
  scheduleQuestionTimer(room);
}

export function initAllQuizRooms(rooms: Iterable<GameRoom>): void {
  loadQuizQuestions();
  for (const room of rooms) {
    if (isQuizRoom(room)) initQuizRoom(room);
  }
}

export function handleQuizAnswer(
  room: GameRoom,
  userId: number | null,
  playerName: string,
  text: string
): boolean {
  if (!isQuizRoom(room) || !userId) return false;

  const state = getState(room.id);
  const question = state.currentQuestion;
  if (!question) return false;

  if (state.answeredUserIds.has(userId)) return true;

  const normalized = normalizeAnswer(text);
  if (!normalized) return true;

  const accepted = new Set(question.answers.map(normalizeAnswer));
  if (!accepted.has(normalized)) return true;

  state.answeredUserIds.add(userId);
  const total = incrementQuizCorrectAnswers(userId);

  addQuizBotMessage(room, `✅ ${playerName} ответил(а) верно! Верных ответов: ${total}.`);
  notifyRoom(room);
  return true;
}
