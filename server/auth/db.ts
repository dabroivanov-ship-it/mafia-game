import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { PublicUser, User } from '../types/index.js';
import { getDataDir, getDbPath, getUploadsDir } from '../paths.js';

const dataDir = getDataDir();
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const uploadsDir = getUploadsDir();
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = getDbPath();
const db: Database.Database = new Database(dbPath);
console.log(`📦 SQLite: ${dbPath}`);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
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
}

migrateColumns();

function syncAdminRoles(): void {
  const admins = (process.env.ADMIN_USERNAMES || 'admin').split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of admins) {
    db.prepare('UPDATE users SET role = ? WHERE username = ? COLLATE NOCASE').run('admin', name);
  }
}
syncAdminRoles();

export type AssignableRole = 'user' | 'moderator';

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'admin';
}

export function isModerator(user: User | null | undefined): boolean {
  return user?.role === 'moderator';
}

export function isStaff(user: User | null | undefined): boolean {
  return isAdmin(user) || isModerator(user);
}

export function canBanTarget(
  actor: User | null | undefined,
  target: User | null | undefined
): boolean {
  if (!isStaff(actor) || !target) return false;
  if (isAdmin(target)) return false;
  if (isModerator(target)) return isAdmin(actor);
  return true;
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

export function publicUser(user: User | null | undefined): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    city: user.city || '',
    bio: user.bio || '',
    avatar: user.avatar || null,
    role: user.role || 'user',
    isAdmin: user.role === 'admin',
    isModerator: user.role === 'moderator',
    isStaff: isStaff(user),
    totalScore: user.total_score,
    createdAt: user.created_at,
    isBanned: isUserBanned(user),
    banReason: user.ban_reason || null,
    chatLimit: normalizeChatLimit(user.chat_limit),
  };
}

export function findUserByUsername(username: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as User | undefined;
}

export function findUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as User | undefined;
}

export function findUserById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
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
}: {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
}): User | undefined {
  const adminList = (process.env.ADMIN_USERNAMES || 'admin').split(',').map((s) => s.trim().toLowerCase());
  const role = adminList.includes(username.toLowerCase()) ? 'admin' : 'user';

  const result = db
    .prepare(
      'INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
    )
    .run(username, email, passwordHash, displayName, role);
  return findUserById(Number(result.lastInsertRowid));
}

export function updateUserProfile(
  userId: number,
  {
    displayName,
    city,
    bio,
    chatLimit,
  }: {
    displayName: string;
    city?: string;
    bio?: string;
    chatLimit?: number;
  }
): PublicUser | null {
  const fields = ['display_name = ?', 'city = ?', 'bio = ?'];
  const values: (string | number)[] = [displayName, city || '', bio || ''];
  if (chatLimit != null) {
    fields.push('chat_limit = ?');
    values.push(normalizeChatLimit(chatLimit));
  }
  values.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findUserPublic(userId);
}

export function deleteAvatarFile(avatarPath: string | null | undefined): void {
  if (avatarPath?.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, path.basename(avatarPath));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export function removeUserAvatar(userId: number): PublicUser | null {
  const user = findUserById(userId);
  if (user?.avatar) deleteAvatarFile(user.avatar);
  db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(userId);
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

export function listAllUsers(): PublicUser[] {
  const rows = db
    .prepare(
      `SELECT id, username, email, display_name, city, bio, avatar, role, is_banned, ban_reason, banned_until, total_score, created_at
       FROM users ORDER BY created_at DESC`
    )
    .all() as User[];
  return rows.map((row) => publicUser(row)!);
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
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  return findUserPublic(userId);
}

export function deleteUser(userId: number): void {
  const user = findUserById(userId);
  if (user?.avatar) deleteAvatarFile(user.avatar);
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(userId, 'admin');
}

export default db;
