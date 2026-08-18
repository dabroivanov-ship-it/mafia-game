import type { UserRole } from './types';

export type AdminPermission =
  | 'view_users'
  | 'edit_users'
  | 'ban_users'
  | 'delete_users'
  | 'set_roles'
  | 'set_reputation'
  | 'view_banlist'
  | 'manage_silence'
  | 'view_violations'
  | 'clear_violations'
  | 'view_stats'
  | 'manage_news'
  | 'view_rooms'
  | 'manage_game_rooms'
  | 'manage_chat_rooms'
  | 'manage_phrases'
  | 'manage_theme'
  | 'manage_telegram'
  | 'manage_metrika'
  | 'manage_deepseek'
  | 'manage_backups';

export function hasAdminPermission(
  permissions: AdminPermission[],
  permission: AdminPermission
): boolean {
  return permissions.includes(permission);
}

export function adminPanelRoleLabel(role: UserRole | string): string {
  if (role === 'admin') return 'Администратор';
  if (role === 'moderator') return 'Модератор';
  if (role === 'watcher') return 'Смотрящий';
  return 'Пользователь';
}

export const SYSTEM_VIEW_PERMISSIONS: Record<string, AdminPermission> = {
  users: 'view_users',
  banlist: 'view_banlist',
  violations: 'view_violations',
  stats: 'view_stats',
  news: 'manage_news',
  announcement: 'manage_news',
  backup: 'manage_backups',
  theme: 'manage_theme',
  telegram: 'manage_telegram',
  metrika: 'manage_metrika',
  deepseek: 'manage_deepseek',
  phrases: 'manage_phrases',
  'game-rooms': 'view_rooms',
  'chat-rooms': 'view_rooms',
};

export function canOpenSystemView(
  permissions: AdminPermission[],
  view: string
): boolean {
  const perm = SYSTEM_VIEW_PERMISSIONS[view];
  if (!perm) return false;
  return permissions.includes(perm);
}

export function userRoleBadge(user: {
  isAdmin?: boolean;
  isModerator?: boolean;
  isWatcher?: boolean;
  role?: string;
}): string | null {
  if (user.isAdmin || user.role === 'admin') return 'admin';
  if (user.isModerator || user.role === 'moderator') return 'mod';
  if (user.isWatcher || user.role === 'watcher') return 'watcher';
  return null;
}
