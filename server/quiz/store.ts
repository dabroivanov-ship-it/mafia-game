import db from '../auth/db.js';

export interface QuizLeaderboardEntry {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  quizCorrectAnswers: number;
}

export function getQuizCorrectAnswers(userId: number): number {
  const row = db
    .prepare('SELECT quiz_correct_answers FROM users WHERE id = ?')
    .get(userId) as { quiz_correct_answers: number } | undefined;
  return row?.quiz_correct_answers ?? 0;
}

export function incrementQuizCorrectAnswers(userId: number): number {
  db.prepare('UPDATE users SET quiz_correct_answers = quiz_correct_answers + 1 WHERE id = ?').run(userId);
  return getQuizCorrectAnswers(userId);
}

export function listQuizLeaderboard(limit = 10): QuizLeaderboardEntry[] {
  const rows = db
    .prepare(
      `SELECT id, username, display_name, avatar, quiz_correct_answers
       FROM users
       WHERE quiz_correct_answers > 0 AND is_banned = 0
       ORDER BY quiz_correct_answers DESC, id ASC
       LIMIT ?`
    )
    .all(limit) as {
    id: number;
    username: string;
    display_name: string;
    avatar: string | null;
    quiz_correct_answers: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar,
    quizCorrectAnswers: row.quiz_correct_answers,
  }));
}
