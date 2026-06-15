import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { avatarUrl, updateProfile, uploadAvatar } from '../api';
import Messages from './Messages';
import type { User } from '../types';

const CHAT_LIMIT_OPTIONS = [15, 30, 50, 100];

type ProfileTab = 'settings' | 'messages';

interface ProfileProps {
  user: User;
  onUpdate: (user: User) => void;
  onBack: () => void;
  initialTab?: ProfileTab;
  composeToUserId?: number | null;
  composeToUsername?: string | null;
  onUnreadChange?: (count: number) => void;
}

export default function Profile({
  user,
  onUpdate,
  onBack,
  initialTab = 'settings',
  composeToUserId = null,
  composeToUsername = null,
  onUnreadChange,
}: ProfileProps) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    city: user.city || '',
    bio: user.bio || '',
    chatLimit: user.chatLimit ?? 15,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { user: updated } = await updateProfile(form);
      onUpdate(updated);
      setSuccess('Профиль сохранён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setError('');
    try {
      const { user: updated } = await uploadAvatar(file);
      onUpdate(updated);
      setSuccess('Аватар обновлён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setAvatarLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2>Мой профиль</h2>

        <div className="profile-tabs">
          <button
            type="button"
            className={tab === 'settings' ? 'active' : ''}
            onClick={() => setTab('settings')}
          >
            Настройки
          </button>
          <button
            type="button"
            className={tab === 'messages' ? 'active' : ''}
            onClick={() => setTab('messages')}
          >
            ✉️ Письма
          </button>
        </div>

        {tab === 'settings' && (
          <>
            <div className="profile-avatar-block">
              <div className="profile-avatar-wrap">
                {user.avatar ? (
                  <img src={avatarUrl(user.avatar) ?? undefined} alt="Аватар" className="profile-avatar" />
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
              <label>
                Сообщений в чате комнаты
                <select
                  value={form.chatLimit}
                  onChange={(e) => setForm({ ...form, chatLimit: Number(e.target.value) })}
                >
                  {CHAT_LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} последних
                    </option>
                  ))}
                </select>
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
          </>
        )}

        {tab === 'messages' && (
          <Messages
            composeToUserId={composeToUserId}
            composeToUsername={composeToUsername}
            onUnreadChange={onUnreadChange}
          />
        )}
      </div>
    </div>
  );
}
