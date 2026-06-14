import { useEffect, useState } from 'react';
import {
  avatarUrl,
  fetchUserProfile,
  fetchUserMessages,
  adminBan,
  adminUnban,
  adminDeleteUser,
  adminUpdateUser,
} from '../api.js';

const MESSAGE_LIMITS = [15, 30, 50, 100];

export default function UserProfileModal({ userId, viewerIsAdmin, onClose, onAdminAction }) {  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', city: '', bio: '' });
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');
  const [showBanForm, setShowBanForm] = useState(false);
  const [messageLimit, setMessageLimit] = useState(15);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchUserProfile(userId);
      setData(res);
      setEditForm({
        displayName: res.user.displayName || '',
        city: res.user.city || '',
        bio: res.user.bio || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setMessagesLoading(true);
    fetchUserMessages(userId, messageLimit)
      .then(({ messages: list }) => {
        if (!cancelled) setMessages(list || []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, messageLimit]);
  const handleSave = async () => {
    try {
      await adminUpdateUser(userId, editForm);
      setEditMode(false);
      await load();
      onAdminAction?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBan = async () => {
    try {
      await adminBan(userId, banReason, banHours ? Number(banHours) : null);
      setShowBanForm(false);
      await load();
      onAdminAction?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnban = async () => {
    try {
      await adminUnban(userId);
      await load();
      onAdminAction?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить пользователя и его профиль?')) return;
    try {
      await adminDeleteUser(userId);
      onAdminAction?.();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const user = data?.user;
  const canAdmin = data?.canAdmin && viewerIsAdmin;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <h3>Профиль игрока</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {loading && <p className="muted">Загрузка...</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && user && (
          <>
            <div className="profile-avatar-block">
              {user.avatar ? (
                <img src={avatarUrl(user.avatar)} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder">👤</div>
              )}
              <div className="profile-avatar-info">
                <strong>{user.displayName}</strong>
                <p className="muted">@{user.username}</p>
                {user.isAdmin && <span className="admin-badge">admin</span>}
              </div>
            </div>

            {!editMode ? (
              <>
                <div className="profile-stats">
                  <span>🏆 {user.totalScore} очков</span>
                  {user.city && <span>📍 {user.city}</span>}
                  <span>📅 с {new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
                {user.bio && <p className="profile-bio">{user.bio}</p>}
                {user.isBanned && (
                  <div className="auth-error">
                    Заблокирован{user.banReason ? `: ${user.banReason}` : ''}
                  </div>
                )}

                <section className="profile-messages profile-messages-compact">
                  <div className="profile-messages-header">
                    <h4>Сообщения в чате</h4>
                    <label className="profile-messages-limit">
                      Показать
                      <select
                        value={messageLimit}
                        onChange={(e) => setMessageLimit(Number(e.target.value))}
                      >
                        {MESSAGE_LIMITS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {messagesLoading && <p className="muted small">Загрузка...</p>}
                  {!messagesLoading && messages.length === 0 && (
                    <p className="muted small">Сообщений нет.</p>
                  )}
                  {!messagesLoading && messages.length > 0 && (
                    <ul className="profile-messages-list">
                      {messages.map((msg) => (
                        <li key={msg.id} className="profile-message-item">
                          <span className="profile-message-meta">
                            {new Date(msg.time).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="profile-message-text">{msg.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>            ) : (
              <div className="auth-form">
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
                  <button type="button" className="btn btn-ghost" onClick={() => setEditMode(false)}>
                    Отмена
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSave}>
                    Сохранить
                  </button>
                </div>
              </div>
            )}

            {canAdmin && !editMode && (
              <div className="admin-profile-actions">
                <h4>Администрирование</h4>
                <div className="admin-profile-buttons">
                  <button type="button" className="btn btn-sm" onClick={() => setEditMode(true)}>
                    Редактировать
                  </button>
                  {!user.isBanned ? (
                    <button type="button" className="btn btn-sm danger" onClick={() => setShowBanForm(true)}>
                      Забанить
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={handleUnban}>
                      Разбанить
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={handleDelete}>
                    Удалить
                  </button>
                </div>

                {showBanForm && (
                  <div className="ban-form">
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
                      <button type="button" className="btn btn-ghost" onClick={() => setShowBanForm(false)}>
                        Отмена
                      </button>
                      <button type="button" className="btn btn-primary danger" onClick={handleBan}>
                        Забанить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
