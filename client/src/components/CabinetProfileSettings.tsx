import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { avatarUrl, updateProfile, uploadAvatar } from '../api';
import type { User } from '../types';

const CHAT_LIMIT_OPTIONS = [15, 30, 50, 100];

interface CabinetProfileSettingsProps {
  user: User;
  onUpdate: (user: User) => void;
  onBack: () => void;
}

export default function CabinetProfileSettings({
  user,
  onUpdate,
  onBack,
}: CabinetProfileSettingsProps) {
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
      setSuccess('Настройки сохранены');
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
    <div className="cabinet-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="page-header">
        <h1>👤 Личные настройки</h1>
        <p className="muted">Профиль, аватар и параметры чата</p>
      </header>

      <div className="profile-card cabinet-card">
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
              id="cabinet-avatar-upload"
            />
            <label htmlFor="cabinet-avatar-upload" className="btn btn-ghost btn-sm">
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
            Имя
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
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
