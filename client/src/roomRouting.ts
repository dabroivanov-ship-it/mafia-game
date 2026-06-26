export type RoomScreen = 'game' | 'members';

export function roomGamePath(roomId: number): string {
  return `/room/${roomId}`;
}

export function roomMembersPath(roomId: number): string {
  return `/room/${roomId}/who`;
}

export function parseRoomPath(path: string): { roomId: number; screen: RoomScreen } | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  const match = normalized.match(/^\/room\/(\d+)(\/who)?$/);
  if (!match) return null;
  const roomId = Number(match[1]);
  if (!Number.isFinite(roomId) || roomId <= 0) return null;
  return { roomId, screen: match[2] ? 'members' : 'game' };
}

export function readInitialRoomScreen(): RoomScreen {
  if (typeof window === 'undefined') return 'game';
  const parsed = parseRoomPath(window.location.pathname);
  return parsed?.screen ?? 'game';
}
