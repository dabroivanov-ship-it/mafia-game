import fs from 'fs';
import type { GameRoom } from '../types/index.js';
import { addSystemMessage } from '../game/engine.js';
import { getQuizQuestionsPath } from '../paths.js';
import { incrementQuizCorrectAnswers } from './store.js';

export interface QuizQuestion {
  question: string;
  answers: string[];
}

interface QuizRoomState {
  questionIndex: number;
  answeredUserIds: Set<number>;
}

const roomStates = new Map<number, QuizRoomState>();
let questionsCache: QuizQuestion[] | null = null;

export function isQuizRoom(room: GameRoom): boolean {
  return room.kind === 'chat' && /викторин/i.test(room.name);
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
      questionIndex: 0,
      answeredUserIds: new Set(),
    };
    roomStates.set(roomId, state);
  }
  return state;
}

function getCurrentQuestion(state: QuizRoomState): QuizQuestion | null {
  const questions = loadQuizQuestions();
  if (questions.length === 0) return null;
  const index = state.questionIndex % questions.length;
  return questions[index];
}

function formatQuestionMessage(question: QuizQuestion): string {
  return `❓ ${question.question}`;
}

function postQuestion(room: GameRoom, state: QuizRoomState): void {
  const questions = loadQuizQuestions();
  if (questions.length === 0) {
    addSystemMessage(
      room,
      '⚠️ Викторина не настроена: добавьте вопросы в questions.txt в корне проекта.'
    );
    return;
  }

  state.answeredUserIds.clear();
  const question = getCurrentQuestion(state);
  if (!question) return;

  addSystemMessage(room, formatQuestionMessage(question));
}

export function initQuizRoom(room: GameRoom): void {
  if (!isQuizRoom(room)) return;
  const state = getState(room.id);
  const questions = loadQuizQuestions();

  if (room.chat.length === 0) {
    addSystemMessage(room, '🧠 Добро пожаловать в викторину! Отвечайте в чат — бот засчитает верный ответ.');
  }

  if (questions.length === 0) {
    addSystemMessage(
      room,
      '⚠️ Викторина не настроена: добавьте вопросы в questions.txt в корне проекта.'
    );
    return;
  }

  const hasOpenQuestion = room.chat.some(
    (msg) => msg.system && msg.text.startsWith('❓ ')
  );
  if (!hasOpenQuestion) {
    postQuestion(room, state);
  }
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

  const questions = loadQuizQuestions();
  if (questions.length === 0) return false;

  const state = getState(room.id);
  if (state.answeredUserIds.has(userId)) return true;

  const question = getCurrentQuestion(state);
  if (!question) return false;

  const normalized = normalizeAnswer(text);
  if (!normalized) return true;

  const accepted = new Set(question.answers.map(normalizeAnswer));
  if (!accepted.has(normalized)) return true;

  state.answeredUserIds.add(userId);
  const total = incrementQuizCorrectAnswers(userId);

  addSystemMessage(room, `✅ ${playerName} ответил(а) верно! Верных ответов: ${total}.`);
  state.questionIndex += 1;
  postQuestion(room, state);
  return true;
}
