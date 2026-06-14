import { useEffect, useState, useRef, FormEvent, ChangeEvent, KeyboardEvent } from 'react';
import {
  avatarUrl,
  fetchAdminOverview,
  adminBan,
  adminUnban,
  adminDeleteUser,
  adminDeleteMessage,
  adminClearRoomMessages,
  adminRenameRoom,
  adminCreateRoom,
  adminDeleteRoom,
  adminUpdateUser,
  adminSetUserRole,
  adminUploadUserAvatar,
  adminRemoveUserAvatar,
  type AdminGameEvent,
  type AdminMessage,
  type AdminRoom,
} from '../api';
import type { User } from '../types';

interface AdminPanelProps {
  onBack: () => void;
}

type AdminSection = 'users' | 'rooms' | 'messages' | 'system';

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [section, setSection] = useState<AdminSection>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [gameEvents, setGameEvents] = useState<AdminGameEvent[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', city: '', bio: '' });
  const [newRoomName, setNewRoomName] = useState('');
  const [roomEdits, setRoomEdits] = useState<Record<number, string>>({});
  const dirtyRoomsRef = useRef(new Set<number>());
  const roomEditsInitializedRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const load = async ({ silent = false, syncRoomNames = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOverview();
      setUsers(data.users || []);
      setMessages(data.messages || []);
      setGameEvents(data.gameEvents || []);
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

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      await adminCreateRoom(newRoomName.trim());
      setNewRoomName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  };

  const handleDeleteRoom = async (roomId: number, name: string) => {
    if (!confirm(`Удалить комнату «${name}»? Игроки будут выгнаны.`)) return;
    try {
      await adminDeleteRoom(roomId);
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

  const handleDeleteMsg = async (msg: AdminMessage) => {
    try {
      await adminDeleteMessage(msg.roomId, msg.id, msg.channel);
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

  const eventLabel = (type: string) => {
    if (type === 'registration_start') return '📝 Регистрация';
    if (type === 'game_start') return '🎮 Старт игры';
    if (type === 'game_end') return '🏁 Конец игры';
    return type;
  };

  const roomNameById = (id: number) => rooms.find((r) => r.id === id)?.name || `Комната ${id}`;

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
          <button type="button" className={section === 'messages' ? 'active' : ''} onClick={() => setSection('messages')}>
            Очистка сообщений
          </button>
          <button type="button" className={section === 'system' ? 'active' : ''} onClick={() => setSection('system')}>
            Система и настройки
          </button>
        </aside>

        <div className="admin-content">
          {section === 'users' && (
            <section className="admin-section">
              <h3>Управление пользователями ({users.length})</h3>
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
                    {users.map((u) => (
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
              <h3>Управление комнатами</h3>
              <div className="admin-room-list">
                {rooms.map((r) => (
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
                      className="btn btn-sm danger"
                      onClick={() => void handleDeleteRoom(r.id, r.name)}
                      disabled={rooms.length <= 1}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
              <form className="admin-add-room" onSubmit={handleCreateRoom}>
                <input
                  type="text"
                  placeholder="Название новой комнаты"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={50}
                />
                <button type="submit" className="btn btn-primary">+ Создать комнату</button>
              </form>
            </section>
          )}

          {section === 'messages' && (
            <>
              <section className="admin-section">
                <h3>Очистка комнат от сообщений</h3>
                <div className="admin-clear-grid">
                  {rooms.map((room) => (
                    <div key={room.id} className="admin-clear-card">
                      <div>
                        <strong>{room.name}</strong>
                        <span className="muted">{room.playerCount}/{room.maxPlayers} · {room.phase}</span>
                      </div>
                      <button type="button" className="btn btn-sm danger" onClick={() => void handleClearRoomMessages(room.id, room.name)}>
                        Очистить чат
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="admin-section">
                <h3>Последние сообщения ({messages.length})</h3>
                <div className="admin-messages">
                  {messages.length === 0 && <p className="muted">Сообщений пока нет</p>}
                  {messages.map((msg) => (
                    <div key={`${msg.roomId}-${msg.id}`} className={`admin-msg ${msg.deleted ? 'deleted' : ''}`}>
                      <div className="admin-msg-meta">
                        <span>{msg.roomName}</span>
                        <span>
                          {msg.channel === 'mafia' ? '🔫 мафия' : msg.channel === 'dead' ? '💀 выбывшие' : msg.channel === 'spectator' ? '👁 наблюдатели' : '💬 общий'}
                        </span>
                        <span>{new Date(msg.time).toLocaleString('ru-RU')}</span>
                      </div>
                      <div className="admin-msg-body">
                        <strong>{msg.playerName}:</strong> {msg.text}
                      </div>
                      {!msg.deleted && (
                        <button type="button" className="btn btn-sm danger" onClick={() => void handleDeleteMsg(msg)}>
                          Удалить
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {section === 'system' && (
            <>
              <section className="admin-section">
                <h3>Управление системой</h3>
                <div className="admin-system-grid">
                  <div className="admin-system-card">
                    <span className="muted">Пользователей</span>
                    <strong>{users.length}</strong>
                  </div>
                  <div className="admin-system-card">
                    <span className="muted">Комнат</span>
                    <strong>{rooms.length}</strong>
                  </div>
                  <div className="admin-system-card">
                    <span className="muted">Последних сообщений</span>
                    <strong>{messages.length}</strong>
                  </div>
                  <div className="admin-system-card">
                    <span className="muted">Событий игр</span>
                    <strong>{gameEvents.length}</strong>
                  </div>
                </div>
                <div className="admin-settings-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void load({ syncRoomNames: true })}>
                    Синхронизировать данные
                  </button>
                </div>
              </section>

              <section className="admin-section">
                <h3>История игр ({gameEvents.length})</h3>
                <div className="admin-game-events">
                  {gameEvents.length === 0 && <p className="muted">Запусков игр пока нет</p>}
                  {gameEvents.map((ev) => (
                    <div key={ev.id} className="admin-game-event">
                      <span className="admin-game-event-type">{eventLabel(ev.eventType)}</span>
                      <span>{roomNameById(ev.roomId)}</span>
                      {ev.payload?.playerCount != null && (
                        <span className="muted">{ev.payload.playerCount} игроков</span>
                      )}
                      {ev.payload?.winnerTeam && (
                        <span className="muted">победа: {ev.payload.winnerTeam}</span>
                      )}
                      <span className="muted">{new Date(ev.time).toLocaleString('ru-RU')}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
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
