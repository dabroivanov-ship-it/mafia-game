import { useState, useRef, FormEvent, ChangeEvent, useEffect } from 'react';
import { avatarUrl, updateProfile, uploadAvatar, fetchThemeSettings } from '../api';
import type { User, ThemeId } from '../types';
import ThemePicker from './ThemePicker';
import { applyTheme, resolveTheme } from '../themes';

const CHAT_LIMIT_OPTIONS = [15, 30, 50, 100];

interface CabinetSettingsProps {
  user: User;
  onUpdate: (user: User) => void;
  onBack: () => void;
}

export default function CabinetSettings({ user, onUpdate, onBack }: CabinetSettingsProps) {
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    city: user.city || '',
    bio: user.bio || '',
    chatLimit: user.chatLimit ?? 15,
  });
  const [siteDefaultTheme, setSiteDefaultTheme] = useState<ThemeId>('midnight');
  const [useSiteTheme, setUseSiteTheme] = useState(!user.theme);
  const [personalTheme, setPersonalTheme] = useState<ThemeId>(
    resolveTheme(user.theme, 'midnight')
  );
  const [themeSaving, setThemeSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchThemeSettings()
      .then(({ defaultTheme }) => {
        setSiteDefaultTheme(defaultTheme);
        setPersonalTheme(resolveTheme(user.theme, defaultTheme));
        setUseSiteTheme(!user.theme);
      })
      .catch(() => {});
  }, [user.theme]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { user: updated } = await updateProfile({
        ...form,
        theme: useSiteTheme ? null : personalTheme,
      });
      onUpdate(updated);
      setSuccess('Настройки сохранены');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const saveTheme = async (theme: ThemeId | null) => {
    setThemeSaving(true);
    setError('');
    try {
      const { user: updated } = await updateProfile({
        ...form,
        theme,
      });
      onUpdate(updated);
      applyTheme(resolveTheme(updated.theme, siteDefaultTheme));
      setSuccess('Тема сохранена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения темы');
    } finally {
      setThemeSaving(false);
    }
  };

  const handlePersonalTheme = (themeId: ThemeId) => {
    setUseSiteTheme(false);
    setPersonalTheme(themeId);
    applyTheme(themeId);
    void saveTheme(themeId);
  };

  const handleUseSiteTheme = (checked: boolean) => {
    setUseSiteTheme(checked);
    applyTheme(checked ? siteDefaultTheme : personalTheme);
    void saveTheme(checked ? null : personalTheme);
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
        <h1>⚙️ Настройки профиля</h1>
      </header>

      <div className="profile-card cabinet-card">
        <div className="theme-settings-block">
          <h3>🎨 Тема оформления</h3>
          <p className="theme-settings-hint">
            Выберите цветовую схему интерфейса. Можно использовать тему сайта или свою личную.
          </p>
          <label className="theme-use-default">
            <input
              type="checkbox"
              checked={useSiteTheme}
              disabled={themeSaving}
              onChange={(e) => handleUseSiteTheme(e.target.checked)}
            />
            <span>Как на сайте (основная тема)</span>
          </label>
          {!useSiteTheme && (
            <ThemePicker
              value={personalTheme}
              onChange={handlePersonalTheme}
              disabled={themeSaving}
            />
          )}
        </div>

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
