import { findUserById, getUserLastSeen, isUserBanned, touchUserLastSeen, type UserSearchHit } from './auth/db.js';

const activeConnections = new Map<number, number>();
const userSections = new Map<number, string>();

const ALLOWED_SECTIONS = new Set([
  'lobby',
  'news',
  'cabinet',
  'info',
  'admin',
  'online',
  'profile',
  'room',
]);

const SECTION_LABELS: Record<string, string> = {
  lobby: 'Комнаты',
  news: 'Новости',
  cabinet: 'Кабинет',
  info: 'Информация',
  admin: 'Админка',
  online: 'В сети',
  profile: 'Профиль',
  room: 'В комнате',
};

let roomNamesForUser: (userId: number) => string[] = () => [];

export function setOnlineRoomResolver(fn: (userId: number) => string[]): void {
  roomNamesForUser = fn;
}

export function setUserSection(userId: number, section: unknown): void {
  if (typeof section === 'string' && ALLOWED_SECTIONS.has(section)) {
    userSections.set(userId, section);
    return;
  }
  userSections.set(userId, 'lobby');
}

export function clearUserSection(userId: number): void {
  userSections.delete(userId);
}

export function getUserLocationLabel(userId: number): string {
  const roomNames = roomNamesForUser(userId);
  if (roomNames.length > 0) return roomNames.join(', ');
  const section = userSections.get(userId) || 'lobby';
  return SECTION_LABELS[section] || 'На сайте';
}

export function markUserConnected(userId: number): void {
  activeConnections.set(userId, (activeConnections.get(userId) || 0) + 1);
  touchUserLastSeen(userId);
}

export function markUserDisconnected(userId: number): void {
  const next = (activeConnections.get(userId) || 1) - 1;
  if (next <= 0) {
    activeConnections.delete(userId);
    userSections.delete(userId);
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

export interface OnlineUserHit extends UserSearchHit {
  location: string;
}

export function listOnlineUsers(): OnlineUserHit[] {
  const users: OnlineUserHit[] = [];
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
      mmr: user.mmr ?? 1000,
      isAdmin: user.role === 'admin',
      isModerator: user.role === 'moderator',
      location: getUserLocationLabel(user.id),
    });
  }
  return users.sort((a, b) => a.username.localeCompare(b.username, 'ru'));
}

export function getUserPresence(userId: number): { isOnline: boolean; lastSeenAt: string | null } {
  return {
    isOnline: isUserOnline(userId),
    lastSeenAt: getUserLastSeen(userId),
  };
}
