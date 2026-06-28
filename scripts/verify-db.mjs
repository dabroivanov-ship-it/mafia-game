#!/usr/bin/env node
/**
 * Verify SQLite schema after server build.
 * Run from repo root: node scripts/verify-db.mjs
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'server', 'dist');

async function load(modulePath) {
  return import(pathToFileURL(modulePath).href);
}

const dbModule = await load(path.join(dist, 'auth', 'db.js'));
await load(path.join(dist, 'history', 'store.js'));
await load(path.join(dist, 'news', 'store.js'));
await load(path.join(dist, 'news', 'polls.js'));
await load(path.join(dist, 'messages', 'store.js'));
await load(path.join(dist, 'social', 'store.js'));
await load(path.join(dist, 'rooms', 'store.js'));
await load(path.join(dist, 'settings', 'store.js'));

const db = dbModule.default;

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((row) => row.name);

const requiredTables = [
  'users',
  'rooms_config',
  'app_settings',
  'room_chat_log',
  'room_game_log',
  'news_posts',
  'private_messages',
  'user_friends',
  'reputation_votes',
];

const missingTables = requiredTables.filter((name) => !tables.includes(name));
if (missingTables.length > 0) {
  console.error('ERROR: missing tables:', missingTables.join(', '));
  process.exit(1);
}

const userCols = db
  .prepare('PRAGMA table_info(users)')
  .all()
  .map((row) => row.name);

const requiredUserCols = [
  'username',
  'email',
  'password_hash',
  'display_name',
  'role',
  'is_banned',
  'ban_reason',
  'banned_until',
  'chat_limit',
  'last_ip',
  'last_user_agent',
  'theme',
  'games_played',
  'reputation',
];

const missingUserCols = requiredUserCols.filter((name) => !userCols.includes(name));
if (missingUserCols.length > 0) {
  console.error('ERROR: missing users columns:', missingUserCols.join(', '));
  process.exit(1);
}

const roomsConfigCols = db
  .prepare('PRAGMA table_info(rooms_config)')
  .all()
  .map((row) => row.name);

if (!roomsConfigCols.includes('kind')) {
  console.error('ERROR: missing rooms_config column: kind');
  process.exit(1);
}

console.log('DB schema OK');
console.log('  tables:', requiredTables.join(', '));
console.log('  path:', process.env.DB_PATH || '(default server/data/mafia.db)');
