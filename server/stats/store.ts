import db from '../auth/db.js';
import { findUserById } from '../auth/db.js';
import { syncUserGamesPlayed } from '../social/store.js';
import { getRoleLabel, isMafiaTeam, isTown } from '../game/roles.js';
import type { GameRoom, RoleId, WinnerTeam } from '../types/index.js';

const DEFAULT_MMR = 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS user_game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    session_id INTEGER,
    role TEXT NOT NULL,
    team TEXT NOT NULL,
    winner_team TEXT NOT NULL,
    won INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    mmr_before INTEGER NOT NULL,
    mmr_delta INTEGER NOT NULL,
    mmr_after INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_game_results_user ON user_game_results(user_id, created_at DESC);
`);

function migrateMmrColumn(): void {
  const cols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('mmr')) {
    db.exec('ALTER TABLE users ADD COLUMN mmr INTEGER NOT NULL DEFAULT 1000');
    db.exec('UPDATE users SET mmr = 1000 + total_score WHERE total_score != 0');
  }
}

migrateMmrColumn();

function backfillGamesPlayedFromResults(): void {
  db.exec(`
    UPDATE users
    SET games_played = (
      SELECT COUNT(*) FROM user_game_results WHERE user_id = users.id
    )
    WHERE id IN (SELECT DISTINCT user_id FROM user_game_results)
  `);
}

backfillGamesPlayedFromResults();

export type PlayerTeam = 'town' | 'mafia' | 'neutral';

export interface UserGameResultRow {
  id: number;
  userId: number;
  roomId: number;
  sessionId: number | null;
  role: RoleId;
  team: PlayerTeam;
  winnerTeam: WinnerTeam;
  won: boolean;
  score: number;
  mmrBefore: number;
  mmrDelta: number;
  mmrAfter: number;
  createdAt: string;
}

export interface RoleStatBucket {
  role: RoleId;
  roleLabel: string;
  games: number;
  wins: number;
  winRate: number;
}

export interface TeamStatBucket {
  games: number;
  wins: number;
  winRate: number;
}

export interface RecentGameStat {
  id: number;
  roomId: number;
  role: RoleId;
  roleLabel: string;
  won: boolean;
  score: number;
  mmrDelta: number;
  mmrAfter: number;
  createdAt: string;
}

export interface UserStatistics {
  userId: number;
  mmr: number;
  rank: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageScore: number;
  town: TeamStatBucket;
  mafia: TeamStatBucket;
  roles: RoleStatBucket[];
  recentGames: RecentGameStat[];
}

function getPlayerTeam(role: RoleId): PlayerTeam {
  if (isMafiaTeam(role)) return 'mafia';
  if (role === 'maniac') return 'neutral';
  return 'town';
}

function didPlayerWin(role: RoleId | null, winnerTeam: WinnerTeam): boolean {
  if (!role || !winnerTeam) return false;
  if (winnerTeam === 'town') return isTown(role) && role !== 'maniac';
  if (winnerTeam === 'mafia') return isMafiaTeam(role);
  return false;
}

export function calculateMmrDelta(won: boolean, score: number): number {
  let delta = won ? 18 : -12;
  delta += Math.round(score / 25);
  return Math.max(-35, Math.min(35, delta));
}

function getUserMmr(userId: number): number {
  const row = db.prepare('SELECT mmr FROM users WHERE id = ?').get(userId) as { mmr: number } | undefined;
  return row?.mmr ?? DEFAULT_MMR;
}

export function updateUserMmr(userId: number, delta: number): number {
  const before = getUserMmr(userId);
  const after = Math.max(0, before + delta);
  db.prepare('UPDATE users SET mmr = ? WHERE id = ?').run(after, userId);
  return after;
}

export function getUserRank(userId: number): number | null {
  const user = findUserById(userId);
  if (!user || user.is_banned) return null;
  const row = db
    .prepare(
      `SELECT COUNT(*) + 1 AS rank
       FROM users
       WHERE is_banned = 0 AND (
         mmr > (SELECT mmr FROM users WHERE id = ?)
         OR (mmr = (SELECT mmr FROM users WHERE id = ?) AND games_played > (SELECT games_played FROM users WHERE id = ?))
         OR (mmr = (SELECT mmr FROM users WHERE id = ?) AND games_played = (SELECT games_played FROM users WHERE id = ?) AND id < ?)
       )`
    )
    .get(userId, userId, userId, userId, userId, userId) as { rank: number } | undefined;
  return row?.rank ?? null;
}

export function recordRoomGameResults(room: GameRoom): void {
  if (room.phase !== 'ended' || room.statsSynced || !room.winnerTeam || room.kind === 'chat') return;

  const winnerTeam = room.winnerTeam;
  const syncedUserIds = new Set<number>();
  for (const player of room.players) {
    if (!player.userId || !player.inGame || !player.role) continue;

    const role = player.role;
    const team = getPlayerTeam(role);
    const won = didPlayerWin(role, winnerTeam);
    const mmrBefore = getUserMmr(player.userId);
    const mmrDelta = calculateMmrDelta(won, player.score);
    const mmrAfter = updateUserMmr(player.userId, mmrDelta);

    db.prepare(
      `INSERT INTO user_game_results
        (user_id, room_id, session_id, role, team, winner_team, won, score, mmr_before, mmr_delta, mmr_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      player.userId,
      room.id,
      room.sessionId,
      role,
      team,
      winnerTeam,
      won ? 1 : 0,
      player.score,
      mmrBefore,
      mmrDelta,
      mmrAfter
    );
    syncedUserIds.add(player.userId);
  }

  for (const userId of syncedUserIds) {
    syncUserGamesPlayed(userId);
  }

  room.statsSynced = true;
}

function mapRecentRow(row: {
  id: number;
  room_id: number;
  role: string;
  won: number;
  score: number;
  mmr_delta: number;
  mmr_after: number;
  created_at: string;
}): RecentGameStat {
  const role = row.role as RoleId;
  return {
    id: row.id,
    roomId: row.room_id,
    role,
    roleLabel: getRoleLabel(role),
    won: !!row.won,
    score: row.score,
    mmrDelta: row.mmr_delta,
    mmrAfter: row.mmr_after,
    createdAt: row.created_at,
  };
}

export function getUserStatistics(userId: number): UserStatistics | null {
  const user = findUserById(userId);
  if (!user) return null;

  const rows = db
    .prepare(
      `SELECT id, room_id, role, won, score, mmr_delta, mmr_after, created_at, team
       FROM user_game_results
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId) as {
    id: number;
    room_id: number;
    role: string;
    team: PlayerTeam;
    won: number;
    score: number;
    mmr_delta: number;
    mmr_after: number;
    created_at: string;
  }[];

  const gamesPlayed = rows.length;
  const wins = rows.filter((row) => row.won).length;
  const losses = gamesPlayed - wins;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0;
  const averageScore =
    gamesPlayed > 0
      ? Math.round((rows.reduce((sum, row) => sum + row.score, 0) / gamesPlayed) * 10) / 10
      : 0;

  const townRows = rows.filter((row) => row.team === 'town');
  const mafiaRows = rows.filter((row) => row.team === 'mafia');

  const buildTeamBucket = (teamRows: typeof rows): TeamStatBucket => {
    const games = teamRows.length;
    const teamWins = teamRows.filter((row) => row.won).length;
    return {
      games,
      wins: teamWins,
      winRate: games > 0 ? Math.round((teamWins / games) * 1000) / 10 : 0,
    };
  };

  const roleMap = new Map<RoleId, { games: number; wins: number }>();
  for (const row of rows) {
    const role = row.role as RoleId;
    const bucket = roleMap.get(role) || { games: 0, wins: 0 };
    bucket.games += 1;
    if (row.won) bucket.wins += 1;
    roleMap.set(role, bucket);
  }

  const roles: RoleStatBucket[] = Array.from(roleMap.entries())
    .map(([role, bucket]) => ({
      role,
      roleLabel: getRoleLabel(role),
      games: bucket.games,
      wins: bucket.wins,
      winRate: bucket.games > 0 ? Math.round((bucket.wins / bucket.games) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.games - a.games);

  return {
    userId,
    mmr: user.mmr ?? DEFAULT_MMR,
    rank: getUserRank(userId),
    gamesPlayed,
    wins,
    losses,
    winRate,
    averageScore,
    town: buildTeamBucket(townRows),
    mafia: buildTeamBucket(mafiaRows),
    roles,
    recentGames: rows.slice(0, 20).map(mapRecentRow),
  };
}
