import type { User, StaffMember, ProfileStaffMeta, PrivateMessage, NewsPost, NewsComment, MailConversation, RoomKind, ThemeId, ViolationLogEntry, UserSearchHit, UserPresence, FriendUser, LeaderboardEntry, QuizLeaderboardEntry, SiteBranding, UserStatisticsResponse } from './types';

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
  branding: SiteBranding;
}> {
  return apiRequest('/api/settings/theme');
}

export async function fetchSiteBranding(): Promise<SiteBranding> {
  const { branding } = await fetchThemeSettings();
  return branding;
}

export async function telegramOidcLogin(
  idToken: string,
  remember = true
): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken, remember }),
  });
}

export async function fetchTelegramSettings(): Promise<{
  botUsername: string | null;
  webAppUrl: string | null;
  oidcClientId: string | null;
  oidcRedirectUri: string | null;
  loginReady: boolean;
}> {
  return apiRequest('/api/settings/telegram');
}

export async function fetchMetrikaSettings(): Promise<{ metrikaId: number | null }> {
  return apiRequest('/api/settings/metrika');
}

export async function adminSetMetrikaSettings(payload: {
  metrikaId: number | null;
}): Promise<{ metrikaId: number | null }> {
  return apiRequest('/api/settings/metrika', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
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

export interface BotPhraseEntry {
  key: string;
  group: string;
  label: string;
  hint?: string;
  type: 'text' | 'lines';
  placeholders?: string[];
  value: string;
  defaultValue: string;
}

export async function fetchAdminBotPhrases(): Promise<{ phrases: BotPhraseEntry[] }> {
  return apiRequest('/api/admin/bot-phrases');
}

export async function adminSaveBotPhrases(
  phrases: Record<string, string>
): Promise<{ phrases: BotPhraseEntry[]; updated: number }> {
  return apiRequest('/api/admin/bot-phrases', {
    method: 'PUT',
    body: JSON.stringify({ phrases }),
  });
}

export async function adminSetDefaultTheme(theme: ThemeId): Promise<{ defaultTheme: ThemeId }> {
  return apiRequest('/api/settings/theme', {
    method: 'PUT',
    body: JSON.stringify({ theme }),
  });
}

export async function adminSetSiteBranding(payload: {
  logoText: string;
  logoMark: string;
  footerText: string;
}): Promise<{ branding: SiteBranding }> {
  return apiRequest('/api/settings/branding', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminUploadSiteLogo(file: File): Promise<{ branding: SiteBranding }> {
  const form = new FormData();
  form.append('logo', file);
  return apiRequest('/api/settings/branding/logo', {
    method: 'POST',
    body: form,
  });
}

export async function adminRemoveSiteLogo(): Promise<{ branding: SiteBranding }> {
  return apiRequest('/api/settings/branding/logo', { method: 'DELETE' });
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

export async function sendSupportMessage(text: string, photo?: File): Promise<{ ok: true }> {
  const fd = new FormData();
  fd.append('text', text);
  if (photo) fd.append('photo', photo);
  return apiRequest('/api/support', { method: 'POST', body: fd });
}

export async function markMessageRead(messageId: number): Promise<{ unreadCount: number }> {
  return apiRequest(`/api/messages/${messageId}/read`, { method: 'POST' });
}

export async function fetchStaffList(): Promise<{ staff: StaffMember[] }> {
  return apiRequest('/api/profile/staff/list');
}

export async function fetchQuizLeaderboard(
  limit = 10
): Promise<{ players: QuizLeaderboardEntry[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiRequest(`/api/profile/quiz-leaderboard?${params}`);
}

export async function fetchLeaderboard(
  limit = 100,
  offset = 0
): Promise<{ players: LeaderboardEntry[] }> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return apiRequest(`/api/profile/leaderboard?${params}`);
}

export async function fetchNews(): Promise<{ news: NewsPost[] }> {
  return apiRequest('/api/news');
}

export async function fetchNewsComments(newsId: number): Promise<{ comments: NewsComment[] }> {
  return apiRequest(`/api/news/${newsId}/comments`);
}

export async function postNewsComment(
  newsId: number,
  body: string
): Promise<{ comment: NewsComment }> {
  return apiRequest(`/api/news/${newsId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function deleteNewsComment(commentId: number): Promise<void> {
  await apiRequest(`/api/news/comments/${commentId}`, { method: 'DELETE' });
}

export async function linkTelegramEmail(payload: {
  email: string;
  password: string;
  confirm: string;
}): Promise<{ user: User }> {
  return apiRequest('/api/profile/link-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: {
  currentPassword: string;
  password: string;
  confirm: string;
}): Promise<{ user: User }> {
  return apiRequest('/api/profile/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminNews(): Promise<{ news: NewsPost[] }> {
  return apiRequest('/api/admin/news');
}

export async function adminCreateNews(payload: {
  title: string;
  body: string;
  coverImage?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
}): Promise<{ news: NewsPost }> {
  return apiRequest('/api/admin/news', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateNews(
  id: number,
  payload: {
    title?: string;
    body?: string;
    coverImage?: string | null;
    isPublished?: boolean;
    isFeatured?: boolean;
  }
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
  user: User & { messageCount?: number; gamesPlayed?: number; reputation?: number };
  presence: UserPresence;
  isSelf?: boolean;
  isFriend?: boolean;
  reputationVote?: -1 | 1 | null;
  canVoteReputation?: boolean;
  reputationMinGames?: number;
  viewerGamesPlayed?: number;
  canAdmin: boolean;
  canModerate: boolean;
  staffMeta?: ProfileStaffMeta;
}> {
  return apiRequest(`/api/profile/${userId}`);
}

export async function fetchUserStatistics(userId: number): Promise<UserStatisticsResponse> {
  return apiRequest(`/api/profile/${userId}/statistics`);
}

export async function fetchFriends(): Promise<{ friends: FriendUser[] }> {
  return apiRequest('/api/friends');
}

export async function fetchFriendStatus(userId: number): Promise<{ isFriend: boolean; isSelf: boolean }> {
  return apiRequest(`/api/friends/status/${userId}`);
}

export async function addFriend(userId: number): Promise<{ isFriend: boolean }> {
  return apiRequest(`/api/friends/${userId}`, { method: 'POST' });
}

export async function removeFriend(userId: number): Promise<{ isFriend: boolean }> {
  return apiRequest(`/api/friends/${userId}`, { method: 'DELETE' });
}

export async function voteReputation(
  userId: number,
  value: -1 | 1
): Promise<{ reputation: number }> {
  return apiRequest(`/api/reputation/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  });
}

export async function adminSetUserReputation(
  userId: number,
  reputation: number
): Promise<{ reputation: number }> {
  return apiRequest(`/api/admin/users/${userId}/reputation`, {
    method: 'PUT',
    body: JSON.stringify({ reputation }),
  });
}

export async function fetchOnlineCount(): Promise<{ onlineCount: number }> {
  return apiRequest('/api/profile/online-count');
}

export async function fetchOnlineUsers(): Promise<{ users: UserSearchHit[]; onlineCount: number }> {
  return apiRequest('/api/profile/online-users');
}

export async function searchUsers(query: string): Promise<{ users: UserSearchHit[] }> {
  const q = encodeURIComponent(query.trim());
  return apiRequest(`/api/profile/search?q=${q}`);
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

export async function adminReorderRooms(
  kind: RoomKind,
  roomIds: number[]
): Promise<{ ok: boolean }> {
  return apiRequest('/api/admin/rooms/reorder', {
    method: 'PUT',
    body: JSON.stringify({ kind, roomIds }),
  });
}

export async function adminCreateChatRoom(name: string): Promise<void> {
  return apiRequest('/api/admin/chat-rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function adminCreateGameRoom(name: string): Promise<void> {
  return apiRequest('/api/admin/game-rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export interface SilencedPlayerEntry {
  userId: number;
  username: string;
  displayName: string;
  roomId: number;
  roomName: string;
  roomKind: RoomKind;
  silencedUntil: number | null;
  silenceReason: string | null;
  permanent: boolean;
}

export async function fetchAdminBanList(): Promise<{
  banned: User[];
  silenced: SilencedPlayerEntry[];
}> {
  return apiRequest('/api/admin/ban-list');
}

export async function adminUnsilenceUser(userId: number): Promise<{ cleared: number }> {
  return apiRequest(`/api/admin/users/${userId}/unsilence`, { method: 'POST' });
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
