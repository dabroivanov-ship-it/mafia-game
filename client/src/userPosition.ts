import type { UserRole } from './types';

export function userPositionLabel(user: {
  role?: UserRole | string;
  isAdmin?: boolean;
  isModerator?: boolean;
  isWatcher?: boolean;
}): string {
  if (user.isAdmin || user.role === 'admin') return 'Админ';
  if (user.isModerator || user.role === 'moderator') return 'Модер';
  if (user.isWatcher || user.role === 'watcher') return 'Смотрящий';
  return 'Пользователь';
}
