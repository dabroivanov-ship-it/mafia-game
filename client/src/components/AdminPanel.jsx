import { useEffect, useState } from 'react';
import {
  avatarUrl,
  fetchAdminOverview,
  adminBan,
  adminUnban,
  adminDeleteUser,
  adminDeleteMessage,
} from '../api.js';

export default function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOverview();
      setUsers(data.users || []);
      setMessages(data.messages || []);
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

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
    if (!confirm('Удалить пользователя?')) return;
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
        <h3>Комнаты ({rooms.length})</h3>
        <div className="admin-rooms">
          {rooms.map((r) => (
            <span key={r.id} className="admin-tag">
              {r.name}: {r.playerCount}/{r.maxPlayers} — {r.phase}
            </span>
          ))}
        </div>
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
        <h3>Последние сообщения ({messages.length})</h3>
        <div className="admin-messages">
          {messages.length === 0 && <p className="muted">Сообщений пока нет</p>}
          {messages.map((msg) => (
            <div key={`${msg.roomId}-${msg.id}`} className={`admin-msg ${msg.deleted ? 'deleted' : ''}`}>
              <div className="admin-msg-meta">
                <span>{msg.roomName}</span>
                <span>{msg.channel === 'mafia' ? '🔫 мафия' : '💬 общий'}</span>
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
              <button type="button" className="btn btn-ghost" onClick={() => setBanTarget(null)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary danger" onClick={handleBan}>
                Забанить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
