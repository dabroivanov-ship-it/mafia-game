import db, { findUserById } from '../auth/db.js';
import { getUserMessageCount } from '../history/store.js';

/** Минимум сообщений в чате, чтобы создать клан. */
export const CLAN_CREATE_MIN_POSTS = 50;
export const CLAN_NAME_MAX = 40;
export const CLAN_DESC_MAX = 400;
export const CLAN_NEWS_TITLE_MAX = 120;
export const CLAN_NEWS_BODY_MAX = 8000;

export type ClanJoinMode = 'open' | 'approval';

db.exec(`
  CREATE TABLE IF NOT EXISTS clans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    leader_id INTEGER NOT NULL,
    join_mode TEXT NOT NULL DEFAULT 'approval',
    room_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (leader_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_clans_leader ON clans(leader_id);
  CREATE INDEX IF NOT EXISTS idx_clans_room ON clans(room_id);

  CREATE TABLE IF NOT EXISTS clan_members (
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (clan_id, user_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_clan_members_user ON clan_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id);

  CREATE TABLE IF NOT EXISTS clan_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_clan_apps_clan ON clan_applications(clan_id, status);
  CREATE INDEX IF NOT EXISTS idx_clan_apps_user ON clan_applications(user_id);

  CREATE TABLE IF NOT EXISTS clan_application_bans (
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (clan_id, user_id),
    FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clan_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_clan_news_clan ON clan_news(clan_id, created_at DESC);
`);

interface ClanRow {
  id: number;
  name: string;
  description: string;
  leader_id: number;
  join_mode: string;
  room_id: number | null;
  created_at: string;
}

export interface ClanMemberView {
  userId: number;
  username: string;
  displayName: string;
  avatar: string | null;
  role: 'leader' | 'member';
  joinedAt: string;
}

export interface ClanListItem {
  id: number;
  name: string;
  description: string;
  leaderId: number;
  leaderName: string;
  joinMode: ClanJoinMode;
  roomId: number | null;
  memberCount: number;
  createdAt: string;
  myRole: 'leader' | 'member' | null;
  myApplicationStatus: 'pending' | 'rejected' | null;
  amBanned: boolean;
}

export interface ClanDetail extends ClanListItem {
  members: ClanMemberView[];
  pendingApplications: {
    id: number;
    userId: number;
    username: string;
    displayName: string;
    avatar: string | null;
    createdAt: string;
  }[];
  blacklist: {
    userId: number;
    username: string;
    displayName: string;
    avatar: string | null;
    createdAt: string;
  }[];
}

export interface ClanNewsItem {
  id: number;
  clanId: number;
  authorId: number;
  authorName: string;
  title: string;
  body: string;
  createdAt: string;
}

function iso(ts: string): string {
  return ts.includes('T') ? ts : `${ts.replace(' ', 'T')}Z`;
}

function normalizeJoinMode(raw: unknown): ClanJoinMode {
  return raw === 'open' ? 'open' : 'approval';
}

export function getUserClanId(userId: number): number | null {
  const row = db
    .prepare('SELECT clan_id FROM clan_members WHERE user_id = ?')
    .get(userId) as { clan_id: number } | undefined;
  return row?.clan_id ?? null;
}

export function getUserClanBrief(userId: number): { id: number; name: string } | null {
  const row = db
    .prepare(
      `SELECT c.id, c.name
       FROM clan_members m
       INNER JOIN clans c ON c.id = m.clan_id
       WHERE m.user_id = ?`
    )
    .get(userId) as { id: number; name: string } | undefined;
  return row ? { id: row.id, name: row.name } : null;
}

export function isClanMember(clanId: number, userId: number): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM clan_members WHERE clan_id = ? AND user_id = ?')
    .get(clanId, userId) as { ok: number } | undefined;
  return !!row;
}

export function isClanLeader(clanId: number, userId: number): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM clan_members WHERE clan_id = ? AND user_id = ? AND role = 'leader'`)
    .get(clanId, userId) as { ok: number } | undefined;
  return !!row;
}

export function getClanById(clanId: number): ClanRow | null {
  return (db.prepare('SELECT * FROM clans WHERE id = ?').get(clanId) as ClanRow | undefined) ?? null;
}

export function getClanByRoomId(roomId: number): ClanRow | null {
  return (
    (db.prepare('SELECT * FROM clans WHERE room_id = ?').get(roomId) as ClanRow | undefined) ?? null
  );
}

export function canUserAccessClanRoom(roomId: number, userId: number): boolean {
  const clan = getClanByRoomId(roomId);
  if (!clan) return true;
  return isClanMember(clan.id, userId);
}

export function getCreateClanEligibility(userId: number): {
  canCreate: boolean;
  messageCount: number;
  required: number;
  alreadyInClan: boolean;
} {
  const messageCount = getUserMessageCount(userId);
  const alreadyInClan = getUserClanId(userId) != null;
  return {
    canCreate: !alreadyInClan && messageCount >= CLAN_CREATE_MIN_POSTS,
    messageCount,
    required: CLAN_CREATE_MIN_POSTS,
    alreadyInClan,
  };
}

function memberCount(clanId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM clan_members WHERE clan_id = ?').get(clanId) as {
    c: number;
  };
  return row?.c ?? 0;
}

function myApplicationStatus(
  clanId: number,
  userId: number
): 'pending' | 'rejected' | null {
  const row = db
    .prepare(
      `SELECT status FROM clan_applications
       WHERE clan_id = ? AND user_id = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(clanId, userId) as { status: string } | undefined;
  if (!row) return null;
  if (row.status === 'pending') return 'pending';
  if (row.status === 'rejected') return 'rejected';
  return null;
}

function isBannedFromClan(clanId: number, userId: number): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM clan_application_bans WHERE clan_id = ? AND user_id = ?')
    .get(clanId, userId) as { ok: number } | undefined;
  return !!row;
}

function rowToListItem(row: ClanRow, viewerId: number): ClanListItem {
  const leader = findUserById(row.leader_id);
  const myClanId = getUserClanId(viewerId);
  const myRole =
    myClanId === row.id
      ? isClanLeader(row.id, viewerId)
        ? 'leader'
        : 'member'
      : null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    leaderId: row.leader_id,
    leaderName: leader?.username || leader?.display_name || '?',
    joinMode: normalizeJoinMode(row.join_mode),
    roomId: row.room_id,
    memberCount: memberCount(row.id),
    createdAt: iso(row.created_at),
    myRole,
    myApplicationStatus: myRole ? null : myApplicationStatus(row.id, viewerId),
    amBanned: isBannedFromClan(row.id, viewerId),
  };
}

export function listClans(viewerId: number): ClanListItem[] {
  const rows = db
    .prepare('SELECT * FROM clans ORDER BY name COLLATE NOCASE ASC')
    .all() as ClanRow[];
  return rows.map((row) => rowToListItem(row, viewerId));
}

export function listClanMembers(clanId: number): ClanMemberView[] {
  const rows = db
    .prepare(
      `SELECT cm.user_id, cm.role, cm.joined_at
       FROM clan_members cm
       WHERE cm.clan_id = ?
       ORDER BY CASE cm.role WHEN 'leader' THEN 0 ELSE 1 END, cm.joined_at ASC`
    )
    .all(clanId) as { user_id: number; role: string; joined_at: string }[];
  return rows.map((row) => {
    const user = findUserById(row.user_id);
    return {
      userId: row.user_id,
      username: user?.username || '?',
      displayName: user?.display_name || user?.username || '?',
      avatar: user?.avatar || null,
      role: row.role === 'leader' ? 'leader' : 'member',
      joinedAt: iso(row.joined_at),
    };
  });
}

export function listClanBlacklist(clanId: number): ClanDetail['blacklist'] {
  const rows = db
    .prepare(
      `SELECT user_id, created_at FROM clan_application_bans
       WHERE clan_id = ?
       ORDER BY created_at DESC`
    )
    .all(clanId) as { user_id: number; created_at: string }[];
  return rows.map((row) => {
    const user = findUserById(row.user_id);
    return {
      userId: row.user_id,
      username: user?.username || '?',
      displayName: user?.display_name || user?.username || '?',
      avatar: user?.avatar || null,
      createdAt: iso(row.created_at),
    };
  });
}

export function getClanDetail(clanId: number, viewerId: number): ClanDetail | null {
  const row = getClanById(clanId);
  if (!row) return null;
  const base = rowToListItem(row, viewerId);
  const members = listClanMembers(clanId);
  let pendingApplications: ClanDetail['pendingApplications'] = [];
  let blacklist: ClanDetail['blacklist'] = [];
  if (isClanLeader(clanId, viewerId)) {
    const apps = db
      .prepare(
        `SELECT id, user_id, created_at FROM clan_applications
         WHERE clan_id = ? AND status = 'pending'
         ORDER BY created_at ASC`
      )
      .all(clanId) as { id: number; user_id: number; created_at: string }[];
    pendingApplications = apps.map((app) => {
      const user = findUserById(app.user_id);
      return {
        id: app.id,
        userId: app.user_id,
        username: user?.username || '?',
        displayName: user?.display_name || user?.username || '?',
        avatar: user?.avatar || null,
        createdAt: iso(app.created_at),
      };
    });
    blacklist = listClanBlacklist(clanId);
  }
  return { ...base, members, pendingApplications, blacklist };
}

export function createClan(
  leaderId: number,
  input: { name: string; description?: string; joinMode?: ClanJoinMode },
  roomId: number
): ClanListItem {
  const eligibility = getCreateClanEligibility(leaderId);
  if (eligibility.alreadyInClan) {
    throw new Error('Вы уже состоите в клане');
  }
  if (!eligibility.canCreate) {
    throw new Error(
      `Чтобы создать клан, нужно минимум ${CLAN_CREATE_MIN_POSTS} сообщений в чате (сейчас ${eligibility.messageCount})`
    );
  }

  const name = String(input.name || '')
    .trim()
    .slice(0, CLAN_NAME_MAX);
  if (name.length < 2) throw new Error('Название клана слишком короткое');
  const description = String(input.description || '')
    .trim()
    .slice(0, CLAN_DESC_MAX);
  const joinMode = normalizeJoinMode(input.joinMode);

  const existing = db
    .prepare('SELECT id FROM clans WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: number } | undefined;
  if (existing) throw new Error('Клан с таким названием уже есть');

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO clans (name, description, leader_id, join_mode, room_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(name, description, leaderId, joinMode, roomId);
    const clanId = Number(result.lastInsertRowid);
    db.prepare(
      `INSERT INTO clan_members (clan_id, user_id, role) VALUES (?, ?, 'leader')`
    ).run(clanId, leaderId);
    return clanId;
  });

  const clanId = tx();
  return rowToListItem(getClanById(clanId)!, leaderId);
}

export function setClanRoomId(clanId: number, roomId: number): void {
  db.prepare('UPDATE clans SET room_id = ? WHERE id = ?').run(roomId, clanId);
}

export function updateClanSettings(
  clanId: number,
  leaderId: number,
  input: { description?: string; joinMode?: ClanJoinMode }
): ClanDetail {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава клана может менять настройки');
  const clan = getClanById(clanId);
  if (!clan) throw new Error('Клан не найден');

  const description =
    input.description !== undefined
      ? String(input.description).trim().slice(0, CLAN_DESC_MAX)
      : clan.description;
  const joinMode =
    input.joinMode !== undefined ? normalizeJoinMode(input.joinMode) : normalizeJoinMode(clan.join_mode);

  db.prepare('UPDATE clans SET description = ?, join_mode = ? WHERE id = ?').run(
    description,
    joinMode,
    clanId
  );
  return getClanDetail(clanId, leaderId)!;
}

export function applyToClan(clanId: number, userId: number): { joined: boolean; pending: boolean } {
  const clan = getClanById(clanId);
  if (!clan) throw new Error('Клан не найден');
  if (getUserClanId(userId)) throw new Error('Вы уже состоите в клане');
  if (isBannedFromClan(clanId, userId)) {
    throw new Error('Вам запрещено подавать заявку в этот клан');
  }

  const pending = db
    .prepare(
      `SELECT id FROM clan_applications WHERE clan_id = ? AND user_id = ? AND status = 'pending'`
    )
    .get(clanId, userId) as { id: number } | undefined;
  if (pending) throw new Error('Заявка уже отправлена');

  if (normalizeJoinMode(clan.join_mode) === 'open') {
    db.prepare(`INSERT INTO clan_members (clan_id, user_id, role) VALUES (?, ?, 'member')`).run(
      clanId,
      userId
    );
    return { joined: true, pending: false };
  }

  db.prepare(
    `INSERT INTO clan_applications (clan_id, user_id, status) VALUES (?, ?, 'pending')`
  ).run(clanId, userId);
  return { joined: false, pending: true };
}

export function decideApplication(
  clanId: number,
  leaderId: number,
  applicationId: number,
  decision: 'approve' | 'reject' | 'ban'
): { targetUserId: number } {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава клана может решать заявки');

  const app = db
    .prepare(`SELECT * FROM clan_applications WHERE id = ? AND clan_id = ? AND status = 'pending'`)
    .get(applicationId, clanId) as
    | { id: number; user_id: number; clan_id: number }
    | undefined;
  if (!app) throw new Error('Заявка не найдена');

  if (decision === 'approve') {
    if (getUserClanId(app.user_id)) {
      db.prepare(
        `UPDATE clan_applications SET status = 'rejected', decided_at = datetime('now') WHERE id = ?`
      ).run(app.id);
      throw new Error('Игрок уже в другом клане');
    }
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE clan_applications SET status = 'approved', decided_at = datetime('now') WHERE id = ?`
      ).run(app.id);
      db.prepare(`INSERT INTO clan_members (clan_id, user_id, role) VALUES (?, ?, 'member')`).run(
        clanId,
        app.user_id
      );
    });
    tx();
    return { targetUserId: app.user_id };
  }

  db.prepare(
    `UPDATE clan_applications SET status = 'rejected', decided_at = datetime('now') WHERE id = ?`
  ).run(app.id);

  if (decision === 'ban') {
    db.prepare(
      `INSERT OR IGNORE INTO clan_application_bans (clan_id, user_id, created_by) VALUES (?, ?, ?)`
    ).run(clanId, app.user_id, leaderId);
  }
  return { targetUserId: app.user_id };
}

export function leaveClan(userId: number): { clanId: number; dissolved: boolean; roomId: number | null } {
  const clanId = getUserClanId(userId);
  if (!clanId) throw new Error('Вы не состоите в клане');
  const clan = getClanById(clanId);
  if (!clan) throw new Error('Клан не найден');

  if (isClanLeader(clanId, userId)) {
    const others = memberCount(clanId) - 1;
    if (others > 0) {
      throw new Error('Сначала передайте главенство или исключите остальных членов');
    }
    return dissolveClan(clanId, userId);
  }

  db.prepare('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?').run(clanId, userId);
  return { clanId, dissolved: false, roomId: clan.room_id };
}

export function kickMember(clanId: number, leaderId: number, targetUserId: number): void {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава может исключать');
  if (leaderId === targetUserId) throw new Error('Нельзя исключить себя');
  if (!isClanMember(clanId, targetUserId)) throw new Error('Игрок не в клане');
  db.prepare('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?').run(clanId, targetUserId);
}

/** Исключить из клана и запретить повторные заявки. */
export function blacklistMember(clanId: number, leaderId: number, targetUserId: number): void {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава может добавлять в чёрный список');
  if (leaderId === targetUserId) throw new Error('Нельзя добавить себя в чёрный список');
  if (!isClanMember(clanId, targetUserId)) throw new Error('Игрок не в клане');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?').run(clanId, targetUserId);
    db.prepare(
      `INSERT OR IGNORE INTO clan_application_bans (clan_id, user_id, created_by) VALUES (?, ?, ?)`
    ).run(clanId, targetUserId, leaderId);
    db.prepare(
      `UPDATE clan_applications SET status = 'rejected', decided_at = datetime('now')
       WHERE clan_id = ? AND user_id = ? AND status = 'pending'`
    ).run(clanId, targetUserId);
  });
  tx();
}

export function removeFromBlacklist(clanId: number, leaderId: number, targetUserId: number): void {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава может менять чёрный список');
  const result = db
    .prepare('DELETE FROM clan_application_bans WHERE clan_id = ? AND user_id = ?')
    .run(clanId, targetUserId);
  if (result.changes === 0) throw new Error('Игрок не в чёрном списке');
}

export function transferLeadership(clanId: number, leaderId: number, newLeaderId: number): void {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава может передать главенство');
  if (!isClanMember(clanId, newLeaderId)) throw new Error('Игрок не в клане');
  if (leaderId === newLeaderId) return;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE clan_members SET role = 'member' WHERE clan_id = ? AND user_id = ?`).run(
      clanId,
      leaderId
    );
    db.prepare(`UPDATE clan_members SET role = 'leader' WHERE clan_id = ? AND user_id = ?`).run(
      clanId,
      newLeaderId
    );
    db.prepare('UPDATE clans SET leader_id = ? WHERE id = ?').run(newLeaderId, clanId);
  });
  tx();
}

export function dissolveClan(
  clanId: number,
  leaderId: number
): { clanId: number; dissolved: boolean; roomId: number | null } {
  if (!isClanLeader(clanId, leaderId)) throw new Error('Только глава может распустить клан');
  const clan = getClanById(clanId);
  if (!clan) throw new Error('Клан не найден');
  const roomId = clan.room_id;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM clan_news WHERE clan_id = ?').run(clanId);
    db.prepare('DELETE FROM clan_application_bans WHERE clan_id = ?').run(clanId);
    db.prepare('DELETE FROM clan_applications WHERE clan_id = ?').run(clanId);
    db.prepare('DELETE FROM clan_members WHERE clan_id = ?').run(clanId);
    db.prepare('DELETE FROM clans WHERE id = ?').run(clanId);
  });
  tx();
  return { clanId, dissolved: true, roomId };
}

export function listClanNews(clanId: number, userId: number): ClanNewsItem[] {
  if (!isClanMember(clanId, userId)) throw new Error('Новости доступны только членам клана');
  const rows = db
    .prepare(
      `SELECT id, clan_id, author_id, title, body, created_at
       FROM clan_news WHERE clan_id = ?
       ORDER BY created_at DESC LIMIT 50`
    )
    .all(clanId) as {
    id: number;
    clan_id: number;
    author_id: number;
    title: string;
    body: string;
    created_at: string;
  }[];
  return rows.map((row) => {
    const author = findUserById(row.author_id);
    return {
      id: row.id,
      clanId: row.clan_id,
      authorId: row.author_id,
      authorName: author?.username || author?.display_name || '?',
      title: row.title,
      body: row.body,
      createdAt: iso(row.created_at),
    };
  });
}

export function createClanNews(
  clanId: number,
  authorId: number,
  input: { title: string; body: string }
): ClanNewsItem {
  if (!isClanLeader(clanId, authorId)) throw new Error('Новости публикует глава клана');
  const title = String(input.title || '')
    .trim()
    .slice(0, CLAN_NEWS_TITLE_MAX);
  const body = String(input.body || '')
    .trim()
    .slice(0, CLAN_NEWS_BODY_MAX);
  if (!title) throw new Error('Укажите заголовок');
  if (!body) throw new Error('Укажите текст');

  const result = db
    .prepare(`INSERT INTO clan_news (clan_id, author_id, title, body) VALUES (?, ?, ?, ?)`)
    .run(clanId, authorId, title, body);
  const id = Number(result.lastInsertRowid);
  const author = findUserById(authorId);
  return {
    id,
    clanId,
    authorId,
    authorName: author?.username || author?.display_name || '?',
    title,
    body,
    createdAt: new Date().toISOString(),
  };
}

export function deleteClanNews(clanId: number, newsId: number, userId: number): void {
  if (!isClanLeader(clanId, userId)) throw new Error('Удалять новости может глава клана');
  const result = db
    .prepare('DELETE FROM clan_news WHERE id = ? AND clan_id = ?')
    .run(newsId, clanId);
  if (result.changes === 0) throw new Error('Новость не найдена');
}
