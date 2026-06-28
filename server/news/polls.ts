import db from '../auth/db.js';
import {
  MAX_NEWS_POLL_OPTION_LENGTH,
  MAX_NEWS_POLL_OPTIONS,
  MAX_NEWS_POLL_QUESTION_LENGTH,
  MIN_NEWS_POLL_OPTIONS,
} from '../security/constants.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS news_polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL UNIQUE,
    question TEXT NOT NULL,
    ends_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (news_id) REFERENCES news_posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS news_poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (poll_id) REFERENCES news_polls(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_news_poll_options_poll ON news_poll_options(poll_id, position ASC);

  CREATE TABLE IF NOT EXISTS news_poll_votes (
    poll_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (poll_id, user_id),
    FOREIGN KEY (poll_id) REFERENCES news_polls(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES news_poll_options(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

interface PollRow {
  id: number;
  news_id: number;
  question: string;
  ends_at: string | null;
  created_at: string;
}

interface OptionRow {
  id: number;
  poll_id: number;
  label: string;
  position: number;
}

export interface NewsPollOption {
  id: number;
  label: string;
  voteCount: number;
  percent: number;
}

export interface NewsPoll {
  id: number;
  newsId: number;
  question: string;
  endsAt: string | null;
  isClosed: boolean;
  totalVotes: number;
  options: NewsPollOption[];
  userVoteOptionId: number | null;
}

export interface PollInput {
  enabled: boolean;
  question?: string;
  options?: string[];
  endsAt?: string | null;
}

function formatDate(value: string): string {
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

function parseEndsAt(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error('Некорректная дата окончания голосования');
  return date.toISOString();
}

function isPollClosed(endsAt: string | null): boolean {
  if (!endsAt) return false;
  return new Date(endsAt).getTime() <= Date.now();
}

function normalizeOptions(raw: string[] | undefined): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of raw ?? []) {
    const label = String(item || '').trim().slice(0, MAX_NEWS_POLL_OPTION_LENGTH);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(label);
    if (options.length >= MAX_NEWS_POLL_OPTIONS) break;
  }
  return options;
}

function getPollRowByNewsId(newsId: number): PollRow | null {
  return (
    (db.prepare('SELECT * FROM news_polls WHERE news_id = ?').get(newsId) as PollRow | undefined) ??
    null
  );
}

function countPollVotes(pollId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM news_poll_votes WHERE poll_id = ?')
    .get(pollId) as { count: number };
  return row?.count ?? 0;
}

function buildPoll(poll: PollRow, userId?: number): NewsPoll {
  const optionRows = db
    .prepare('SELECT * FROM news_poll_options WHERE poll_id = ? ORDER BY position ASC, id ASC')
    .all(poll.id) as OptionRow[];

  const voteCounts = new Map<number, number>();
  const rows = db
    .prepare(
      'SELECT option_id, COUNT(*) AS count FROM news_poll_votes WHERE poll_id = ? GROUP BY option_id'
    )
    .all(poll.id) as { option_id: number; count: number }[];
  for (const row of rows) voteCounts.set(row.option_id, row.count);

  const totalVotes = countPollVotes(poll.id);
  let userVoteOptionId: number | null = null;
  if (userId != null) {
    const vote = db
      .prepare('SELECT option_id FROM news_poll_votes WHERE poll_id = ? AND user_id = ?')
      .get(poll.id, userId) as { option_id: number } | undefined;
    userVoteOptionId = vote?.option_id ?? null;
  }

  const options: NewsPollOption[] = optionRows.map((row) => {
    const voteCount = voteCounts.get(row.id) ?? 0;
    const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
    return { id: row.id, label: row.label, voteCount, percent };
  });

  return {
    id: poll.id,
    newsId: poll.news_id,
    question: poll.question,
    endsAt: poll.ends_at ? formatDate(poll.ends_at) : null,
    isClosed: isPollClosed(poll.ends_at ? formatDate(poll.ends_at) : null),
    totalVotes,
    options,
    userVoteOptionId,
  };
}

export function getPollForNews(newsId: number, userId?: number): NewsPoll | null {
  const poll = getPollRowByNewsId(newsId);
  if (!poll) return null;
  return buildPoll(poll, userId);
}

export function deletePollForNews(newsId: number): void {
  const poll = getPollRowByNewsId(newsId);
  if (!poll) return;
  db.prepare('DELETE FROM news_poll_votes WHERE poll_id = ?').run(poll.id);
  db.prepare('DELETE FROM news_poll_options WHERE poll_id = ?').run(poll.id);
  db.prepare('DELETE FROM news_polls WHERE id = ?').run(poll.id);
}

export function upsertPollForNews(newsId: number, input: PollInput, userId?: number): NewsPoll | null {
  if (!input.enabled) {
    deletePollForNews(newsId);
    return null;
  }

  const question = String(input.question || '').trim().slice(0, MAX_NEWS_POLL_QUESTION_LENGTH);
  const options = normalizeOptions(input.options);
  const endsAt = parseEndsAt(input.endsAt);

  if (!question) throw new Error('Укажите вопрос голосования');
  if (options.length < MIN_NEWS_POLL_OPTIONS) {
    throw new Error(`Добавьте минимум ${MIN_NEWS_POLL_OPTIONS} варианта ответа`);
  }

  const existing = getPollRowByNewsId(newsId);
  if (existing) {
    const totalVotes = countPollVotes(existing.id);
    if (totalVotes > 0) {
      db.prepare('UPDATE news_polls SET question = ?, ends_at = ? WHERE id = ?').run(
        question,
        endsAt,
        existing.id
      );
      return buildPoll(
        db.prepare('SELECT * FROM news_polls WHERE id = ?').get(existing.id) as PollRow,
        userId
      );
    }

    db.prepare('DELETE FROM news_poll_options WHERE poll_id = ?').run(existing.id);
    db.prepare('UPDATE news_polls SET question = ?, ends_at = ? WHERE id = ?').run(
      question,
      endsAt,
      existing.id
    );
    const insertOption = db.prepare(
      'INSERT INTO news_poll_options (poll_id, label, position) VALUES (?, ?, ?)'
    );
    options.forEach((label, index) => insertOption.run(existing.id, label, index));
    return buildPoll(
      db.prepare('SELECT * FROM news_polls WHERE id = ?').get(existing.id) as PollRow,
      userId
    );
  }

  const result = db
    .prepare('INSERT INTO news_polls (news_id, question, ends_at) VALUES (?, ?, ?)')
    .run(newsId, question, endsAt);
  const pollId = Number(result.lastInsertRowid);
  const insertOption = db.prepare(
    'INSERT INTO news_poll_options (poll_id, label, position) VALUES (?, ?, ?)'
  );
  options.forEach((label, index) => insertOption.run(pollId, label, index));

  const poll = db.prepare('SELECT * FROM news_polls WHERE id = ?').get(pollId) as PollRow;
  return buildPoll(poll, userId);
}

export function castPollVote(newsId: number, optionId: number, userId: number): NewsPoll {
  const poll = getPollRowByNewsId(newsId);
  if (!poll) throw new Error('Голосование не найдено');

  const endsAt = poll.ends_at ? formatDate(poll.ends_at) : null;
  if (isPollClosed(endsAt)) throw new Error('Голосование завершено');

  const option = db
    .prepare('SELECT id FROM news_poll_options WHERE id = ? AND poll_id = ?')
    .get(optionId, poll.id) as { id: number } | undefined;
  if (!option) throw new Error('Вариант ответа не найден');

  const existingVote = db
    .prepare('SELECT option_id FROM news_poll_votes WHERE poll_id = ? AND user_id = ?')
    .get(poll.id, userId) as { option_id: number } | undefined;
  if (existingVote) throw new Error('Вы уже проголосовали');

  db.prepare(
    'INSERT INTO news_poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)'
  ).run(poll.id, option.id, userId);

  return buildPoll(poll, userId);
}
