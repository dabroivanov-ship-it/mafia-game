import type { User, StaffMember, ProfileStaffMeta, PrivateMessage, NewsPost, MailConversation, RoomKind, ThemeId, ViolationLogEntry } from './types';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const token = localStorage.getItem('mafia_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Ошибка запроса');
  }
  return data as T;
}

const REMEMBER_LOGIN_KEY = 'mafia_remember_login';
const REMEMBER_ME_KEY = 'mafia_remember_me';
const PLAYER_ID_KEY_PREFIX = 'mafia_player_id:';

export function loadStoredPlayerId(userId: number | null | undefined): number | null {
  if (!userId) return null;
  const scoped = localStorage.getItem(`${PLAYER_ID_KEY_PREFIX}${userId}`);
  if (scoped) {
    const n = Number(scoped);
    return Number.isFinite(n) ? n : null;
  }
  const legacy = localStorage.getItem('mafia_player_id');
  if (!legacy) return null;
  try {
    const raw = localStorage.getItem('mafia_user');
    const parsed = raw ? (JSON.parse(raw) as { id?: number }) : null;
    if (parsed?.id === userId) {
      localStorage.setItem(`${PLAYER_ID_KEY_PREFIX}${userId}`, legacy);
      localStorage.removeItem('mafia_player_id');
      const n = Number(legacy);
      return Number.isFinite(n) ? n : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveStoredPlayerId(userId: number, playerId: number): void {
  localStorage.setItem(`${PLAYER_ID_KEY_PREFIX}${userId}`, String(playerId));
  localStorage.removeItem('mafia_player_id');
}

export function clearStoredPlayerIds(): void {
  localStorage.removeItem('mafia_player_id');
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PLAYER_ID_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}

export function loadRememberedLogin(): { login: string; remember: boolean } {
  const remember = localStorage.getItem(REMEMBER_ME_KEY) !== '0';
  const login = remember ? localStorage.getItem(REMEMBER_LOGIN_KEY) || '' : '';
  return { login, remember };
}

export function saveRememberedLogin(login: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_ME_KEY, '1');
    localStorage.setItem(REMEMBER_LOGIN_KEY, login);
  } else {
    localStorage.setItem(REMEMBER_ME_KEY, '0');
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
  }
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem('mafia_token', token);
  localStorage.setItem('mafia_user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('mafia_token');
  localStorage.removeItem('mafia_user');
  clearStoredPlayerIds();
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
  displayName: string;
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: {
  login: string;
  password: string;
  remember?: boolean;
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface TelegramAuthPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

export async function telegramLogin(payload: {
  telegram: TelegramAuthPayload;
  remember?: boolean;
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function telegramWebAppLogin(
  initData: string,
  remember = true
): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData, remember }),
  });
}

export async function fetchMe(): Promise<{ user: User }> {
  return apiRequest('/api/auth/me');
}

export async function fetchThemeSettings(): Promise<{
  defaultTheme: ThemeId;
  themes: { id: ThemeId; name: string }[];
}> {
  return apiRequest('/api/settings/theme');
}

export async function fetchTelegramSettings(): Promise<{
  botUsername: string | null;
  webAppUrl: string | null;
}> {
  return apiRequest('/api/settings/telegram');
}

export async function adminSetTelegramSettings(payload: {
  botUsername: string;
  webAppUrl: string;
}): Promise<{ botUsername: string; webAppUrl: string }> {
  return apiRequest('/api/settings/telegram', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminSetDefaultTheme(theme: ThemeId): Promise<{ defaultTheme: ThemeId }> {
  return apiRequest('/api/settings/theme', {
    method: 'PUT',
    body: JSON.stringify({ theme }),
  });
}

export async function updateProfile(payload: {
  displayName: string;
  city: string;
  bio: string;
  chatLimit: number;
  theme?: string | null;
}): Promise<{ user: User }> {
  return apiRequest('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(file: File): Promise<{ user: User }> {
  const form = new FormData();
  form.append('avatar', file);
  const token = localStorage.getItem('mafia_token');
  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка загрузки');
  return data as { user: User };
}

export async function fetchUnreadMailCount(): Promise<{ count: number }> {
  return apiRequest('/api/messages/unread-count');
}

export async function fetchInbox(): Promise<{ messages: PrivateMessage[] }> {
  return apiRequest('/api/messages/inbox');
}

export async function fetchOutbox(): Promise<{ messages: PrivateMessage[] }> {
  return apiRequest('/api/messages/outbox');
}

export async function fetchMailConversations(): Promise<{ conversations: MailConversation[] }> {
  return apiRequest('/api/messages/conversations');
}

export async function fetchMailHistory(): Promise<{ messages: PrivateMessage[] }> {
  return apiRequest('/api/messages/history');
}

export async function fetchMailThread(
  otherUserId: number,
  options?: { limit?: number; beforeId?: number }
): Promise<{ messages: PrivateMessage[]; hasMore: boolean; total: number; unreadCount: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.beforeId) params.set('beforeId', String(options.beforeId));
  const qs = params.toString();
  return apiRequest(`/api/messages/thread/${otherUserId}${qs ? `?${qs}` : ''}`);
}

export async function sendPrivateMessage(
  to: number | string,
  text: string
): Promise<{ message: PrivateMessage }> {
  const body =
    typeof to === 'number' || /^\d+$/.test(String(to).trim())
      ? { toUserId: Number(to), text }
      : { toUsername: String(to).trim().replace(/^@/, ''), text };
  return apiRequest('/api/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function markMessageRead(messageId: number): Promise<{ unreadCount: number }> {
  return apiRequest(`/api/messages/${messageId}/read`, { method: 'POST' });
}

export async function fetchStaffList(): Promise<{ staff: StaffMember[] }> {
  return apiRequest('/api/profile/staff/list');
}

export async function fetchNews(): Promise<{ news: NewsPost[] }> {
  return apiRequest('/api/news');
}

export async function fetchAdminNews(): Promise<{ news: NewsPost[] }> {
  return apiRequest('/api/admin/news');
}

export async function adminCreateNews(payload: {
  title: string;
  body: string;
  coverImage?: string | null;
  isPublished?: boolean;
}): Promise<{ news: NewsPost }> {
  return apiRequest('/api/admin/news', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateNews(
  id: number,
  payload: { title?: string; body?: string; coverImage?: string | null; isPublished?: boolean }
): Promise<{ news: NewsPost }> {
  return apiRequest(`/api/admin/news/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteNews(id: number): Promise<void> {
  await apiRequest(`/api/admin/news/${id}`, { method: 'DELETE' });
}

export async function adminUploadNewsImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('image', file);
  return apiRequest('/api/admin/news/upload-image', { method: 'POST', body: form });
}

export async function fetchViolationLog(): Promise<{ violations: ViolationLogEntry[] }> {
  return apiRequest('/api/admin/violations');
}

export async function adminClearViolationLog(): Promise<{ cleared: number }> {
  return apiRequest('/api/admin/violations', { method: 'DELETE' });
}

export async function fetchUserProfile(userId: number): Promise<{
  user: User & { messageCount?: number };
  canAdmin: boolean;
  canModerate: boolean;
  staffMeta?: ProfileStaffMeta;
}> {
  return apiRequest(`/api/profile/${userId}`);
}

export async function fetchAdminOverview(): Promise<{
  users: User[];
  messages: AdminMessage[];
  gameEvents: AdminGameEvent[];
  rooms: AdminRoom[];
}> {
  return apiRequest('/api/admin/overview');
}

export interface AdminMessage {
  id: string | number;
  roomId: number;
  roomName: string;
  channel: string;
  playerName: string;
  text: string;
  time: string;
  deleted?: boolean;
}

export interface AdminGameEvent {
  id: number;
  roomId: number;
  eventType: string;
  time: string;
  payload?: {
    playerCount?: number;
    winnerTeam?: string;
  };
}

export interface AdminRoom {
  id: number;
  name: string;
  kind?: RoomKind;
  playerCount: number;
  maxPlayers: number;
  phase: string;
}

export async function fetchAdminUsers(): Promise<{ users: User[] }> {
  return apiRequest('/api/admin/users');
}

export async function modBan(
  userId: number,
  reason: string,
  hours: number | null
): Promise<void> {
  return apiRequest('/api/moderation/ban', {
    method: 'POST',
    body: JSON.stringify({ userId, reason, hours }),
  });
}

export async function modUnban(userId: number): Promise<void> {
  return apiRequest('/api/moderation/unban', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function adminSetUserRole(
  userId: number,
  role: 'user' | 'moderator'
): Promise<{ user: User }> {
  return apiRequest(`/api/admin/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export async function adminBan(
  userId: number,
  reason: string,
  hours: number | null
): Promise<void> {
  return apiRequest('/api/admin/ban', {
    method: 'POST',
    body: JSON.stringify({ userId, reason, hours }),
  });
}

export async function adminUnban(userId: number): Promise<void> {
  return apiRequest('/api/admin/unban', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function adminDeleteUser(userId: number): Promise<void> {
  return apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
}

export async function adminDeleteMessage(
  roomId: number,
  messageId: string | number,
  channel: string
): Promise<void> {
  return apiRequest('/api/admin/messages', {
    method: 'DELETE',
    body: JSON.stringify({ roomId, messageId, channel }),
  });
}

export async function adminClearRoomMessages(roomId: number): Promise<{ cleared: number }> {
  return apiRequest(`/api/admin/rooms/${roomId}/messages`, { method: 'DELETE' });
}

export async function adminRenameRoom(
  roomId: number,
  name: string
): Promise<{ room: AdminRoom }> {
  return apiRequest(`/api/admin/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function adminCreateChatRoom(name: string): Promise<void> {
  return apiRequest('/api/admin/chat-rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function adminDeleteChatRoom(roomId: number): Promise<void> {
  return apiRequest(`/api/admin/chat-rooms/${roomId}`, { method: 'DELETE' });
}

/** @deprecated Use adminCreateChatRoom */
export async function adminCreateRoom(name: string): Promise<void> {
  return adminCreateChatRoom(name);
}

/** @deprecated Use adminDeleteChatRoom */
export async function adminDeleteRoom(roomId: number): Promise<void> {
  return adminDeleteChatRoom(roomId);
}

export async function adminUpdateUser(
  userId: number,
  payload: { displayName: string; city: string; bio: string }
): Promise<void> {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminUploadUserAvatar(userId: number, file: File): Promise<void> {
  const form = new FormData();
  form.append('avatar', file);
  const token = localStorage.getItem('mafia_token');
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка загрузки');
}

export async function adminRemoveUserAvatar(userId: number): Promise<void> {
  return apiRequest(`/api/admin/users/${userId}/avatar`, { method: 'DELETE' });
}
