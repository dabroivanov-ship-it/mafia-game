import db from '../auth/db.js';
import type { RoomKind } from '../types/index.js';

function ensureRoomsConfigSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms_config (
      room_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'game'
    );
  `);

  const cols = db.prepare('PRAGMA table_info(rooms_config)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'kind')) {
    db.exec(`ALTER TABLE rooms_config ADD COLUMN kind TEXT NOT NULL DEFAULT 'game'`);
  }
}

ensureRoomsConfigSchema();

export interface RoomConfig {
  roomId: number;
  name: string;
  kind: RoomKind;
}

export function loadRoomConfigs(): Map<number, RoomConfig> {
  const rows = db.prepare('SELECT room_id, name, kind FROM rooms_config').all() as {
    room_id: number;
    name: string;
    kind: string | null;
  }[];
  const map = new Map<number, RoomConfig>();
  for (const row of rows) {
    map.set(row.room_id, {
      roomId: row.room_id,
      name: row.name,
      kind: row.kind === 'chat' ? 'chat' : 'game',
    });
  }
  return map;
}

export function loadRoomNames(): Map<number, string> {
  const configs = loadRoomConfigs();
  const map = new Map<number, string>();
  for (const [id, config] of configs) {
    map.set(id, config.name);
  }
  return map;
}

export function saveRoomConfig(roomId: number, name: string, kind: RoomKind): void {
  ensureRoomsConfigSchema();
  db.prepare(
    `INSERT INTO rooms_config (room_id, name, kind) VALUES (?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET name = excluded.name, kind = excluded.kind`
  ).run(roomId, name, kind);
}

export function saveRoomName(roomId: number, name: string, kind: RoomKind = 'game'): void {
  saveRoomConfig(roomId, name, kind);
}

export function deleteRoomConfig(roomId: number): void {
  db.prepare('DELETE FROM rooms_config WHERE room_id = ?').run(roomId);
}

export function deleteRoomName(roomId: number): void {
  deleteRoomConfig(roomId);
}

export function nextRoomId(roomsInMemory: Iterable<number>): number {
  const configs = loadRoomConfigs();
  let maxId = 0;
  for (const id of roomsInMemory) maxId = Math.max(maxId, id);
  for (const id of configs.keys()) maxId = Math.max(maxId, id);
  return maxId + 1;
}
