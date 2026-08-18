import type { User } from '../types/index.js';
import { isAdmin, isModerator, isWatcher } from '../auth/db.js';

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

const WATCHER_PERMISSIONS: AdminPermission[] = [
  'view_users',
  'view_banlist',
  'view_violations',
  'view_stats',
  'view_rooms',
  'manage_silence',
];

const MODERATOR_PERMISSIONS: AdminPermission[] = [
  ...WATCHER_PERMISSIONS,
  'edit_users',
  'ban_users',
  'manage_silence',
  'clear_violations',
  'manage_news',
  'manage_game_rooms',
  'manage_chat_rooms',
];

const ADMIN_PERMISSIONS: AdminPermission[] = [
  ...MODERATOR_PERMISSIONS,
  'delete_users',
  'set_roles',
  'set_reputation',
  'manage_phrases',
  'manage_theme',
  'manage_telegram',
  'manage_metrika',
  'manage_deepseek',
  'manage_backups',
];

export function getAdminPermissions(user: User | null | undefined): AdminPermission[] {
  if (!user) return [];
  if (isAdmin(user)) return ADMIN_PERMISSIONS;
  if (isModerator(user)) return MODERATOR_PERMISSIONS;
  if (isWatcher(user)) return WATCHER_PERMISSIONS;
  return [];
}

export function hasAdminPermission(
  user: User | null | undefined,
  permission: AdminPermission
): boolean {
  return getAdminPermissions(user).includes(permission);
}

export function canAccessAdminPanel(user: User | null | undefined): boolean {
  return getAdminPermissions(user).length > 0;
}

export function adminPanelRoleLabel(role: string): string {
  if (role === 'admin') return 'Администратор';
  if (role === 'moderator') return 'Модератор';
  if (role === 'watcher') return 'Смотрящий';
  return 'Пользователь';
}
