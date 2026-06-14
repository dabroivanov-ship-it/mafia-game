import { useState, useRef, useEffect } from 'react';
import { avatarUrl, updateProfile, uploadAvatar, fetchMyMessages } from '../api.js';

const MESSAGE_LIMITS = [15, 30, 50, 100];

export default function Profile({ user, onUpdate, onBack }) {  const [form, setForm] = useState({
    displayName: user.displayName || '',
    city: user.city || '',
    bio: user.bio || '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [messageLimit, setMessageLimit] = useState(15);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setMessagesLoading(true);
    fetchMyMessages(messageLimit)
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
  }, [messageLimit]);
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { user: updated } = await updateProfile(form);
      onUpdate(updated);
      setSuccess('Профиль сохранён');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setError('');
    try {
      const { user: updated } = await uploadAvatar(file);
      onUpdate(updated);
      setSuccess('Аватар обновлён');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2>Мой профиль</h2>

        <div className="profile-avatar-block">
          <div className="profile-avatar-wrap">
            {user.avatar ? (
              <img src={avatarUrl(user.avatar)} alt="Аватар" className="profile-avatar" />
            ) : (
              <div className="profile-avatar placeholder">👤</div>
            )}
          </div>
          <div className="profile-avatar-info">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatar}
              hidden
              id="avatar-upload"
            />
            <label htmlFor="avatar-upload" className="btn btn-ghost btn-sm">
              {avatarLoading ? 'Загрузка...' : 'Сменить аватар'}
            </label>
            <p className="muted small">JPG, PNG, WebP до 2 МБ</p>
          </div>
        </div>

        <div className="profile-stats">
          <span>@{user.username}</span>
          <span>🏆 {user.totalScore} очков</span>
          <span>📅 с {new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form className="auth-form" onSubmit={handleSave}>
          <label>
            Имя в игре
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              maxLength={30}
              required
            />
          </label>
          <label>
            Город
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Москва"
              maxLength={50}
            />
          </label>
          <label>
            О себе
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Расскажите о себе..."
              maxLength={500}
              rows={4}
            />
          </label>
          <div className="profile-actions">
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Назад
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>

        <section className="profile-messages">
          <div className="profile-messages-header">
            <h3>Мои сообщения в чате</h3>
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
            <p className="muted small">Сообщений пока нет.</p>
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
                    {msg.roomId != null && ` · комн. ${msg.roomId}`}
                  </span>
                  <span className="profile-message-text">{msg.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}