const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

export async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
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

export function loadStoredUser() {
  try {
    const raw = localStorage.getItem('mafia_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
