import { useEffect, useState, useRef } from 'react';
import {
  avatarUrl,
  fetchAdminOverview,
  adminBan,
  adminUnban,
  adminDeleteUser,
  adminDeleteMessage,
  adminRenameRoom,
  adminCreateRoom,
  adminDeleteRoom,
  adminUpdateUser,
  adminUploadUserAvatar,
  adminRemoveUserAvatar,
} from '../api.js';

export default function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [gameEvents, setGameEvents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ displayName: '', city: '', bio: '' });
  const [newRoomName, setNewRoomName] = useState('');
  const [roomEdits, setRoomEdits] = useState({});
  const dirtyRoomsRef = useRef(new Set());
  const avatarInputRef = useRef(null);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOverview();
      setUsers(data.users || []);
      setMessages(data.messages || []);
      setGameEvents(data.gameEvents || []);
      setRooms(data.rooms || []);
      setRoomEdits((prev) => {
        const edits = { ...prev };
        (data.rooms || []).forEach((r) => {
          if (!dirtyRoomsRef.current.has(r.id)) {
            edits[r.id] = r.name;
          }
        });
        return edits;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load({ silent: true }), 10000);
    return () => clearInterval(id);
  }, []);

  const openEditUser = (u) => {
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
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUserAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editUser) return;
    try {
      await adminUploadUserAvatar(editUser.id, file);
      load();
      const data = await fetchAdminOverview();
      const updated = data.users.find((u) => u.id === editUser.id);
      if (updated) setEditUser(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!editUser) return;
    try {
      await adminRemoveUserAvatar(editUser.id);
      load();
      setEditUser({ ...editUser, avatar: null });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRenameRoom = async (roomId) => {
    const name = roomEdits[roomId]?.trim();
    if (!name) {
      setError('Название не может быть пустым');
      return;
    }
    try {
      await adminRenameRoom(roomId, name);
      dirtyRoomsRef.current.delete(roomId);
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRoomNameChange = (roomId, value) => {
    setRoomEdits((prev) => ({ ...prev, [roomId]: value }));
    dirtyRoomsRef.current.add(roomId);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      await adminCreateRoom(newRoomName.trim());
      setNewRoomName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRoom = async (roomId, name) => {
    if (!confirm(`Удалить комнату «${name}»? Игроки будут выгнаны.`)) return;
    try {
      await adminDeleteRoom(roomId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBan = async () => {
    if (!banTarget) return;
    try {
      await adminBan(banTarget.id, banReason, banHours ? Number(banHours) : null);
      setBanTarget(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnban = async (userId) => {
    try {
      await adminUnban(userId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Удалить пользователя и его профиль?')) return;
    try {
      await adminDeleteUser(userId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMsg = async (msg) => {
    try {
      await adminDeleteMessage(msg.roomId, msg.id, msg.channel);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const eventLabel = (type) => {
    if (type === 'registration_start') return '📝 Регистрация';
    if (type === 'game_start') return '🎮 Старт игры';
    if (type === 'game_end') return '🏁 Конец игры';
    return type;
  };

  const roomNameById = (id) => rooms.find((r) => r.id === id)?.name || `Комната ${id}`;

  if (loading && users.length === 0) {
    return <div className="admin-page"><p className="muted">Загрузка...</p></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>🛡️ Панель администратора</h2>
        <div className="admin-header-actions">
          <button type="button" className="btn btn-ghost" onClick={load}>Обновить</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>Назад</button>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <section className="admin-section">
        <h3>Управление комнатами</h3>
        <div className="admin-room-list">
          {rooms.map((r) => (
            <div key={r.id} className="admin-room-row">
              <input
                type="text"
                value={roomEdits[r.id] ?? r.name}
                onChange={(e) => handleRoomNameChange(r.id, e.target.value)}
                maxLength={50}
              />
              <span className="muted room-meta">
                {r.playerCount}/{r.maxPlayers} · {r.phase}
              </span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => handleRenameRoom(r.id)}>
                Сохранить
              </button>
              <button
                type="button"
                className="btn btn-sm danger"
                onClick={() => handleDeleteRoom(r.id, r.name)}
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

      <section className="admin-section">
        <h3>Пользователи ({users.length})</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Игрок</th>
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
                        <img src={avatarUrl(u.avatar)} alt="" className="admin-avatar" />
                      ) : (
                        <span className="admin-avatar placeholder">👤</span>
                      )}
                      <div>
                        <strong>{u.displayName}</strong>
                        <span className="muted">@{u.username}</span>
                        {u.isAdmin && <span className="admin-badge">admin</span>}
                      </div>
                    </div>
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
                    {!u.isAdmin && !u.isBanned && (
                      <button type="button" className="btn btn-sm danger" onClick={() => setBanTarget(u)}>
                        Бан
                      </button>
                    )}
                    {u.isBanned && (
                      <button type="button" className="btn btn-sm" onClick={() => handleUnban(u.id)}>
                        Разбан
                      </button>
                    )}
                    {!u.isAdmin && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleDeleteUser(u.id)}>
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
                <button type="button" className="btn btn-sm danger" onClick={() => handleDeleteMsg(msg)}>
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Редактировать: {editUser.username}</h3>

            <div className="profile-avatar-block">
              {editUser.avatar ? (
                <img src={avatarUrl(editUser.avatar)} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder">👤</div>
              )}
              <div>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleUserAvatar} hidden id="admin-avatar" />
                <label htmlFor="admin-avatar" className="btn btn-ghost">Заменить аватар</label>
                {editUser.avatar && (
                  <button type="button" className="btn btn-sm danger" onClick={handleRemoveAvatar}>
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
              <button type="button" className="btn btn-primary" onClick={handleSaveUser}>Сохранить</button>
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
              <button type="button" className="btn btn-primary danger" onClick={handleBan}>Забанить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
