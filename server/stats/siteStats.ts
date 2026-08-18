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
  };
}
