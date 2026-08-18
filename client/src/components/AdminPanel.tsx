import { useEffect, useState, useRef, FormEvent, ChangeEvent, KeyboardEvent } from 'react';
import {
  avatarUrl,
  fetchAdminOverview,
  adminBan,
  adminUnban,
  adminDeleteUser,
  adminClearRoomMessages,
  adminRenameRoom,
  adminCreateChatRoom,
  adminCreateGameRoom,
  adminUpdateGameRoomAi,
  adminDeleteChatRoom,
  adminDeleteGameRoom,
  fetchAdminBanList,
  adminUnsilenceUser,
  adminUpdateUser,
  adminSetUserRole,
  adminUploadUserAvatar,
  adminRemoveUserAvatar,
  fetchAdminNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
  fetchViolationLog,
  adminClearViolationLog,
  fetchThemeSettings,
  adminSetDefaultTheme,
  fetchTelegramSettings,
  adminSetTelegramSettings,
  fetchMetrikaSettings,
  adminSetMetrikaSettings,
  fetchDeepSeekSettings,
  adminSetDeepSeekSettings,
  adminTestDeepSeekConnection,
  fetchAdminPermissions,
  type AdminRoom,
  type SilencedPlayerEntry,
} from '../api';
import type { User, NewsPost, ThemeId, ViolationLogEntry, ViolationType, SiteBranding, LobbyAnnouncement, UserRole } from '../types';
import { AuthProviderBadges } from './AuthProviderBadges';
import { USER_GENDER_LABELS } from '../gender';
import {
  adminPanelRoleLabel,
  hasAdminPermission,
  type AdminPermission,
} from '../adminPermissions';
import NewsEditor, { type NewsEditorValue } from './NewsEditor';
import NewsBody from './NewsBody';
import { isEmptyNewsBody } from './newsBodyUtils';
import { initYandexMetrika } from '../metrika';
import AdminSystemSection, { type SystemView } from './AdminSystemSection';
import AdminRoomOrderList from './AdminRoomOrderList';

function defaultNewsForm(): NewsEditorValue {
  return {
    title: '',
    body: '',
    coverImage: null,
    isPublished: true,
    isFeatured: false,
    pollEnabled: false,
    pollQuestion: '',
    pollOptions: ['', ''],
    pollEndsAt: '',
  };
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function newsFormFromPost(item: NewsPost): NewsEditorValue {
  return {
    title: item.title,
    body: item.body,
    coverImage: item.coverImage ?? null,
    isPublished: item.isPublished,
    isFeatured: !!item.isFeatured,
    pollEnabled: !!item.poll,
    pollQuestion: item.poll?.question ?? '',
    pollOptions: item.poll?.options.map((option) => option.label) ?? ['', ''],
    pollEndsAt: item.poll?.endsAt ? toDatetimeLocalValue(item.poll.endsAt) : '',
  };
}

function buildPollPayload(form: NewsEditorValue) {
  return {
    enabled: form.pollEnabled,
    question: form.pollQuestion.trim(),
    options: form.pollOptions.map((option) => option.trim()).filter(Boolean),
    endsAt: form.pollEndsAt ? new Date(form.pollEndsAt).toISOString() : null,
  };
}

const VIOLATION_LABELS: Record<ViolationType, string> = {
  profanity: 'Мат',
  advertising: 'Реклама',
  other: 'Другое',
};

const USERS_PAGE_SIZE = 15;

function assignableRole(u: User): 'user' | 'watcher' | 'moderator' {
  if (u.isModerator) return 'moderator';
  if (u.isWatcher) return 'watcher';
  return 'user';
}

function userRoleSearchText(u: User): string {
  if (u.isAdmin) return 'admin';
  if (u.isModerator) return 'mod moderator';
  if (u.isWatcher) return 'watcher watch смотрящий';
  return 'user';
}

interface AdminPanelProps {
  onBack: () => void;
  onDefaultThemeChange?: (theme: ThemeId) => void;
  onBrandingChange?: (branding: SiteBranding) => void;
  onLobbyAnnouncementChange?: (announcement: LobbyAnnouncement) => void;
}

export default function AdminPanel({
  onBack,
  onDefaultThemeChange,
  onBrandingChange,
  onLobbyAnnouncementChange,
}: AdminPanelProps) {
  const [systemView, setSystemView] = useState<SystemView>('hub');
  const [users, setUsers] = useState<User[]>([]);
  const [usersRegisteredToday, setUsersRegisteredToday] = useState(0);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banMinutes, setBanMinutes] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    gender: '' as '' | 'male' | 'female',
    city: '',
    bio: '',
  });
  const [newChatRoomName, setNewChatRoomName] = useState('');
  const [newGameRoomName, setNewGameRoomName] = useState('');
  const [newGameRoomAiEnabled, setNewGameRoomAiEnabled] = useState(false);
  const [newGameRoomAiCount, setNewGameRoomAiCount] = useState(3);
  const [roomAiEdits, setRoomAiEdits] = useState<Record<number, { aiEnabled: boolean; aiCount: number }>>({});
  const [bannedUsers, setBannedUsers] = useState<User[]>([]);
  const [silencedPlayers, setSilencedPlayers] = useState<SilencedPlayerEntry[]>([]);
  const [banListLoading, setBanListLoading] = useState(false);
  const [roomEdits, setRoomEdits] = useState<Record<number, string>>({});
  const dirtyRoomsRef = useRef(new Set<number>());
  const roomEditsInitializedRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsForm, setNewsForm] = useState<NewsEditorValue>(defaultNewsForm());
  const [showNewsEditor, setShowNewsEditor] = useState(false);
  const [violations, setViolations] = useState<ViolationLogEntry[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [editNews, setEditNews] = useState<NewsPost | null>(null);
  const [defaultTheme, setDefaultTheme] = useState<ThemeId>('midnight');
  const [themeSaving, setThemeSaving] = useState(false);
  const [telegramForm, setTelegramForm] = useState({ botUsername: '', webAppUrl: '' });
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [metrikaId, setMetrikaId] = useState('');
  const [metrikaDisabled, setMetrikaDisabled] = useState(false);
  const [metrikaSaving, setMetrikaSaving] = useState(false);
  const [deepseekEnabled, setDeepseekEnabled] = useState(true);
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState('https://api.deepseek.com');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [deepseekApiKeyPreview, setDeepseekApiKeyPreview] = useState<string | null>(null);
  const [deepseekSaving, setDeepseekSaving] = useState(false);
  const [deepseekTesting, setDeepseekTesting] = useState(false);
  const [deepseekStatus, setDeepseekStatus] = useState('');
  const [deepseekStatusError, setDeepseekStatusError] = useState(false);
  const [roomAiSavingId, setRoomAiSavingId] = useState<number | null>(null);
  const [roomAiStatus, setRoomAiStatus] = useState('');
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [panelRole, setPanelRole] = useState<UserRole>('user');

  const load = async ({ silent = false, syncRoomNames = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOverview();
      setUsers(data.users || []);
      setUsersRegisteredToday(data.usersRegisteredToday ?? 0);
      setRooms(data.rooms || []);

      if (!roomEditsInitializedRef.current || syncRoomNames) {
        const edits: Record<number, string> = {};
        (data.rooms || []).forEach((r) => {
          edits[r.id] = r.name;
        });
        setRoomEdits(edits);
        dirtyRoomsRef.current.clear();
        roomEditsInitializedRef.current = true;

        const aiEdits: Record<number, { aiEnabled: boolean; aiCount: number }> = {};
        (data.rooms || []).forEach((r) => {
          if (r.kind !== 'chat') {
            aiEdits[r.id] = {
              aiEnabled: !!r.aiEnabled,
              aiCount: r.aiCount ?? 0,
            };
          }
        });
        setRoomAiEdits(aiEdits);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(() => void load({ silent: true }), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchAdminPermissions()
      .then(({ role, permissions: perms }) => {
        setPanelRole(role as UserRole);
        setPermissions(perms);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchThemeSettings()
      .then(({ defaultTheme: dt }) => setDefaultTheme(dt))
      .catch(() => {});
    fetchTelegramSettings()
      .then(({ botUsername, webAppUrl }) =>
        setTelegramForm({ botUsername: botUsername || '', webAppUrl: webAppUrl || '' })
      )
      .catch(() => {});
    fetchMetrikaSettings()
      .then(({ metrikaId: id }) => {
        setMetrikaDisabled(id === null);
        setMetrikaId(id === null ? '' : String(id));
      })
      .catch(() => {});
    fetchDeepSeekSettings()
      .then((settings) => {
        setDeepseekEnabled(settings.enabled);
        setDeepseekModel(settings.model);
        setDeepseekBaseUrl(settings.baseUrl || 'https://api.deepseek.com');
        setDeepseekApiKeyPreview(settings.apiKeyPreview);
      })
      .catch(() => {});
  }, []);

  const handleDefaultThemeChange = async (themeId: ThemeId) => {
    setThemeSaving(true);
    setError('');
    try {
      const { defaultTheme: saved } = await adminSetDefaultTheme(themeId);
      setDefaultTheme(saved);
      onDefaultThemeChange?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения темы');
    } finally {
      setThemeSaving(false);
    }
  };

  const handleSaveTelegramSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setTelegramSaving(true);
    try {
      const payload = {
        botUsername: telegramForm.botUsername.trim().replace(/^@/, ''),
        webAppUrl: telegramForm.webAppUrl.trim(),
      };
      const saved = await adminSetTelegramSettings(payload);
      setTelegramForm(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения Telegram настроек');
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleSaveMetrikaSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMetrikaSaving(true);
    try {
      const payload = metrikaDisabled
        ? { metrikaId: null }
        : { metrikaId: Number(metrikaId.trim()) };
      const saved = await adminSetMetrikaSettings(payload);
      setMetrikaDisabled(saved.metrikaId === null);
      setMetrikaId(saved.metrikaId === null ? '' : String(saved.metrikaId));
      initYandexMetrika(saved.metrikaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения настроек Метрики');
    } finally {
      setMetrikaSaving(false);
    }
  };

  const handleSaveDeepseekSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDeepseekStatus('');
    setDeepseekSaving(true);
    try {
      const payload: {
        enabled: boolean;
        model: string;
        baseUrl: string;
        apiKey?: string | null;
      } = {
        enabled: deepseekEnabled,
        model: deepseekModel.trim() || 'deepseek-chat',
        baseUrl: deepseekBaseUrl.trim() || 'https://api.deepseek.com',
      };
      if (deepseekApiKey.trim()) payload.apiKey = deepseekApiKey.trim();
      const saved = await adminSetDeepSeekSettings(payload);
      setDeepseekEnabled(saved.enabled);
      setDeepseekModel(saved.model);
      setDeepseekBaseUrl(saved.baseUrl || 'https://api.deepseek.com');
      setDeepseekApiKeyPreview(saved.apiKeyPreview);
      setDeepseekApiKey('');
      setDeepseekStatusError(false);
      setDeepseekStatus('Настройки сохранены.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения DeepSeek';
      setError(message);
      setDeepseekStatusError(true);
      setDeepseekStatus(message);
    } finally {
      setDeepseekSaving(false);
    }
  };

  const handleTestDeepseek = async () => {
    setError('');
    setDeepseekStatus('Проверяем API...');
    setDeepseekStatusError(false);
    setDeepseekTesting(true);
    try {
      const result = await adminTestDeepSeekConnection({
        model: deepseekModel.trim() || undefined,
        baseUrl: deepseekBaseUrl.trim() || undefined,
        apiKey: deepseekApiKey.trim() || undefined,
      });
      setDeepseekStatusError(false);
      setDeepseekStatus(`Подключение успешно. Модель: ${result.model || deepseekModel}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DeepSeek недоступен';
      setError(message);
      setDeepseekStatusError(true);
      setDeepseekStatus(message);
    } finally {
      setDeepseekTesting(false);
    }
  };

  const loadNews = async () => {
    setNewsLoading(true);
    try {
      const { news } = await fetchAdminNews();
      setNewsPosts(news);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки новостей');
    } finally {
      setNewsLoading(false);
    }
  };

  const loadBanList = async () => {
    setBanListLoading(true);
    try {
      const { banned, silenced } = await fetchAdminBanList();
      setBannedUsers(banned);
      setSilencedPlayers(silenced);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки бан-листа');
    } finally {
      setBanListLoading(false);
    }
  };

  const loadViolations = async () => {
    setViolationsLoading(true);
    try {
      const { violations: list } = await fetchViolationLog();
      setViolations(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки лога');
    } finally {
      setViolationsLoading(false);
    }
  };

  useEffect(() => {
    if (systemView === 'news') void loadNews();
    if (systemView === 'violations') void loadViolations();
    if (systemView === 'banlist') void loadBanList();
  }, [systemView]);

  useEffect(() => {
    setUserPage(0);
  }, [userSearch]);

  const openEditUser = (u: User) => {
    setEditUser(u);
    setEditForm({
      displayName: u.displayName || '',
      username: u.username || '',
      gender: u.gender || '',
      city: u.city || '',
      bio: u.bio || '',
    });
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    try {
      await adminUpdateUser(editUser.id, editForm);
      setEditUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  const handleUserAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editUser) return;
    try {
      await adminUploadUserAvatar(editUser.id, file);
      await load();
      const data = await fetchAdminOverview();
      const updated = data.users.find((u) => u.id === editUser.id);
      if (updated) setEditUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!editUser) return;
    try {
      await adminRemoveUserAvatar(editUser.id);
      await load();
      setEditUser({ ...editUser, avatar: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleRoleChange = async (userId: number, role: 'user' | 'watcher' | 'moderator') => {
    try {
      await adminSetUserRole(userId, role);
      await load();
      if (editUser?.id === userId) {
        setEditUser((prev) =>
          prev
            ? {
                ...prev,
                role,
                isModerator: role === 'moderator',
                isWatcher: role === 'watcher',
              }
            : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены роли');
    }
  };

  const handleRenameRoom = async (roomId: number) => {
    const name = roomEdits[roomId]?.trim();
    if (!name) {
      setError('Название не может быть пустым');
      return;
    }
    try {
      const { room } = await adminRenameRoom(roomId, name);
      dirtyRoomsRef.current.delete(roomId);
      setRoomEdits((prev) => ({ ...prev, [roomId]: room.name }));
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, name: room.name } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка переименования');
    }
  };

  const handleRoomNameChange = (roomId: number, value: string) => {
    setRoomEdits((prev) => ({ ...prev, [roomId]: value }));
    dirtyRoomsRef.current.add(roomId);
  };

  const handleRoomNameKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    roomId: number,
    kind: 'game' | 'chat' = 'chat'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (kind === 'game') {
        void handleSaveGameRoom(roomId);
      } else {
        void handleRenameRoom(roomId);
      }
    }
  };

  const handleCreateChatRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChatRoomName.trim()) return;
    try {
      await adminCreateChatRoom(newChatRoomName.trim());
      setNewChatRoomName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  };

  const handleCreateGameRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGameRoomName.trim()) return;
    try {
      await adminCreateGameRoom(newGameRoomName.trim(), {
        aiEnabled: newGameRoomAiEnabled,
        aiCount: newGameRoomAiEnabled ? newGameRoomAiCount : 0,
      });
      setNewGameRoomName('');
      setNewGameRoomAiEnabled(false);
      setNewGameRoomAiCount(3);
      await load({ syncRoomNames: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  };

  const handleSaveGameRoom = async (roomId: number) => {
    const room = rooms.find((r) => r.id === roomId);
    const name = roomEdits[roomId]?.trim();
    if (!name) {
      setError('Название не может быть пустым');
      return;
    }
    const edit = roomAiEdits[roomId] ?? {
      aiEnabled: !!room?.aiEnabled,
      aiCount: room?.aiCount ?? 3,
    };
    const aiCount = edit.aiEnabled ? Math.max(1, edit.aiCount || 3) : 0;

    setRoomAiStatus('');
    setError('');
    setRoomAiSavingId(roomId);
    try {
      if (name !== room?.name) {
        const { room: updated } = await adminRenameRoom(roomId, name);
        dirtyRoomsRef.current.delete(roomId);
        setRoomEdits((prev) => ({ ...prev, [roomId]: updated.name }));
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, name: updated.name } : r))
        );
      }

      await adminUpdateGameRoomAi(roomId, {
        aiEnabled: edit.aiEnabled,
        aiCount,
      });
      await load({ syncRoomNames: true });
      setRoomAiStatus(
        edit.aiEnabled
          ? `Сохранено: «${name}», ИИ — ${aiCount} бот(ов).`
          : `Сохранено: «${name}», ИИ выключен.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения комнаты';
      setError(message);
      setRoomAiStatus(message);
    } finally {
      setRoomAiSavingId(null);
    }
  };

  const handleDeleteChatRoom = async (roomId: number, name: string) => {
    if (!confirm(`Удалить чат-комнату «${name}»? Участники будут выгнаны.`)) return;
    try {
      await adminDeleteChatRoom(roomId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleDeleteGameRoom = async (roomId: number, name: string) => {
    if (!confirm(`Удалить комнату мафии «${name}»? Участники будут выгнаны.`)) return;
    try {
      await adminDeleteGameRoom(roomId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleBan = async () => {
    if (!banTarget) return;
    try {
      await adminBan(banTarget.id, banReason, banMinutes ? Number(banMinutes) : null);
      setBanTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка бана');
    }
  };

  const handleUnban = async (userId: number) => {
    try {
      await adminUnban(userId);
      if (editUser?.id === userId) {
        setEditUser((prev) => (prev ? { ...prev, isBanned: false, banReason: null, bannedUntil: null } : null));
      }
      await load();
      if (systemView === 'banlist') await loadBanList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбана');
    }
  };

  const handleUnsilence = async (userId: number) => {
    try {
      await adminUnsilenceUser(userId);
      await loadBanList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка снятия заглушки');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Удалить пользователя и его профиль?')) return;
    try {
      await adminDeleteUser(userId);
      if (editUser?.id === userId) setEditUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleClearRoomMessages = async (roomId: number, roomName: string) => {
    if (!confirm(`Очистить все сообщения в комнате «${roomName}»?`)) return;
    try {
      await adminClearRoomMessages(roomId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка очистки сообщений');
    }
  };

  const resetNewsForm = () => {
    setNewsForm(defaultNewsForm());
    setEditNews(null);
    setShowNewsEditor(false);
  };

  const handleSaveNews = async (e: FormEvent) => {
    e.preventDefault();
    const title = newsForm.title.trim();
    const body = newsForm.body.trim();
    if (!title || isEmptyNewsBody(body)) {
      setError('Заголовок и текст новости обязательны');
      return;
    }
    try {
      const payload = {
        title,
        body,
        coverImage: newsForm.coverImage,
        isPublished: newsForm.isPublished,
        isFeatured: newsForm.isFeatured,
        poll: buildPollPayload(newsForm),
      };
      if (editNews) {
        await adminUpdateNews(editNews.id, payload);
      } else {
        await adminCreateNews(payload);
      }
      resetNewsForm();
      await loadNews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения новости');
    }
  };

  const handleEditNews = (item: NewsPost) => {
    setEditNews(item);
    setNewsForm(newsFormFromPost(item));
    setShowNewsEditor(true);
  };

  const handleClearViolations = async () => {
    if (!confirm('Очистить весь лог нарушений?')) return;
    try {
      await adminClearViolationLog();
      await loadViolations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка очистки лога');
    }
  };

  const handleDeleteNews = async (id: number) => {
    if (!confirm('Удалить эту новость?')) return;
    try {
      await adminDeleteNews(id);
      if (editNews?.id === id) resetNewsForm();
      await loadNews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления новости');
    }
  };

  const handleToggleNewsPublished = async (item: NewsPost) => {
    try {
      await adminUpdateNews(item.id, { isPublished: !item.isPublished });
      await loadNews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      userRoleSearchText(u).includes(q)
    );
  });
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    userPage * USERS_PAGE_SIZE,
    (userPage + 1) * USERS_PAGE_SIZE
  );

  const gameRooms = rooms.filter((r) => r.kind !== 'chat');
  const chatRooms = rooms.filter((r) => r.kind === 'chat');
  const banListCount = users.filter((u) => u.isBanned).length + silencedPlayers.length;

  const canEditUsers = hasAdminPermission(permissions, 'edit_users');
  const canBanUsers = hasAdminPermission(permissions, 'ban_users');
  const canDeleteUsers = hasAdminPermission(permissions, 'delete_users');
  const canSetRoles = hasAdminPermission(permissions, 'set_roles');
  const canManageSilence = hasAdminPermission(permissions, 'manage_silence');
  const canClearViolations = hasAdminPermission(permissions, 'clear_violations');
  const canManageNews = hasAdminPermission(permissions, 'manage_news');
  const canManageGameRooms = hasAdminPermission(permissions, 'manage_game_rooms');
  const canManageChatRooms = hasAdminPermission(permissions, 'manage_chat_rooms');

  const formatUntil = (value?: string | null) => {
    if (!value) return 'навсегда';
    return new Date(value).toLocaleString('ru-RU');
  };

  const formatSilenceUntil = (until: number | null, permanent: boolean) => {
    if (permanent || !until) return 'навсегда';
    return new Date(until).toLocaleString('ru-RU');
  };
  const telegramBotLink = telegramForm.botUsername
    ? `https://t.me/${telegramForm.botUsername.replace(/^@/, '')}`
    : '';

  if (loading && users.length === 0) {
    return <div className="admin-page"><p className="muted">Загрузка...</p></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>
            {panelRole === 'watcher'
              ? 'Панель смотрящего'
              : panelRole === 'moderator'
                ? 'Панель модератора'
                : 'Панель администратора'}
          </h2>
          {systemView === 'hub' && (
            <p className="admin-header-sub">
              {adminPanelRoleLabel(panelRole)}
              {' · '}
              Пользователей: <strong>{users.length}</strong>
              {' · '}
              Новых за сутки: <strong>{usersRegisteredToday}</strong>
              {' · '}
              Комнат: <strong>{rooms.length}</strong>
            </p>
          )}
        </div>
        <div className="admin-header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>Обновить</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>Назад</button>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <AdminSystemSection
        view={systemView}
        onViewChange={setSystemView}
        permissions={permissions}
        usersCount={users.length}
        banListCount={banListCount}
        roomsCount={rooms.length}
        gameRoomsCount={gameRooms.length}
        chatRoomsCount={chatRooms.length}
        violationsCount={violations.length}
        newsCount={newsPosts.length}
        defaultTheme={defaultTheme}
        themeSaving={themeSaving}
        onThemeChange={(id) => void handleDefaultThemeChange(id)}
        onBrandingChange={onBrandingChange}
        onAnnouncementChange={onLobbyAnnouncementChange}
        telegramForm={telegramForm}
        telegramSaving={telegramSaving}
        onTelegramFormChange={(patch) => setTelegramForm((prev) => ({ ...prev, ...patch }))}
        onSaveTelegram={(e) => void handleSaveTelegramSettings(e)}
        telegramBotLink={telegramBotLink}
        metrikaId={metrikaId}
        metrikaDisabled={metrikaDisabled}
        metrikaSaving={metrikaSaving}
        onMetrikaIdChange={(value) => setMetrikaId(value.replace(/\D/g, ''))}
        onMetrikaDisabledChange={setMetrikaDisabled}
        onSaveMetrika={(e) => void handleSaveMetrikaSettings(e)}
        deepseekEnabled={deepseekEnabled}
        deepseekModel={deepseekModel}
        deepseekBaseUrl={deepseekBaseUrl}
        deepseekApiKey={deepseekApiKey}
        deepseekApiKeyPreview={deepseekApiKeyPreview}
        deepseekSaving={deepseekSaving}
        deepseekTesting={deepseekTesting}
        onDeepseekEnabledChange={setDeepseekEnabled}
        onDeepseekModelChange={setDeepseekModel}
        onDeepseekBaseUrlChange={setDeepseekBaseUrl}
        onDeepseekApiKeyChange={setDeepseekApiKey}
        onSaveDeepseek={(e) => void handleSaveDeepseekSettings(e)}
        onTestDeepseek={() => void handleTestDeepseek()}
        deepseekStatus={deepseekStatus}
        deepseekStatusError={deepseekStatusError}
        panels={{
          users: (
            <section className="admin-section admin-section-embedded">
              <h3>Пользователи ({filteredUsers.length}{userSearch ? ` из ${users.length}` : ''})</h3>
              <div className="admin-search-row">
                <input
                  type="search"
                  className="admin-search-input"
                  placeholder="Поиск по логину или имени..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              {filteredUsers.length === 0 && <p className="muted">Ничего не найдено</p>}
              <ul className="admin-users-list">
                {paginatedUsers.map((u) => (
                  <li key={u.id} className="admin-users-list-item">
                    <button type="button" className="admin-users-list-btn" onClick={() => openEditUser(u)}>
                      {u.avatar ? (
                        <img src={avatarUrl(u.avatar) ?? undefined} alt="" className="admin-avatar" />
                      ) : (
                        <span className="admin-avatar placeholder">👤</span>
                      )}
                      <span className="admin-users-list-name">
                        <strong>{u.displayName}</strong>
                        <span className="admin-users-list-nick">
                          <span className="muted">@{u.username}</span>
                          <AuthProviderBadges providers={u.authProviders} />
                        </span>
                      </span>
                      {u.isAdmin && <span className="admin-badge">admin</span>}
                      {u.isModerator && <span className="mod-badge">mod</span>}
                      {u.isWatcher && <span className="watcher-badge">watch</span>}
                      {u.isBanned && <span className="status-banned">бан</span>}
                      {Date.now() - new Date(u.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                        <span className="admin-new-user-badge">новый</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {userTotalPages > 1 && (
                <nav className="rating-pagination" aria-label="Страницы пользователей">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={userPage === 0}
                    onClick={() => setUserPage((p) => p - 1)}
                  >
                    ← Назад
                  </button>
                  <span className="rating-pagination-info muted">
                    Страница {userPage + 1} из {userTotalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={userPage >= userTotalPages - 1}
                    onClick={() => setUserPage((p) => p + 1)}
                  >
                    Вперёд →
                  </button>
                </nav>
              )}
            </section>
          ),
          banlist: (
            <section className="admin-section admin-section-embedded admin-banlist-section">
              <div className="admin-section-head">
                <h3>Бан-лист</h3>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void loadBanList()}>
                  Обновить
                </button>
              </div>

              {banListLoading && bannedUsers.length === 0 && silencedPlayers.length === 0 && (
                <p className="muted">Загрузка...</p>
              )}

              <h4 className="admin-subsection-title">Забаненные ({bannedUsers.length})</h4>
              {bannedUsers.length === 0 ? (
                <p className="muted">Забаненных пользователей нет</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Игрок</th>
                        <th>Причина</th>
                        <th>До</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bannedUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="admin-user-cell">
                              {u.avatar ? (
                                <img src={avatarUrl(u.avatar) ?? undefined} alt="" className="admin-avatar" />
                              ) : (
                                <span className="admin-avatar placeholder">👤</span>
                              )}
                              <div>
                                <strong>{u.displayName}</strong>
                                <span className="admin-users-list-nick">
                                  <span className="muted">@{u.username}</span>
                                  <AuthProviderBadges providers={u.authProviders} />
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>{u.banReason || '—'}</td>
                          <td>{formatUntil(u.bannedUntil)}</td>
                          <td className="admin-actions">
                            {canBanUsers && (
                              <button type="button" className="btn btn-sm" onClick={() => void handleUnban(u.id)}>
                                Разбан
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 className="admin-subsection-title">Заглушённые ({silencedPlayers.length})</h4>
              {silencedPlayers.length === 0 ? (
                <p className="muted">Заглушённых игроков нет</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Игрок</th>
                        <th>Комната</th>
                        <th>Причина</th>
                        <th>До</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {silencedPlayers.map((entry) => (
                        <tr key={`${entry.userId}-${entry.roomId}`}>
                          <td>
                            <strong>{entry.displayName}</strong>
                            <span className="muted"> @{entry.username}</span>
                          </td>
                          <td>
                            {entry.roomName}
                            <span className="muted"> · {entry.roomKind === 'chat' ? 'чат' : 'мафия'}</span>
                          </td>
                          <td>{entry.silenceReason || '—'}</td>
                          <td>{formatSilenceUntil(entry.silencedUntil, entry.permanent)}</td>
                          <td className="admin-actions">
                            {canManageSilence && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => void handleUnsilence(entry.userId)}
                              >
                                Снять заглушку
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ),
          gameRooms: (
            <section className="admin-section admin-section-embedded">
              <h3>Комнаты мафии ({gameRooms.length})</h3>
              {gameRooms.length === 0 ? (
                <p className="muted">Игровых комнат пока нет</p>
              ) : (
                <AdminRoomOrderList
                  rooms={gameRooms}
                  kind="game"
                  readOnly={!canManageGameRooms}
                  onReordered={() => load({ silent: true, syncRoomNames: true })}
                  renderRow={(r) => (
                    <>
                      <div className="admin-room-row-primary">
                        {canManageGameRooms ? (
                          <input
                            type="text"
                            value={roomEdits[r.id] ?? r.name}
                            onChange={(e) => handleRoomNameChange(r.id, e.target.value)}
                            onKeyDown={(e) => handleRoomNameKeyDown(e, r.id, 'game')}
                            maxLength={50}
                          />
                        ) : (
                          <strong className="admin-room-name">{r.name}</strong>
                        )}
                        <span className="muted room-meta">
                          {r.playerCount} · {r.phase}
                          {r.aiEnabled ? ` · ИИ: ${r.aiCount ?? 0}` : ''}
                        </span>
                      </div>
                      {canManageGameRooms && (
                        <div className="admin-room-row-actions">
                          <label className="admin-ai-toggle">
                            <input
                              type="checkbox"
                              checked={roomAiEdits[r.id]?.aiEnabled ?? !!r.aiEnabled}
                              onChange={(e) =>
                                setRoomAiEdits((prev) => ({
                                  ...prev,
                                  [r.id]: {
                                    aiEnabled: e.target.checked,
                                    aiCount: (() => {
                                      const current = prev[r.id]?.aiCount ?? r.aiCount ?? 0;
                                      if (e.target.checked && current < 1) return 3;
                                      return current;
                                    })(),
                                  },
                                }))
                              }
                            />
                            <span>ИИ</span>
                          </label>
                          {(roomAiEdits[r.id]?.aiEnabled ?? !!r.aiEnabled) && (
                            <input
                              type="number"
                              className="admin-ai-count"
                              min={1}
                              max={10}
                              value={roomAiEdits[r.id]?.aiCount ?? r.aiCount ?? 3}
                              onChange={(e) =>
                                setRoomAiEdits((prev) => ({
                                  ...prev,
                                  [r.id]: {
                                    aiEnabled: prev[r.id]?.aiEnabled ?? !!r.aiEnabled,
                                    aiCount: Number(e.target.value) || 1,
                                  },
                                }))
                              }
                              aria-label="Количество ИИ-игроков"
                            />
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={roomAiSavingId === r.id}
                            onClick={() => void handleSaveGameRoom(r.id)}
                          >
                            {roomAiSavingId === r.id ? 'Сохраняю...' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => void handleClearRoomMessages(r.id, r.name)}
                          >
                            Очистить чат
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm danger"
                            onClick={() => void handleDeleteGameRoom(r.id, r.name)}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </>
                  )}
                />
              )}
              {roomAiStatus && <p className="theme-settings-hint">{roomAiStatus}</p>}
              {canManageGameRooms && (
              <form className="admin-add-room" onSubmit={handleCreateGameRoom}>
                <input
                  type="text"
                  placeholder="Название новой комнаты мафии"
                  value={newGameRoomName}
                  onChange={(e) => setNewGameRoomName(e.target.value)}
                  maxLength={50}
                />
                <label className="admin-ai-toggle">
                  <input
                    type="checkbox"
                    checked={newGameRoomAiEnabled}
                    onChange={(e) => setNewGameRoomAiEnabled(e.target.checked)}
                  />
                  <span>ИИ-игроки</span>
                </label>
                {newGameRoomAiEnabled && (
                  <input
                    type="number"
                    className="admin-ai-count"
                    min={1}
                    max={10}
                    value={newGameRoomAiCount}
                    onChange={(e) => setNewGameRoomAiCount(Number(e.target.value) || 1)}
                    title="Количество ИИ-игроков"
                  />
                )}
                <button type="submit" className="btn btn-primary">+ Создать комнату мафии</button>
              </form>
              )}
            </section>
          ),
          chatRooms: (
            <section className="admin-section admin-section-embedded">
              <h3>Комнаты чата ({chatRooms.length})</h3>
              {chatRooms.length === 0 ? (
                <p className="muted">Чат-комнат пока нет</p>
              ) : (
                <AdminRoomOrderList
                  rooms={chatRooms}
                  kind="chat"
                  readOnly={!canManageChatRooms}
                  onReordered={() => load({ silent: true, syncRoomNames: true })}
                  renderRow={(r) => (
                    <>
                      <div className="admin-room-row-primary">
                        {canManageChatRooms ? (
                          <input
                            type="text"
                            value={roomEdits[r.id] ?? r.name}
                            onChange={(e) => handleRoomNameChange(r.id, e.target.value)}
                            onKeyDown={(e) => handleRoomNameKeyDown(e, r.id)}
                            maxLength={50}
                          />
                        ) : (
                          <strong className="admin-room-name">{r.name}</strong>
                        )}
                        <span className="muted room-meta">{r.playerCount}</span>
                      </div>
                      {canManageChatRooms && (
                        <div className="admin-room-row-actions">
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => void handleRenameRoom(r.id)}>
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => void handleClearRoomMessages(r.id, r.name)}
                          >
                            Очистить чат
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm danger"
                            onClick={() => void handleDeleteChatRoom(r.id, r.name)}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </>
                  )}
                />
              )}
              {canManageChatRooms && (
              <form className="admin-add-room" onSubmit={handleCreateChatRoom}>
                <input
                  type="text"
                  placeholder="Название новой чат-комнаты"
                  value={newChatRoomName}
                  onChange={(e) => setNewChatRoomName(e.target.value)}
                  maxLength={50}
                />
                <button type="submit" className="btn btn-primary">+ Создать чат-комнату</button>
              </form>
              )}
            </section>
          ),
          news: (
            <section className="admin-section admin-section-embedded">
              <div className="admin-section-head">
                <h3>Новости ({newsPosts.length})</h3>
                {!showNewsEditor && canManageNews && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditNews(null);
                      setNewsForm(defaultNewsForm());
                      setShowNewsEditor(true);
                    }}
                  >
                    + Новая новость
                  </button>
                )}
              </div>

              {showNewsEditor && (
                <>
                  {editNews && <p className="muted">Редактирование #{editNews.id}</p>}
                  <NewsEditor
                    key={editNews?.id ?? 'new'}
                    value={newsForm}
                    onChange={setNewsForm}
                    onSubmit={handleSaveNews}
                    submitLabel="Сохранить"
                    onCancel={resetNewsForm}
                    pollHasVotes={(editNews?.poll?.totalVotes ?? 0) > 0}
                  />
                </>
              )}

              {newsLoading && newsPosts.length === 0 && <p className="muted">Загрузка...</p>}

              <div className="news-list admin-news-list">
                {newsPosts.length === 0 && !newsLoading && <p className="muted">Новостей пока нет</p>}
                {newsPosts.map((item) => (
                  <article key={item.id} className="news-card">
                    <header className="news-card-header">
                      <h2>
                        {item.isFeatured && <span className="news-featured-badge">★</span>}
                        {item.title}
                      </h2>
                      <time className="muted" dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString('ru-RU')}
                      </time>
                    </header>
                    <p className="news-author muted">
                      {item.authorName || '—'} · {item.isPublished ? 'опубликовано' : 'черновик'}
                      {item.isFeatured ? ' · избранное' : ''}
                      {item.poll ? ` · голосование (${item.poll.totalVotes})` : ''}
                    </p>
                    {item.coverImage && (
                      <img
                        src={avatarUrl(item.coverImage) ?? undefined}
                        alt=""
                        className="news-cover-image"
                      />
                    )}
                    <NewsBody body={item.body} />
                    <div className="admin-actions">
                      {canManageNews && (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => handleEditNews(item)}>
                            Редактировать
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => void handleToggleNewsPublished(item)}>
                            {item.isPublished ? 'Снять с публикации' : 'Опубликовать'}
                          </button>
                          <button type="button" className="btn btn-sm danger" onClick={() => void handleDeleteNews(item.id)}>
                            Удалить
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ),
          violations: (
            <section className="admin-section admin-section-embedded">
              <div className="admin-section-head">
                <h3>Лог нарушений ({violations.length})</h3>
                <button
                  type="button"
                  className="btn btn-sm danger"
                  onClick={() => void handleClearViolations()}
                  disabled={violations.length === 0 || !canClearViolations}
                >
                  Очистить лог
                </button>
              </div>
              {violationsLoading && violations.length === 0 && <p className="muted">Загрузка...</p>}
              {violations.length === 0 && !violationsLoading && (
                <p className="muted">Записей пока нет. Они появляются при удалении сообщений в чате.</p>
              )}
              <div className="admin-table-wrap">
                <table className="admin-table violation-log-table">
                  <thead>
                    <tr>
                      <th>Когда</th>
                      <th>Тип</th>
                      <th>Автор</th>
                      <th>Сообщение</th>
                      <th>Комната</th>
                      <th>Модератор</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v) => (
                      <tr key={v.id}>
                        <td className="violation-time">
                          {new Date(v.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td>
                          <span className={`violation-badge violation-${v.violationType}`}>
                            {VIOLATION_LABELS[v.violationType]}
                          </span>
                        </td>
                        <td>{v.authorName}</td>
                        <td className="violation-message">{v.messageText}</td>
                        <td>
                          {v.roomName}
                          <span className="muted"> · {v.channel}</span>
                        </td>
                        <td>{v.moderatorName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ),
        }}
      />

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>
              {canEditUsers ? 'Редактировать' : 'Профиль'}: {editUser.username}{' '}
              <AuthProviderBadges providers={editUser.authProviders} />
            </h3>

            {canEditUsers && (
            <div className="profile-avatar-block">
              {editUser.avatar ? (
                <img src={avatarUrl(editUser.avatar) ?? undefined} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder">👤</div>
              )}
              <div>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleUserAvatar} hidden id="admin-avatar" />
                <label htmlFor="admin-avatar" className="btn btn-ghost">Заменить аватар</label>
                {editUser.avatar && (
                  <button type="button" className="btn btn-sm danger" onClick={() => void handleRemoveAvatar()}>
                    Удалить аватар
                  </button>
                )}
              </div>
            </div>
            )}

            {!canEditUsers && editUser.avatar && (
              <img src={avatarUrl(editUser.avatar) ?? undefined} alt="" className="profile-avatar" />
            )}

            <label>
              Логин (ник)
              <input
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                maxLength={30}
                disabled={!canEditUsers || editUser.isAdmin}
              />
            </label>
            <label>
              Имя
              <input
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                maxLength={30}
                disabled={!canEditUsers}
              />
            </label>
            <label>
              Пол
              <select
                value={editForm.gender}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    gender: e.target.value as '' | 'male' | 'female',
                  })
                }
                disabled={!canEditUsers}
              >
                <option value="">Не указан</option>
                <option value="male">{USER_GENDER_LABELS.male}</option>
                <option value="female">{USER_GENDER_LABELS.female}</option>
              </select>
            </label>
            <label>
              Город
              <input
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                maxLength={50}
                disabled={!canEditUsers}
              />
            </label>
            <label>
              О себе
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                maxLength={500}
                rows={3}
                disabled={!canEditUsers}
              />
            </label>
            <p className="muted">
              Игр: {editUser.gamesPlayed ?? 0} · Репутация: {editUser.reputation ?? 0}
              {editUser.isAdmin && <> · <span className="admin-badge">admin</span></>}
              {editUser.isModerator && <> · <span className="mod-badge">mod</span></>}
              {editUser.isWatcher && <> · <span className="watcher-badge">watch</span></>}
            </p>

            {!editUser.isAdmin && (canSetRoles || canBanUsers || canDeleteUsers) && (
              <div className="admin-edit-user-actions">
                {canSetRoles && (
                  <label>
                    Роль
                    <select
                      className="admin-role-select"
                      value={assignableRole(editUser)}
                      onChange={(e) =>
                        void handleRoleChange(
                          editUser.id,
                          e.target.value as 'user' | 'watcher' | 'moderator'
                        )
                      }
                    >
                      <option value="user">игрок</option>
                      <option value="watcher">смотрящий</option>
                      <option value="moderator">модер</option>
                    </select>
                  </label>
                )}
                {canBanUsers && !editUser.isModerator && !editUser.isWatcher && !editUser.isBanned && (
                  <button type="button" className="btn btn-sm danger" onClick={() => setBanTarget(editUser)}>
                    Забанить
                  </button>
                )}
                {canBanUsers && editUser.isBanned && (
                  <button type="button" className="btn btn-sm" onClick={() => void handleUnban(editUser.id)}>
                    Разбан
                  </button>
                )}
                {canDeleteUsers && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost danger"
                    onClick={() => void handleDeleteUser(editUser.id)}
                  >
                    Удалить аккаунт
                  </button>
                )}
              </div>
            )}

            <div className="profile-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)}>Закрыть</button>
              {canEditUsers && (
                <button type="button" className="btn btn-primary" onClick={() => void handleSaveUser()}>Сохранить</button>
              )}
            </div>
          </div>
        </div>
      )}

      {banTarget && (
        <div className="modal-overlay" onClick={() => setBanTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Забанить: {banTarget.displayName}</h3>
            <label>
              Причина
              <input value={banReason} onChange={(e) => setBanReason(e.target.value)} />
            </label>
            <label>
              Минут (пусто = навсегда)
              <input
                type="number"
                min="1"
                value={banMinutes}
                onChange={(e) => setBanMinutes(e.target.value)}
                placeholder="60"
              />
            </label>
            <div className="profile-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setBanTarget(null)}>Отмена</button>
              <button type="button" className="btn btn-primary danger" onClick={() => void handleBan()}>Забанить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
