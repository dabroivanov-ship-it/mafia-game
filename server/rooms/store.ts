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
  if (!cols.some((c) => c.name === 'sort_order')) {
    db.exec(`ALTER TABLE rooms_config ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    backfillSortOrder();
  }
}

function backfillSortOrder(): void {
  for (const kind of ['game', 'chat'] as RoomKind[]) {
    const rows = db
      .prepare('SELECT room_id FROM rooms_config WHERE kind = ? ORDER BY room_id ASC')
      .all(kind) as { room_id: number }[];
    const update = db.prepare('UPDATE rooms_config SET sort_order = ? WHERE room_id = ?');
    rows.forEach((row, index) => update.run(index + 1, row.room_id));
  }
}

ensureRoomsConfigSchema();

export interface RoomConfig {
  roomId: number;
  name: string;
  kind: RoomKind;
  sortOrder: number;
}

export function loadRoomConfigs(): Map<number, RoomConfig> {
  const rows = db.prepare('SELECT room_id, name, kind, sort_order FROM rooms_config').all() as {
    room_id: number;
    name: string;
    kind: string | null;
    sort_order: number | null;
  }[];
  const map = new Map<number, RoomConfig>();
  for (const row of rows) {
    map.set(row.room_id, {
      roomId: row.room_id,
      name: row.name,
      kind: row.kind === 'chat' ? 'chat' : 'game',
      sortOrder: row.sort_order ?? row.room_id,
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

export function getRoomSortOrders(): Map<number, number> {
  const configs = loadRoomConfigs();
  const map = new Map<number, number>();
  for (const [id, config] of configs) {
    map.set(id, config.sortOrder);
  }
  return map;
}

function getNextSortOrder(kind: RoomKind): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM rooms_config WHERE kind = ?')
    .get(kind) as { next: number };
  return row.next;
}

export function saveRoomConfig(
  roomId: number,
  name: string,
  kind: RoomKind,
  sortOrder?: number
): void {
  ensureRoomsConfigSchema();
  const existing = loadRoomConfigs().get(roomId);
  const order = sortOrder ?? existing?.sortOrder ?? getNextSortOrder(kind);
  db.prepare(
    `INSERT INTO rooms_config (room_id, name, kind, sort_order) VALUES (?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET
       name = excluded.name,
       kind = excluded.kind,
       sort_order = excluded.sort_order`
  ).run(roomId, name, kind, order);
}

export function saveRoomName(roomId: number, name: string, kind: RoomKind = 'game'): void {
  saveRoomConfig(roomId, name, kind);
}

export function reorderRooms(kind: RoomKind, roomIds: number[]): void {
  ensureRoomsConfigSchema();
  const stmt = db.prepare(
    'UPDATE rooms_config SET sort_order = ? WHERE room_id = ? AND kind = ?'
  );
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((roomId, index) => {
      stmt.run(index + 1, roomId, kind);
    });
  });
  tx(roomIds);
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
