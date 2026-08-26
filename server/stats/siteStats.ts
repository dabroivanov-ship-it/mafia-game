import db from '../auth/db.js';
import { getOnlineUserCount } from '../presence.js';
import { countPublishedNews } from '../news/store.js';
import { countViolations } from '../moderation/violationLog.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS site_counters (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
`);

export interface NewUserPreview {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
  authProviders: Array<'telegram' | 'vk' | 'email'>;
}

export interface AdminStatsDayPoint {
  date: string;
  label: string;
  registered: number;
  active: number;
}

export interface AdminSiteStats {
  usersTotal: number;
  usersOnline: number;
  usersBanned: number;
  usersModerators: number;
  usersAdmins: number;
  usersActiveToday: number;
  usersActiveWeek: number;
  usersRegisteredToday: number;
  usersRegisteredWeek: number;
  usersNewLast24h: NewUserPreview[];
  gamesPlayedTotal: number;
  gamesFinishedTotal: number;
  newsPublished: number;
  violationsTotal: number;
  visitsTotal: number;
  visitsToday: number;
  /** Последние 7 дней: регистрации и активные по last_seen */
  seriesLast7Days: AdminStatsDayPoint[];
  authProviders: { telegram: number; vk: number; email: number };
  gamesByWinner: { mafia: number; town: number; draw: number };
}

export interface PublicSiteStats {
  gamesArchived: number;
  mafiaWins: number;
  townWins: number;
  draws: number;
  online: number;
  activePlayers: number;
}

function todayNum(): number {
  return Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
}

function getCounter(key: string): number {
  const row = db.prepare('SELECT value FROM site_counters WHERE key = ?').get(key) as
    | { value: number }
    | undefined;
  return row?.value ?? 0;
}

function incCounter(key: string, delta = 1): void {
  db.prepare(
    `INSERT INTO site_counters (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = value + excluded.value`
  ).run(key, delta);
}

function setCounter(key: string, value: number): void {
  db.prepare(
    `INSERT INTO site_counters (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function recordSiteVisit(_userId: number): void {
  incCounter('visits_total');
  const today = todayNum();
  if (getCounter('visits_today_date') !== today) {
    setCounter('visits_today_date', today);
    setCounter('visits_today', 1);
  } else {
    incCounter('visits_today');
  }
}

function countGameEnds(winnerTeam?: string): number {
  if (!winnerTeam) {
    return (
      db.prepare(`SELECT COUNT(*) AS c FROM room_game_log WHERE event_type = 'game_end'`).get() as {
        c: number;
      }
    ).c;
  }
  try {
    return (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM room_game_log
           WHERE event_type = 'game_end' AND json_extract(payload, '$.winnerTeam') = ?`
        )
        .get(winnerTeam) as { c: number }
    ).c;
  } catch {
    return (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM (
             SELECT DISTINCT room_id, session_id FROM user_game_results WHERE winner_team = ?
           )`
        )
        .get(winnerTeam) as { c: number }
    ).c;
  }
}

let publicStatsCache: { at: number; stats: Omit<PublicSiteStats, 'online'> } | null = null;

export function getPublicSiteStats(): PublicSiteStats {
  const now = Date.now();
  if (!publicStatsCache || now - publicStatsCache.at > 5000) {
    const activePlayers = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM users
           WHERE is_banned = 0 AND last_seen_at IS NOT NULL
             AND last_seen_at >= datetime('now', '-30 days')`
        )
        .get() as { c: number }
    ).c;
    publicStatsCache = {
      at: now,
      stats: {
        gamesArchived: countGameEnds(),
        mafiaWins: countGameEnds('mafia'),
        townWins: countGameEnds('town'),
        draws: countGameEnds('draw'),
        activePlayers,
      },
    };
  }
  return {
    ...publicStatsCache.stats,
    online: getOnlineUserCount(),
  };
}

export function getAdminSiteStats(): AdminSiteStats {
  const usersTotal = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const usersBanned = (
    db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_banned = 1').get() as { c: number }
  ).c;
  const usersModerators = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'moderator'").get() as { c: number }
  ).c;
  const usersAdmins = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as { c: number }
  ).c;
  const usersActiveToday = (
    db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE date(last_seen_at) = date('now')")
      .get() as { c: number }
  ).c;
  const usersActiveWeek = (
    db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= datetime('now', '-7 days')")
      .get() as { c: number }
  ).c;
  const registeredSinceSql = `datetime(replace(substr(created_at, 1, 19), 'T', ' ')) >= datetime('now', '-1 day')`;
  const usersRegisteredToday = (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE ${registeredSinceSql}`).get() as { c: number }
  ).c;
  const usersRegisteredWeek = (
    db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE created_at >= datetime('now', '-7 days')")
      .get() as { c: number }
  ).c;
  const usersNewLast24h = (
    db
      .prepare(
        `SELECT id, username, display_name, created_at, telegram_id, vk_id
         FROM users
         WHERE datetime(replace(substr(created_at, 1, 19), 'T', ' ')) >= datetime('now', '-1 day')
         ORDER BY created_at DESC, id DESC
         LIMIT 50`
      )
      .all() as {
        id: number;
        username: string;
        display_name: string;
        created_at: string;
        telegram_id: string | null;
        vk_id: string | null;
      }[]
  ).map((row) => {
    const authProviders: Array<'telegram' | 'vk' | 'email'> = [];
    if (row.telegram_id) authProviders.push('telegram');
    if (row.vk_id) authProviders.push('vk');
    if (!authProviders.length) authProviders.push('email');
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at.includes('T')
        ? row.created_at
        : `${row.created_at.replace(' ', 'T')}Z`,
      authProviders,
    };
  });
  const gamesPlayedTotal = (
    db.prepare('SELECT COALESCE(SUM(games_played), 0) AS s FROM users').get() as { s: number }
  ).s;
  const gamesFinishedTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM user_game_results').get() as { c: number }
  ).c;

  const dayRows = (
    db
      .prepare(
        `WITH RECURSIVE days(n, d) AS (
           SELECT 6, date('now', '-6 days')
           UNION ALL
           SELECT n - 1, date(d, '+1 day') FROM days WHERE n > 0
         )
         SELECT
           days.d AS day,
           (SELECT COUNT(*) FROM users u
             WHERE date(replace(substr(u.created_at, 1, 19), 'T', ' ')) = days.d) AS registered,
           (SELECT COUNT(*) FROM users u
             WHERE u.last_seen_at IS NOT NULL
               AND date(u.last_seen_at) = days.d) AS active
         FROM days
         ORDER BY days.d ASC`
      )
      .all() as { day: string; registered: number; active: number }[]
  );

  const seriesLast7Days: AdminStatsDayPoint[] = dayRows.map((row) => {
    const dt = new Date(`${row.day}T12:00:00Z`);
    return {
      date: row.day,
      label: dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
      registered: row.registered,
      active: row.active,
    };
  });

  const authProviders = (
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN telegram_id IS NOT NULL AND telegram_id != '' THEN 1 ELSE 0 END) AS telegram,
           SUM(CASE WHEN vk_id IS NOT NULL AND vk_id != '' THEN 1 ELSE 0 END) AS vk,
           SUM(CASE
             WHEN (telegram_id IS NULL OR telegram_id = '')
              AND (vk_id IS NULL OR vk_id = '') THEN 1 ELSE 0 END) AS email
         FROM users`
      )
      .get() as { telegram: number; vk: number; email: number }
  );

  return {
    usersTotal,
    usersOnline: getOnlineUserCount(),
    usersBanned,
    usersModerators,
    usersAdmins,
    usersActiveToday,
    usersActiveWeek,
    usersRegisteredToday,
    usersRegisteredWeek,
    usersNewLast24h,
    gamesPlayedTotal,
    gamesFinishedTotal,
    newsPublished: countPublishedNews(),
    violationsTotal: countViolations(),
    visitsTotal: getCounter('visits_total'),
    visitsToday: getCounter('visits_today'),
    seriesLast7Days,
    authProviders: {
      telegram: authProviders.telegram ?? 0,
      vk: authProviders.vk ?? 0,
      email: authProviders.email ?? 0,
    },
    gamesByWinner: {
      mafia: countGameEnds('mafia'),
      town: countGameEnds('town'),
      draw: countGameEnds('draw'),
    },
  };
}
