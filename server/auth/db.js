import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'mafia.db');
const db = new Database(dbPath);
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

function migrateColumns() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const add = (sql) => {
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
}

migrateColumns();

function syncAdminRoles() {
  const admins = (process.env.ADMIN_USERNAMES || 'admin').split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of admins) {
    db.prepare('UPDATE users SET role = ? WHERE username = ? COLLATE NOCASE').run('admin', name);
  }
}
syncAdminRoles();

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isUserBanned(user) {
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

export function publicUser(user) {
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
    totalScore: user.total_score,
    createdAt: user.created_at,
    isBanned: isUserBanned(user),
    banReason: user.ban_reason || null,
  };
}

export function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function findUserPublic(id) {
  const user = findUserById(id);
  return user ? publicUser(user) : null;
}

export function createUser({ username, email, passwordHash, displayName }) {
  const adminList = (process.env.ADMIN_USERNAMES || 'admin').split(',').map((s) => s.trim().toLowerCase());
  const role = adminList.includes(username.toLowerCase()) ? 'admin' : 'user';

  const result = db
    .prepare(
      'INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
    )
    .run(username, email, passwordHash, displayName, role);
  return findUserById(result.lastInsertRowid);
}

export function updateUserProfile(userId, { displayName, city, bio }) {
  db.prepare(
    'UPDATE users SET display_name = ?, city = ?, bio = ? WHERE id = ?'
  ).run(displayName, city || '', bio || '', userId);
  return findUserPublic(userId);
}

export function updateUserAvatar(userId, avatarPath) {
  const old = findUserById(userId);
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, userId);
  return { oldAvatar: old?.avatar, user: findUserPublic(userId) };
}

export function updateUserScore(userId, delta) {
  db.prepare('UPDATE users SET total_score = total_score + ? WHERE id = ?').run(delta, userId);
}

export function listAllUsers() {
  return db
    .prepare(
      `SELECT id, username, email, display_name, city, avatar, role, is_banned, ban_reason, banned_until, total_score, created_at
       FROM users ORDER BY created_at DESC`
    )
    .all()
    .map(publicUser);
}

export function banUser(userId, reason, until = null) {
  db.prepare(
    'UPDATE users SET is_banned = 1, ban_reason = ?, banned_until = ? WHERE id = ?'
  ).run(reason || 'Нарушение правил', until, userId);
  return findUserPublic(userId);
}

export function clearBan(userId) {
  db.prepare(
    'UPDATE users SET is_banned = 0, ban_reason = NULL, banned_until = NULL WHERE id = ?'
  ).run(userId);
  return findUserPublic(userId);
}

export function deleteUser(userId) {
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(userId, 'admin');
}

export default db;
