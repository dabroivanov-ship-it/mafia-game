import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { AuthProvider, PublicUser, User, StaffMember, UserGender } from '../types/index.js';
import { normalizeGender } from './gender.js';
import {
  defaultAvatarForGender,
  isCustomAvatar,
  resolveUserAvatar,
  shouldUseGenderDefaultAvatar,
} from './defaultAvatars.js';
import { getDataDir, getDbPath, getUploadsDir } from '../paths.js';

const dataDir = getDataDir();
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const uploadsDir = getUploadsDir();
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = getDbPath();
export const db: Database.Database = new Database(dbPath);
console.log(`📦 SQLite: ${dbPath}`);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    telegram_id TEXT UNIQUE,
    telegram_username TEXT DEFAULT NULL,
    display_name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT DEFAULT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT DEFAULT NULL,
    banned_until TEXT DEFAULT NULL,
    total_score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function migrateColumns(): void {
  const cols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
  const add = (sql: string) => {
    try {
      db.exec(sql);
    } catch {
      /* column exists */
    }
  };
  if (!cols.includes('city')) add('ALTER TABLE users ADD COLUMN city TEXT NOT NULL DEFAULT ""');
  if (!cols.includes('bio')) add('ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ""');
  if (!cols.includes('avatar')) add('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL');
  if (!cols.includes('role')) add('ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT "user"');
  if (!cols.includes('is_banned')) add('ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('ban_reason')) add('ALTER TABLE users ADD COLUMN ban_reason TEXT DEFAULT NULL');
  if (!cols.includes('banned_until')) add('ALTER TABLE users ADD COLUMN banned_until TEXT DEFAULT NULL');
  if (!cols.includes('chat_limit')) add('ALTER TABLE users ADD COLUMN chat_limit INTEGER NOT NULL DEFAULT 15');
  if (!cols.includes('last_ip')) add('ALTER TABLE users ADD COLUMN last_ip TEXT DEFAULT NULL');
  if (!cols.includes('last_user_agent')) add('ALTER TABLE users ADD COLUMN last_user_agent TEXT DEFAULT NULL');
  if (!cols.includes('theme')) add('ALTER TABLE users ADD COLUMN theme TEXT DEFAULT NULL');
  if (!cols.includes('telegram_id')) add('ALTER TABLE users ADD COLUMN telegram_id TEXT DEFAULT NULL');
  if (!cols.includes('telegram_username')) add('ALTER TABLE users ADD COLUMN telegram_username TEXT DEFAULT NULL');
  if (!cols.includes('vk_id')) add('ALTER TABLE users ADD COLUMN vk_id TEXT DEFAULT NULL');
  if (!cols.includes('vk_username')) add('ALTER TABLE users ADD COLUMN vk_username TEXT DEFAULT NULL');
  if (!cols.includes('last_seen_at')) add('ALTER TABLE users ADD COLUMN last_seen_at TEXT DEFAULT NULL');
  if (!cols.includes('online_seconds')) add('ALTER TABLE users ADD COLUMN online_seconds INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('games_played')) add('ALTER TABLE users ADD COLUMN games_played INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('reputation')) add('ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('quiz_correct_answers')) {
    add('ALTER TABLE users ADD COLUMN quiz_correct_answers INTEGER NOT NULL DEFAULT 0');
  }
  if (!cols.includes('gender')) add('ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT ""');
  if (!cols.includes('invited_by_user_id')) {
    add('ALTER TABLE users ADD COLUMN invited_by_user_id INTEGER DEFAULT NULL');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_vk_id ON users(vk_id)');
}

function backfillGenderDefaultAvatars(): void {
  const rows = db
    .prepare(
      `SELECT id, gender FROM users
       WHERE gender IN ('male', 'female')
         AND (avatar IS NULL OR avatar = '')`
    )
    .all() as { id: number; gender: string }[];
  if (!rows.length) return;
  const update = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
  for (const row of rows) {
    const avatar = defaultAvatarForGender(row.gender);
    if (avatar) update.run(avatar, row.id);
  }
}

migrateColumns();
backfillGenderDefaultAvatars();

function syncAdminRoles(): void {
  const admins = (process.env.ADMIN_USERNAMES || 'admin').split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of admins) {
    db.prepare('UPDATE users SET role = ? WHERE username = ? COLLATE NOCASE').run('admin', name);
  }
}
syncAdminRoles();

export function isAdminReservedUsername(username: string): boolean {
  const admins = (process.env.ADMIN_USERNAMES || 'admin')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(username.trim().toLowerCase());
}

export type AssignableRole = 'user' | 'watcher' | 'moderator';

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'admin';
}

export function isModerator(user: User | null | undefined): boolean {
  return user?.role === 'moderator';
}

export function isWatcher(user: User | null | undefined): boolean {
  return user?.role === 'watcher';
}

export function isStaff(user: User | null | undefined): boolean {
  return isAdmin(user) || isModerator(user);
}

export function canModerateSilence(user: User | null | undefined): boolean {
  return isAdmin(user) || isModerator(user) || isWatcher(user);
}

export function canSilenceTarget(
  actor: User | null | undefined,
  target: User | null | undefined
): boolean {
  if (!actor || !target || actor.id === target.id) return false;
  if (!canModerateSilence(actor)) return false;
  if (isAdmin(target)) return false;
  if (isModerator(target) || isWatcher(target)) return isAdmin(actor);
  return true;
}

export function canBanTarget(
  actor: User | null | undefined,
  target: User | null | undefined
): boolean {
  if (!actor || !target) return false;
  if (isAdmin(target)) return false;
  if (isModerator(target) || isWatcher(target)) return isAdmin(actor);
  if (isAdmin(actor)) return true;
  if (isModerator(actor)) return !isStaff(target);
  return false;
}

export function isUserBanned(user: User | null | undefined): boolean {
  if (!user?.is_banned) return false;
  if (user.banned_until) {
    const until = new Date(user.banned_until);
    if (until < new Date()) {
      clearBan(user.id);
      return false;
    }
  }
  return true;
}

export const CHAT_LIMIT_OPTIONS = [15, 30, 50, 100] as const;

export function normalizeChatLimit(value: unknown): number {
  const n = Number(value) || 15;
  if (!(CHAT_LIMIT_OPTIONS as readonly number[]).includes(n)) return 15;
  return n;
}

export function isTelegramPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && /@telegram\.local$/i.test(email.trim());
}

export function isVkPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && /@vk\.local$/i.test(email.trim());
}

export function isSocialPlaceholderEmail(email: string | null | undefined): boolean {
  return isTelegramPlaceholderEmail(email) || isVkPlaceholderEmail(email);
}

export function userNeedsEmailLink(user: User | null | undefined): boolean {
  if (!user || !isSocialPlaceholderEmail(user.email)) return false;
  return !!(user.telegram_id || user.vk_id);
}

export function userAuthProviders(user: User | null | undefined): AuthProvider[] {
  const providers: AuthProvider[] = [];
  if (user?.telegram_id) providers.push('telegram');
  if (user?.vk_id) providers.push('vk');
  if (!providers.length) providers.push('email');
  return providers;
}

export function publicUser(user: User | null | undefined): PublicUser | null {
  if (!user) return null;
  const placeholderEmail = isSocialPlaceholderEmail(user.email);
  return {
    id: user.id,
    username: user.username,
    email: placeholderEmail ? undefined : user.email,
    displayName: user.display_name,
    gender: normalizeGender(user.gender),
    city: user.city || '',
    bio: user.bio || '',
    avatar: resolveUserAvatar(user.avatar, user.gender),
    role: user.role || 'user',
    isAdmin: user.role === 'admin',
    isModerator: user.role === 'moderator',
    isWatcher: user.role === 'watcher',
    isStaff: isStaff(user),
    canAccessAdminPanel:
      user.role === 'admin' || user.role === 'moderator' || user.role === 'watcher',
    totalScore: user.total_score,
    mmr: user.mmr ?? 1000,
    gamesPlayed: user.games_played ?? 0,
    reputation: user.reputation ?? 0,
    createdAt: user.created_at,
    onlineSeconds: Math.max(0, Math.floor(Number(user.online_seconds) || 0)),
    isBanned: isUserBanned(user),
    banReason: user.ban_reason || null,
    bannedUntil: user.banned_until || null,
    chatLimit: normalizeChatLimit(user.chat_limit),
    theme: user.theme && user.theme.trim() ? user.theme.trim() : null,
    telegramUsername:
      user.telegram_username && user.telegram_username.trim() ? user.telegram_username.trim() : null,
    vkUsername: user.vk_username && user.vk_username.trim() ? user.vk_username.trim() : null,
    needsEmailLink: userNeedsEmailLink(user),
    authProviders: userAuthProviders(user),
  };
}

export function findUserByUsername(username: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as User | undefined;
}

export function findUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as User | undefined;
}

export function findUserByTelegramId(telegramId: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as User | undefined;
}

export function findUserByVkId(vkId: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE vk_id = ?').get(vkId) as User | undefined;
}

export function findUserById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function findPrimaryAdmin(): User | undefined {
  const names = (process.env.ADMIN_USERNAMES || 'admin')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const name of names) {
    const user = findUserByUsername(name);
    if (user && user.role === 'admin' && !isUserBanned(user)) return user;
  }
  return db
    .prepare(
      `SELECT * FROM users WHERE role = 'admin' AND is_banned = 0 ORDER BY id ASC LIMIT 1`
    )
    .get() as User | undefined;
}

export function resolveInvitedByUserId(raw: unknown): { ok: true; id: number | null } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, id: null };
  const value = String(raw).trim();
  if (!value) return { ok: true, id: null };
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Некорректный id пригласившего' };
  }
  const inviter = findUserById(id);
  if (!inviter || isUserBanned(inviter)) {
    return { ok: false, error: 'Пригласивший не найден' };
  }
  return { ok: true, id };
}

export function findUserPublic(id: number): PublicUser | null {
  const user = findUserById(id);
  return user ? publicUser(user) : null;
}

export function createUser({
  username,
  email,
  passwordHash,
  displayName,
  gender,
  telegramId,
  telegramUsername,
  vkId,
  vkUsername,
  invitedByUserId,
}: {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  gender?: UserGender;
  telegramId?: string | null;
  telegramUsername?: string | null;
  vkId?: string | null;
  vkUsername?: string | null;
  invitedByUserId?: number | null;
}): User | undefined {
  const role = 'user';
  const avatar = defaultAvatarForGender(gender);

  const result = db
    .prepare(
      `INSERT INTO users
      (username, email, password_hash, display_name, gender, role, avatar, telegram_id, telegram_username, vk_id, vk_username, invited_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      username,
      email,
      passwordHash,
      displayName,
      normalizeGender(gender),
      role,
      avatar,
      telegramId || null,
      telegramUsername || null,
      vkId || null,
      vkUsername || null,
      invitedByUserId || null
    );
  return findUserById(Number(result.lastInsertRowid));
}

const PLACEHOLDER_DISPLAY_NAME = /^Игрок \d+$/;

export function fillEmptyProfileFields(
  userId: number,
  input: { displayName?: string | null; gender?: UserGender | null }
): User | undefined {
  const user = findUserById(userId);
  if (!user) return undefined;

  const incomingName = input.displayName?.trim().slice(0, 30) || '';
  const incomingGender = normalizeGender(input.gender);
  const currentName = (user.display_name || '').trim();
  const nameIsPlaceholder = !currentName || PLACEHOLDER_DISPLAY_NAME.test(currentName);
  const nextName = nameIsPlaceholder && incomingName ? incomingName : user.display_name;
  const nextGender = !normalizeGender(user.gender) && incomingGender ? incomingGender : user.gender;
  const nextAvatar =
    shouldUseGenderDefaultAvatar(user.avatar) && incomingGender
      ? defaultAvatarForGender(incomingGender)
      : user.avatar;

  if (
    nextName === user.display_name &&
    nextGender === user.gender &&
    nextAvatar === user.avatar
  ) {
    return user;
  }

  db.prepare('UPDATE users SET display_name = ?, gender = ?, avatar = ? WHERE id = ?').run(
    nextName,
    nextGender,
    nextAvatar,
    userId
  );
  return findUserById(userId);
}

export function updateUserProfile(
  userId: number,
  {
    displayName,
    gender,
    city,
    bio,
    chatLimit,
    theme,
  }: {
    displayName: string;
    gender?: UserGender;
    city?: string;
    bio?: string;
    chatLimit?: number;
    theme?: string | null;
  }
): PublicUser | null {
  const existing = findUserById(userId);
  if (!existing) return null;

  const fields = ['display_name = ?', 'city = ?', 'bio = ?'];
  const values: (string | number | null)[] = [displayName, city || '', bio || ''];
  let nextGender = normalizeGender(existing.gender);

  if (gender !== undefined) {
    nextGender = normalizeGender(gender);
    fields.push('gender = ?');
    values.push(nextGender);
    if (shouldUseGenderDefaultAvatar(existing.avatar)) {
      fields.push('avatar = ?');
      values.push(defaultAvatarForGender(nextGender));
    }
  }
  if (chatLimit != null) {
    fields.push('chat_limit = ?');
    values.push(normalizeChatLimit(chatLimit));
  }
  if (theme !== undefined) {
    fields.push('theme = ?');
    values.push(theme && theme.trim() ? theme.trim() : null);
  }
  values.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findUserPublic(userId);
}

export function updateUserUsername(userId: number, username: string): PublicUser | null {
  const u = username.trim();
  if (u.length < 3 || u.length > 20) {
    throw new Error('Логин: от 3 до 20 символов');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    throw new Error('Логин: только буквы, цифры и _');
  }
  if (isAdminReservedUsername(u)) {
    throw new Error('Этот логин зарезервирован');
  }
  const existing = findUserByUsername(u);
  if (existing && existing.id !== userId) {
    throw new Error('Логин уже занят');
  }
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(u, userId);
  return findUserPublic(userId);
}

export function linkTelegramUserEmail(
  userId: number,
  email: string,
  passwordHash: string
): PublicUser | null {
  const user = findUserById(userId);
  if (!user) return null;
  if (!user.telegram_id && !user.vk_id) {
    throw new Error('Привязка email доступна только для входа через соцсеть');
  }
  if (!userNeedsEmailLink(user)) {
    throw new Error('Email уже привязан');
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Некорректный email');
  }
  if (isSocialPlaceholderEmail(normalizedEmail)) {
    throw new Error('Некорректный email');
  }
  const existing = findUserByEmail(normalizedEmail);
  if (existing && existing.id !== userId) {
    throw new Error('Email уже зарегистрирован');
  }
  db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?').run(
    normalizedEmail,
    passwordHash,
    userId
  );
  return findUserPublic(userId);
}

export function updateUserPasswordHash(userId: number, passwordHash: string): PublicUser | null {
  const user = findUserById(userId);
  if (!user) return null;
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  return findUserPublic(userId);
}

export function deleteAvatarFile(avatarPath: string | null | undefined): void {
  if (!isCustomAvatar(avatarPath)) return;
  const filePath = path.join(uploadsDir, path.basename(avatarPath!));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function removeUserAvatar(userId: number): PublicUser | null {
  const user = findUserById(userId);
  if (!user) return null;
  if (isCustomAvatar(user.avatar)) deleteAvatarFile(user.avatar);
  const avatar = defaultAvatarForGender(user.gender);
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, userId);
  return findUserPublic(userId);
}

export function updateUserAvatar(
  userId: number,
  avatarPath: string
): { oldAvatar: string | null | undefined; user: PublicUser | null } {
  const old = findUserById(userId);
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, userId);
  return { oldAvatar: old?.avatar, user: findUserPublic(userId) };
}

export function updateUserScore(userId: number, delta: number): void {
  db.prepare('UPDATE users SET total_score = total_score + ? WHERE id = ?').run(delta, userId);
}

export interface UserSearchHit {
  id: number;
  username: string;
  displayName: string;
  city: string;
  avatar: string | null;
  totalScore: number;
  mmr: number;
  isAdmin: boolean;
  isModerator: boolean;
}

function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[%_]/g, '').slice(0, 50);
}

export function searchPublicUsers(query: string, limit = 25): UserSearchHit[] {
  const q = sanitizeSearchQuery(query);
  if (q.length < 2) return [];

  const term = `%${q}%`;
  const prefix = `${q}%`;
  const rows = db
    .prepare(
      `SELECT id, username, display_name, city, gender, avatar, role, total_score, mmr
       FROM users
       WHERE username LIKE ? COLLATE NOCASE
          OR display_name LIKE ? COLLATE NOCASE
          OR city LIKE ? COLLATE NOCASE
       ORDER BY
         CASE
           WHEN username LIKE ? COLLATE NOCASE THEN 0
           WHEN display_name LIKE ? COLLATE NOCASE THEN 1
           ELSE 2
         END,
         display_name COLLATE NOCASE
       LIMIT ?`
    )
    .all(term, term, term, prefix, prefix, limit) as Pick<
    User,
    'id' | 'username' | 'display_name' | 'city' | 'gender' | 'avatar' | 'role' | 'total_score' | 'mmr'
  >[];

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    city: row.city || '',
    avatar: resolveUserAvatar(row.avatar, row.gender),
    totalScore: row.total_score,
    mmr: row.mmr ?? 1000,
    isAdmin: row.role === 'admin',
    isModerator: row.role === 'moderator',
  }));
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  displayName: string;
  city: string;
  avatar: string | null;
  totalScore: number;
  mmr: number;
  gamesPlayed: number;
  reputation: number;
  isAdmin: boolean;
  isModerator: boolean;
}

export function listLeaderboard(limit = 100, offset = 0): LeaderboardEntry[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 200);
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0);

  const rows = db
    .prepare(
      `SELECT id, username, display_name, city, gender, avatar, role, total_score, mmr, games_played, reputation
       FROM users
       WHERE is_banned = 0
       ORDER BY mmr DESC, games_played DESC, id ASC
       LIMIT ? OFFSET ?`
    )
    .all(safeLimit, safeOffset) as Pick<
    User,
    | 'id'
    | 'username'
    | 'display_name'
    | 'city'
    | 'gender'
    | 'avatar'
    | 'role'
    | 'total_score'
    | 'mmr'
    | 'games_played'
    | 'reputation'
  >[];

  return rows.map((row, index) => ({
    rank: safeOffset + index + 1,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    city: row.city || '',
    avatar: resolveUserAvatar(row.avatar, row.gender),
    totalScore: row.total_score,
    mmr: row.mmr ?? 1000,
    gamesPlayed: row.games_played ?? 0,
    reputation: row.reputation ?? 0,
    isAdmin: row.role === 'admin',
    isModerator: row.role === 'moderator',
  }));
}

export function countLeaderboard(): number {
  const row = db
    .prepare('SELECT COUNT(*) as c FROM users WHERE is_banned = 0')
    .get() as { c: number };
  return row.c;
}

export function listAllUsers(): PublicUser[] {
  const rows = db
    .prepare(
      `SELECT id, username, email, display_name, gender, city, bio, avatar, role, is_banned, ban_reason, banned_until, total_score, created_at, telegram_id, vk_id, telegram_username, vk_username
       FROM users ORDER BY created_at DESC`
    )
    .all() as User[];
  return rows.map((row) => publicUser(row)!);
}

export function findPrimaryAdminId(): number | null {
  const row = db
    .prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`)
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function listStaffUsers(): StaffMember[] {
  const rows = db
    .prepare(
      `SELECT id, username, display_name, city, gender, avatar, role
       FROM users WHERE role IN ('admin', 'moderator', 'watcher')
       ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, display_name COLLATE NOCASE`
    )
    .all() as Pick<User, 'id' | 'username' | 'display_name' | 'city' | 'gender' | 'avatar' | 'role'>[];
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    city: row.city || '',
    avatar: resolveUserAvatar(row.avatar, row.gender),
    role: row.role as 'admin' | 'moderator' | 'watcher',
  }));
}

export function updateUserConnectionInfo(
  userId: number,
  ip: string | null,
  userAgent: string | null
): void {
  db.prepare('UPDATE users SET last_ip = ?, last_user_agent = ? WHERE id = ?').run(
    ip || null,
    userAgent ? userAgent.slice(0, 500) : null,
    userId
  );
}

export function touchUserLastSeen(userId: number): void {
  db.prepare(`UPDATE users SET last_seen_at = datetime('now') WHERE id = ?`).run(userId);
}

export function getUserLastSeen(userId: number): string | null {
  const row = db.prepare('SELECT last_seen_at FROM users WHERE id = ?').get(userId) as
    | { last_seen_at: string | null }
    | undefined;
  const raw = row?.last_seen_at?.trim();
  if (!raw) return null;
  return raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
}

export function getStoredOnlineSeconds(userId: number): number {
  const row = db.prepare('SELECT online_seconds FROM users WHERE id = ?').get(userId) as
    | { online_seconds: number | null }
    | undefined;
  return Math.max(0, Math.floor(Number(row?.online_seconds) || 0));
}

export function addUserOnlineSeconds(userId: number, seconds: number): void {
  const delta = Math.floor(seconds);
  if (delta <= 0) return;
  db.prepare('UPDATE users SET online_seconds = online_seconds + ? WHERE id = ?').run(delta, userId);
}

export function banUser(userId: number, reason: string | undefined, until: string | null = null): PublicUser | null {
  db.prepare(
    'UPDATE users SET is_banned = 1, ban_reason = ?, banned_until = ? WHERE id = ?'
  ).run(reason || 'Нарушение правил', until, userId);
  return findUserPublic(userId);
}

export function clearBan(userId: number): PublicUser | null {
  db.prepare(
    'UPDATE users SET is_banned = 0, ban_reason = NULL, banned_until = NULL WHERE id = ?'
  ).run(userId);
  return findUserPublic(userId);
}

export function updateUserRole(userId: number, role: AssignableRole): PublicUser | null {
  const target = findUserById(userId);
  if (!target || target.role === 'admin') return null;
  if (role !== 'user' && role !== 'moderator' && role !== 'watcher') return null;
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  return findUserPublic(userId);
}

export function deleteUser(userId: number): void {
  const user = findUserById(userId);
  if (user?.avatar) deleteAvatarFile(user.avatar);
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(userId, 'admin');
}

export default db;
