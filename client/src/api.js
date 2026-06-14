const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function avatarUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export async function apiRequest(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const token = localStorage.getItem('mafia_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}

export function saveSession(token, user) {
  localStorage.setItem('mafia_token', token);
  localStorage.setItem('mafia_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('mafia_token');
  localStorage.removeItem('mafia_user');
  localStorage.removeItem('mafia_player_id');
}

export async function register(payload) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMe() {
  return apiRequest('/api/auth/me');
}

export async function updateProfile(payload) {
  return apiRequest('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append('avatar', file);
  const token = localStorage.getItem('mafia_token');
  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
  return data;
}

export async function fetchAdminOverview() {
  return apiRequest('/api/admin/overview');
}

export async function fetchAdminUsers() {
  return apiRequest('/api/admin/users');
}

export async function adminBan(userId, reason, hours) {
  return apiRequest('/api/admin/ban', {
    method: 'POST',
    body: JSON.stringify({ userId, reason, hours }),
  });
}

export async function adminUnban(userId) {
  return apiRequest('/api/admin/unban', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function adminDeleteUser(userId) {
  return apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
}

export async function adminDeleteMessage(roomId, messageId, channel) {
  return apiRequest('/api/admin/messages', {
    method: 'DELETE',
    body: JSON.stringify({ roomId, messageId, channel }),
  });
}

export async function adminRenameRoom(roomId, name) {
  return apiRequest(`/api/admin/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function adminCreateRoom(name) {
  return apiRequest('/api/admin/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function adminDeleteRoom(roomId) {
  return apiRequest(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
}

export async function adminUpdateUser(userId, payload) {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminUploadUserAvatar(userId, file) {
  const form = new FormData();
  form.append('avatar', file);
  const token = localStorage.getItem('mafia_token');
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
  return data;
}

export async function adminRemoveUserAvatar(userId) {
  return apiRequest(`/api/admin/users/${userId}/avatar`, { method: 'DELETE' });
}
