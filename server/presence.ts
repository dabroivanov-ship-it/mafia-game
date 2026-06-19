import { getUserLastSeen, touchUserLastSeen } from './auth/db.js';

const activeConnections = new Map<number, number>();

export function markUserConnected(userId: number): void {
  activeConnections.set(userId, (activeConnections.get(userId) || 0) + 1);
  touchUserLastSeen(userId);
}

export function markUserDisconnected(userId: number): void {
  const next = (activeConnections.get(userId) || 1) - 1;
  if (next <= 0) {
    activeConnections.delete(userId);
  } else {
    activeConnections.set(userId, next);
  }
  touchUserLastSeen(userId);
}

export function isUserOnline(userId: number): boolean {
  return (activeConnections.get(userId) || 0) > 0;
}

export function getOnlineUserCount(): number {
  return activeConnections.size;
}

export function getUserPresence(userId: number): { isOnline: boolean; lastSeenAt: string | null } {
  return {
    isOnline: isUserOnline(userId),
    lastSeenAt: getUserLastSeen(userId),
  };
}
