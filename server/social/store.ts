import db from '../auth/db.js';
import { findUserById, publicUser } from '../auth/db.js';
import { getUserPresence } from '../presence.js';
import type { PublicUser, User } from '../types/index.js';

export const REPUTATION_MIN_GAMES = 100;

db.exec(`
  CREATE TABLE IF NOT EXISTS user_friends (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id != friend_id)
  );
  CREATE TABLE IF NOT EXISTS reputation_votes (
    voter_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (voter_id, target_id),
    CHECK (voter_id != target_id)
  );
`);

export function incrementGamesPlayed(userId: number): void {
  db.prepare('UPDATE users SET games_played = COALESCE(games_played, 0) + 1 WHERE id = ?').run(userId);
}

export function syncUserGamesPlayed(userId: number): void {
  const row = db.prepare('SELECT COUNT(*) AS c FROM user_game_results WHERE user_id = ?').get(userId) as
    | { c: number }
    | undefined;
  db.prepare('UPDATE users SET games_played = ? WHERE id = ?').run(row?.c ?? 0, userId);
}

export function getGamesPlayed(userId: number): number {
  const fromResults = db
    .prepare('SELECT COUNT(*) AS c FROM user_game_results WHERE user_id = ?')
    .get(userId) as { c: number } | undefined;
  const fromColumn = db.prepare('SELECT games_played FROM users WHERE id = ?').get(userId) as
    | { games_played: number }
    | undefined;
  return Math.max(fromResults?.c ?? 0, fromColumn?.games_played ?? 0);
}

export function getReputation(userId: number): number {
  const row = db.prepare('SELECT reputation FROM users WHERE id = ?').get(userId) as
    | { reputation: number }
    | undefined;
  return row?.reputation ?? 0;
}

export function areFriends(userId: number, friendId: number): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM user_friends WHERE user_id = ? AND friend_id = ?')
    .get(userId, friendId) as { ok: number } | undefined;
  return !!row;
}

export function addFriend(userId: number, friendId: number): void {
  const insert =
    'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)';
  db.prepare(insert).run(userId, friendId);
  db.prepare(insert).run(friendId, userId);
}

export function removeFriend(userId: number, friendId: number): void {
  db.prepare('DELETE FROM user_friends WHERE user_id = ? AND friend_id = ?').run(userId, friendId);
  db.prepare('DELETE FROM user_friends WHERE user_id = ? AND friend_id = ?').run(friendId, userId);
}

export type FriendListItem = PublicUser & { isOnline: boolean; lastSeenAt: string | null };

export function listFriends(userId: number): FriendListItem[] {
  const rows = db
    .prepare(
      `SELECT u.* FROM users u
       INNER JOIN user_friends f ON f.friend_id = u.id
       WHERE f.user_id = ?
       ORDER BY u.display_name COLLATE NOCASE`
    )
    .all(userId) as User[];

  return rows.map((row) => {
    const user = publicUser(row)!;
    return { ...user, ...getUserPresence(user.id) };
  });
}

export function getReputationVote(voterId: number, targetId: number): -1 | 1 | null {
  const row = db
    .prepare('SELECT value FROM reputation_votes WHERE voter_id = ? AND target_id = ?')
    .get(voterId, targetId) as { value: number } | undefined;
  if (!row) return null;
  return row.value === -1 ? -1 : 1;
}

export function castReputationVote(
  voterId: number,
  targetId: number,
  value: -1 | 1,
  opts?: { adminBypass?: boolean }
): { reputation: number } {
  if (voterId === targetId) {
    throw new Error('Нельзя оценить самого себя');
  }
  if (!findUserById(targetId)) {
    throw new Error('Пользователь не найден');
  }
  if (!opts?.adminBypass && getGamesPlayed(voterId) < REPUTATION_MIN_GAMES) {
    throw new Error(`Репутацию можно ставить после ${REPUTATION_MIN_GAMES} сыгранных игр`);
  }
  if (getReputationVote(voterId, targetId) !== null) {
    throw new Error('Вы уже оценили этого игрока');
  }

  const apply = db.transaction(() => {
    db.prepare('INSERT INTO reputation_votes (voter_id, target_id, value) VALUES (?, ?, ?)').run(
      voterId,
      targetId,
      value
    );
    db.prepare('UPDATE users SET reputation = COALESCE(reputation, 0) + ? WHERE id = ?').run(
      value,
      targetId
    );
  });
  apply();

  return { reputation: getReputation(targetId) };
}

export function adminSetReputation(userId: number, reputation: number): number {
  if (!findUserById(userId)) {
    throw new Error('Пользователь не найден');
  }
  const normalized = Math.trunc(reputation);
  db.prepare('UPDATE users SET reputation = ? WHERE id = ?').run(normalized, userId);
  return normalized;
}

export function canViewerVoteReputation(
  viewerId: number,
  targetId: number,
  viewerIsAdmin: boolean
): boolean {
  if (viewerId === targetId) return false;
  if (getReputationVote(viewerId, targetId) !== null) return false;
  if (viewerIsAdmin) return true;
  if (getGamesPlayed(viewerId) < REPUTATION_MIN_GAMES) return false;
  return true;
}
