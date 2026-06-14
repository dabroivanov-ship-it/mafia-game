import type { User } from './types';

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

export function saveSession(token: string, user: User): void {
  localStorage.setItem('mafia_token', token);
  localStorage.setItem('mafia_user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('mafia_token');
  localStorage.removeItem('mafia_user');
  localStorage.removeItem('mafia_player_id');
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
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMe(): Promise<{ user: User }> {
  return apiRequest('/api/auth/me');
}

export async function updateProfile(payload: {
  displayName: string;
  city: string;
  bio: string;
  chatLimit: number;
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

export async function fetchUserProfile(userId: number): Promise<{
  user: User & { messageCount?: number };
  canAdmin: boolean;
  canModerate: boolean;
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

export async function adminCreateRoom(name: string): Promise<void> {
  return apiRequest('/api/admin/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function adminDeleteRoom(roomId: number): Promise<void> {
  return apiRequest(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
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
