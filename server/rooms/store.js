import db from '../auth/db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms_config (
    room_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
`);

export function loadRoomNames() {
  const rows = db.prepare('SELECT room_id, name FROM rooms_config').all();
  const map = new Map();
  for (const row of rows) {
    map.set(row.room_id, row.name);
  }
  return map;
}

export function saveRoomName(roomId, name) {
  db.prepare(
    `INSERT INTO rooms_config (room_id, name) VALUES (?, ?)
     ON CONFLICT(room_id) DO UPDATE SET name = excluded.name`
  ).run(roomId, name);
}

export function deleteRoomName(roomId) {
  db.prepare('DELETE FROM rooms_config WHERE room_id = ?').run(roomId);
}
