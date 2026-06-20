import { findUserById, getUserLastSeen, isUserBanned, touchUserLastSeen, type UserSearchHit } from './auth/db.js';

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

export function listOnlineUsers(): UserSearchHit[] {
  const users: UserSearchHit[] = [];
  for (const userId of activeConnections.keys()) {
    const user = findUserById(userId);
    if (!user || isUserBanned(user)) continue;
    users.push({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      city: user.city || '',
      avatar: user.avatar || null,
      totalScore: user.total_score,
      isAdmin: user.role === 'admin',
      isModerator: user.role === 'moderator',
    });
  }
  return users.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
}

export function getUserPresence(userId: number): { isOnline: boolean; lastSeenAt: string | null } {
  return {
    isOnline: isUserOnline(userId),
    lastSeenAt: getUserLastSeen(userId),
  };
}
