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
  adminDeleteChatRoom,
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
  type AdminRoom,
} from '../api';
import type { User, NewsPost, ThemeId, ViolationLogEntry, ViolationType } from '../types';
import NewsEditor, { type NewsEditorValue } from './NewsEditor';
import NewsBody from './NewsBody';
import { isEmptyNewsBody } from './newsBodyUtils';
import { initYandexMetrika } from '../metrika';
import AdminSystemSection from './AdminSystemSection';

const VIOLATION_LABELS: Record<ViolationType, string> = {
  profanity: 'Мат',
  advertising: 'Реклама',
  other: 'Другое',
};

interface AdminPanelProps {
  onBack: () => void;
  onDefaultThemeChange?: (theme: ThemeId) => void;
}

type AdminSection = 'users' | 'rooms' | 'news' | 'violations' | 'system';

export default function AdminPanel({ onBack, onDefaultThemeChange }: AdminPanelProps) {
  const [section, setSection] = useState<AdminSection>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', city: '', bio: '' });
  const [newRoomName, setNewRoomName] = useState('');
  const [roomEdits, setRoomEdits] = useState<Record<number, string>>({});
  const dirtyRoomsRef = useRef(new Set<number>());
  const roomEditsInitializedRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsForm, setNewsForm] = useState<NewsEditorValue>({
    title: '',
    body: '',
    coverImage: null,
    isPublished: true,
    isFeatured: false,
  });
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

  const load = async ({ silent = false, syncRoomNames = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOverview();
      setUsers(data.users || []);
      setRooms(data.rooms || []);

      if (!roomEditsInitializedRef.current || syncRoomNames) {
        const edits: Record<number, string> = {};
        (data.rooms || []).forEach((r) => {
          edits[r.id] = r.name;
        });
        setRoomEdits(edits);
        dirtyRoomsRef.current.clear();
        roomEditsInitializedRef.current = true;
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
    if (section !== 'system') return;
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
    void loadViolations();
  }, [section]);

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
    if (section === 'news') void loadNews();
    if (section === 'violations') void loadViolations();
  }, [section]);

  const openEditUser = (u: User) => {
    setEditUser(u);
    setEditForm({
      displayName: u.displayName || '',
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

  const handleRoleChange = async (userId: number, role: 'user' | 'moderator') => {
    try {
      await adminSetUserRole(userId, role);
      await load();
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

  const handleRoomNameKeyDown = (e: KeyboardEvent<HTMLInputElement>, roomId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleRenameRoom(roomId);
    }
  };

  const handleCreateChatRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      await adminCreateChatRoom(newRoomName.trim());
      setNewRoomName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
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

  const handleBan = async () => {
    if (!banTarget) return;
    try {
      await adminBan(banTarget.id, banReason, banHours ? Number(banHours) : null);
      setBanTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка бана');
    }
  };

  const handleUnban = async (userId: number) => {
    try {
      await adminUnban(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбана');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Удалить пользователя и его профиль?')) return;
    try {
      await adminDeleteUser(userId);
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
    setNewsForm({ title: '', body: '', coverImage: null, isPublished: true, isFeatured: false });
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
    setNewsForm({
      title: item.title,
      body: item.body,
      coverImage: item.coverImage ?? null,
      isPublished: item.isPublished,
      isFeatured: !!item.isFeatured,
    });
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
      (u.city || '').toLowerCase().includes(q) ||
      (u.isAdmin ? 'admin' : u.isModerator ? 'mod moderator' : 'user').includes(q)
    );
  });

  const gameRooms = rooms.filter((r) => r.kind !== 'chat');
  const chatRooms = rooms.filter((r) => r.kind === 'chat');
  const telegramBotLink = telegramForm.botUsername
    ? `https://t.me/${telegramForm.botUsername.replace(/^@/, '')}`
    : '';

  if (loading && users.length === 0) {
    return <div className="admin-page"><p className="muted">Загрузка...</p></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>🛡️ Панель администратора</h2>
        <div className="admin-header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>Обновить</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>Назад</button>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="admin-layout">
        <aside className="admin-nav" aria-label="Разделы админки">
          <button type="button" className={section === 'users' ? 'active' : ''} onClick={() => setSection('users')}>
            Пользователи
          </button>
          <button type="button" className={section === 'rooms' ? 'active' : ''} onClick={() => setSection('rooms')}>
            Комнаты
          </button>
          <button type="button" className={section === 'news' ? 'active' : ''} onClick={() => setSection('news')}>
            Новости
          </button>
          <button
            type="button"
            className={section === 'violations' ? 'active' : ''}
            onClick={() => setSection('violations')}
          >
            Лог нарушений
          </button>
          <button type="button" className={section === 'system' ? 'active' : ''} onClick={() => setSection('system')}>
            Система
          </button>
        </aside>

        <div className="admin-content">
          {section === 'users' && (
            <section className="admin-section">
              <h3>Управление пользователями ({filteredUsers.length}{userSearch ? ` из ${users.length}` : ''})</h3>
              <div className="admin-search-row">
                <input
                  type="search"
                  className="admin-search-input"
                  placeholder="Поиск по логину, имени, городу или роли..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Игрок</th>
                      <th>Роль</th>
                      <th>Город</th>
                      <th>Очки</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted">Ничего не найдено</td>
                      </tr>
                    )}
                    {filteredUsers.map((u) => (
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
                              <span className="muted">@{u.username}</span>
                              {u.isAdmin && <span className="admin-badge">admin</span>}
                              {u.isModerator && <span className="mod-badge">mod</span>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.isAdmin ? (
                            <span className="muted">—</span>
                          ) : (
                            <select
                              className="admin-role-select"
                              value={u.isModerator ? 'moderator' : 'user'}
                              onChange={(e) =>
                                void handleRoleChange(u.id, e.target.value as 'user' | 'moderator')
                              }
                            >
                              <option value="user">игрок</option>
                              <option value="moderator">модер</option>
                            </select>
                          )}
                        </td>
                        <td>{u.city || '—'}</td>
                        <td>{u.totalScore}</td>
                        <td>
                          {u.isBanned ? (
                            <span className="status-banned">🚫 бан</span>
                          ) : (
                            <span className="status-ok">активен</span>
                          )}
                        </td>
                        <td className="admin-actions">
                          <button type="button" className="btn btn-sm" onClick={() => openEditUser(u)}>
                            Профиль
                          </button>
                          {!u.isAdmin && !u.isModerator && !u.isBanned && (
                            <button type="button" className="btn btn-sm danger" onClick={() => setBanTarget(u)}>
                              Бан
                            </button>
                          )}
                          {u.isBanned && (
                            <button type="button" className="btn btn-sm" onClick={() => void handleUnban(u.id)}>
                              Разбан
                            </button>
                          )}
                          {!u.isAdmin && (
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void handleDeleteUser(u.id)}>
                              Удалить
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'rooms' && (
            <section className="admin-section">
              <h3>Игровая комната (Мафия)</h3>
              <div className="admin-room-list">
                {gameRooms.map((r) => (
                  <div key={r.id} className="admin-room-row">
                    <input
                      type="text"
                      value={roomEdits[r.id] ?? r.name}
                      onChange={(e) => handleRoomNameChange(r.id, e.target.value)}
                      onKeyDown={(e) => handleRoomNameKeyDown(e, r.id)}
                      maxLength={50}
                    />
                    <span className="muted room-meta">
                      {r.playerCount}/{r.maxPlayers} · {r.phase}
                    </span>
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
                  </div>
                ))}
              </div>

              <h3 className="admin-subsection-title">Чат-комнаты</h3>
              <div className="admin-room-list">
                {chatRooms.length === 0 && <p className="muted">Чат-комнат пока нет</p>}
                {chatRooms.map((r) => (
                  <div key={r.id} className="admin-room-row">
                    <input
                      type="text"
                      value={roomEdits[r.id] ?? r.name}
                      onChange={(e) => handleRoomNameChange(r.id, e.target.value)}
                      onKeyDown={(e) => handleRoomNameKeyDown(e, r.id)}
                      maxLength={50}
                    />
                    <span className="muted room-meta">
                      {r.playerCount} онлайн
                    </span>
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
                ))}
              </div>
              <form className="admin-add-room" onSubmit={handleCreateChatRoom}>
                <input
                  type="text"
                  placeholder="Название новой чат-комнаты"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={50}
                />
                <button type="submit" className="btn btn-primary">+ Создать чат-комнату</button>
              </form>
            </section>
          )}

          {section === 'news' && (
            <section className="admin-section">
              <div className="admin-section-head">
                <h3>Новости ({newsPosts.length})</h3>
                {!showNewsEditor && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditNews(null);
                      setNewsForm({
                        title: '',
                        body: '',
                        coverImage: null,
                        isPublished: true,
                        isFeatured: false,
                      });
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
                      <button type="button" className="btn btn-sm" onClick={() => handleEditNews(item)}>
                        Редактировать
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => void handleToggleNewsPublished(item)}>
                        {item.isPublished ? 'Снять с публикации' : 'Опубликовать'}
                      </button>
                      <button type="button" className="btn btn-sm danger" onClick={() => void handleDeleteNews(item.id)}>
                        Удалить
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {section === 'violations' && (
            <section className="admin-section">
              <div className="admin-section-head">
                <h3>Лог нарушений ({violations.length})</h3>
                <button
                  type="button"
                  className="btn btn-sm danger"
                  onClick={() => void handleClearViolations()}
                  disabled={violations.length === 0}
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
          )}

          {section === 'system' && (
            <AdminSystemSection
              usersCount={users.length}
              roomsCount={rooms.length}
              gameRoomsCount={gameRooms.length}
              chatRoomsCount={chatRooms.length}
              violationsCount={violations.length}
              onSync={() => void load({ syncRoomNames: true })}
              defaultTheme={defaultTheme}
              themeSaving={themeSaving}
              onThemeChange={(id) => void handleDefaultThemeChange(id)}
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
            />
          )}
        </div>
      </div>

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Редактировать: {editUser.username}</h3>

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

            <label>
              Имя
              <input
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                maxLength={30}
              />
            </label>
            <label>
              Город
              <input
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                maxLength={50}
              />
            </label>
            <label>
              О себе
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                maxLength={500}
                rows={3}
              />
            </label>
            <div className="profile-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)}>Отмена</button>
              <button type="button" className="btn btn-primary" onClick={() => void handleSaveUser()}>Сохранить</button>
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
              Часов (пусто = навсегда)
              <input
                type="number"
                min="1"
                value={banHours}
                onChange={(e) => setBanHours(e.target.value)}
                placeholder="24"
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
