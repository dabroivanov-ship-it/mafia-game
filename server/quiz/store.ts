import db from '../auth/db.js';

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
