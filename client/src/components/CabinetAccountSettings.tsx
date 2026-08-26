import { useState, useEffect, FormEvent } from 'react';
import { updateProfile, fetchThemeSettings, linkTelegramEmail, changePassword } from '../api';
import type { User, ThemeId, UserGender } from '../types';
import { applyTheme, resolveTheme, THEMES, themeDisplayName } from '../themes';
import {
  getMobileNavPlacement,
  setMobileNavPlacement,
  type MobileNavPlacement,
} from '../utils/mobileNav';

const CHAT_LIMIT_OPTIONS = [15, 30, 50, 100];

interface CabinetAccountSettingsProps {
  user: User;
  onUpdate: (user: User) => void;
  onBack: () => void;
  mobileNav?: MobileNavPlacement;
  onMobileNavChange?: (value: MobileNavPlacement) => void;
}

export default function CabinetAccountSettings({
  user,
  onUpdate,
  onBack,
  mobileNav: mobileNavProp,
  onMobileNavChange,
}: CabinetAccountSettingsProps) {
  const [chatLimit, setChatLimit] = useState(user.chatLimit ?? 15);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkForm, setLinkForm] = useState({ email: '', password: '', confirm: '' });
  const [linkLoading, setLinkLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [siteDefaultTheme, setSiteDefaultTheme] = useState<ThemeId>('midnight');
  const [useSiteTheme, setUseSiteTheme] = useState(!user.theme);
  const [personalTheme, setPersonalTheme] = useState<ThemeId>(resolveTheme(user.theme, 'midnight'));
  const [themeSaving, setThemeSaving] = useState(false);
  const [mobileNavLocal, setMobileNavLocal] = useState<MobileNavPlacement>(() => getMobileNavPlacement());
  const mobileNav = mobileNavProp ?? mobileNavLocal;

  const handleMobileNav = (value: MobileNavPlacement) => {
    setMobileNavPlacement(value);
    setMobileNavLocal(value);
    onMobileNavChange?.(value);
    setSuccess(value === 'side' ? 'Меню слева на телефоне' : 'Меню снизу на телефоне');
  };

  useEffect(() => {
    fetchThemeSettings()
      .then(({ defaultTheme }) => {
        setSiteDefaultTheme(defaultTheme);
        setPersonalTheme(resolveTheme(user.theme, defaultTheme));
        setUseSiteTheme(!user.theme);
      })
      .catch(() => {});
  }, [user.theme]);

  const profileBase = () => ({
    displayName: user.displayName,
    gender: (user.gender || '') as UserGender,
    city: user.city,
    bio: user.bio,
    chatLimit,
  });

  const saveTheme = async (theme: ThemeId | null) => {
    setThemeSaving(true);
    setError('');
    setSuccess('');
    try {
      const { user: updated } = await updateProfile({ ...profileBase(), theme });
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

  const handleUseSiteTheme = () => {
    setUseSiteTheme(true);
    applyTheme(siteDefaultTheme);
    void saveTheme(null);
  };

  const handleSaveChatLimit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { user: updated } = await updateProfile(profileBase());
      onUpdate(updated);
      setSuccess('Настройки сохранены');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (linkForm.password.length < 8) {
      setError('Пароль: минимум 8 символов');
      return;
    }
    if (linkForm.password !== linkForm.confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setLinkLoading(true);
    try {
      const { user: updated } = await linkTelegramEmail(linkForm);
      onUpdate(updated);
      setLinkForm({ email: '', password: '', confirm: '' });
      setSuccess('Email и пароль привязаны — теперь можно входить по почте');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка привязки');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (passwordForm.password.length < 8) {
      setError('Новый пароль: минимум 8 символов');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setError('Новые пароли не совпадают');
      return;
    }
    setPasswordLoading(true);
    try {
      const { user: updated } = await changePassword(passwordForm);
      onUpdate(updated);
      setPasswordForm({ currentPassword: '', password: '', confirm: '' });
      setSuccess('Пароль изменён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setPasswordLoading(false);
    }
  };

  const siteTheme = THEMES.find((t) => t.id === siteDefaultTheme) ?? THEMES[0];

  return (
    <div className="cabinet-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="page-header">
        <h1>Настройки</h1>
        <p className="muted">Тема, меню на телефоне, пароль и лимит чата</p>
      </header>

      <div className="profile-card cabinet-card">
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <section className="theme-settings-block">
          <h3>Меню на телефоне</h3>
          <p className="theme-settings-hint">
            На компьютере меню всегда слева. На телефоне можно выбрать нижнюю панель или узкую полоску
            слева с иконками.
          </p>
          <div className="mobile-nav-picker" role="radiogroup" aria-label="Расположение меню на телефоне">
            <button
              type="button"
              role="radio"
              aria-checked={mobileNav === 'bottom'}
              className={`mobile-nav-picker-card ${mobileNav === 'bottom' ? 'active' : ''}`}
              onClick={() => handleMobileNav('bottom')}
            >
              <span className="mobile-nav-picker-preview mobile-nav-picker-preview--bottom" aria-hidden />
              <span className="mobile-nav-picker-name">Снизу</span>
              <span className="mobile-nav-picker-desc">Классическая панель внизу экрана</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mobileNav === 'side'}
              className={`mobile-nav-picker-card ${mobileNav === 'side' ? 'active' : ''}`}
              onClick={() => handleMobileNav('side')}
            >
              <span className="mobile-nav-picker-preview mobile-nav-picker-preview--side" aria-hidden />
              <span className="mobile-nav-picker-name">Слева</span>
              <span className="mobile-nav-picker-desc">Узкая полоска с иконками</span>
            </button>
          </div>
        </section>

        <section className="theme-settings-block">
          <h3>Тема</h3>
          <p className="theme-settings-hint">
            «Как на сайте» — общая тема проекта ({themeDisplayName(siteDefaultTheme)}). Личная тема
            сохраняется только для вашего аккаунта. Изменения применяются сразу.
          </p>

          <div className="theme-picker" role="radiogroup" aria-label="Выбор темы">
            <button
              type="button"
              role="radio"
              aria-checked={useSiteTheme}
              className={`theme-picker-card ${useSiteTheme ? 'active' : ''}`}
              disabled={themeSaving}
              onClick={handleUseSiteTheme}
            >
              <span className="theme-picker-swatches" aria-hidden>
                {siteTheme.preview.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="theme-picker-name">Как на сайте</span>
              <span className="theme-picker-desc">{siteTheme.name} — общая тема</span>
            </button>

            {THEMES.map((theme) => {
              const active = !useSiteTheme && personalTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`theme-picker-card ${active ? 'active' : ''}`}
                  disabled={themeSaving}
                  onClick={() => handlePersonalTheme(theme.id)}
                >
                  <span className="theme-picker-swatches" aria-hidden>
                    {theme.preview.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="theme-picker-name">{theme.name}</span>
                  <span className="theme-picker-desc">{theme.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <form className="auth-form" onSubmit={handleSaveChatLimit}>
          <label>
            Сообщений в чате комнаты
            <select
              value={chatLimit}
              onChange={(e) => setChatLimit(Number(e.target.value))}
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

        {user.needsEmailLink && (
          <section className="cabinet-link-email-block">
            <h3>Привязка email и пароля</h3>
            <p className="muted">
              Вы вошли через Telegram. Привяжите почту и пароль, чтобы входить на сайт без Telegram.
            </p>
            <form className="auth-form" onSubmit={handleLinkEmail}>
              <label>
                Email
                <input
                  type="email"
                  value={linkForm.email}
                  onChange={(e) => setLinkForm({ ...linkForm, email: e.target.value })}
                  placeholder="you@mail.ru"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  value={linkForm.password}
                  onChange={(e) => setLinkForm({ ...linkForm, password: e.target.value })}
                  placeholder="минимум 8 символов"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Повтор пароля
                <input
                  type="password"
                  value={linkForm.confirm}
                  onChange={(e) => setLinkForm({ ...linkForm, confirm: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary" disabled={linkLoading}>
                  {linkLoading ? 'Сохранение...' : 'Привязать email'}
                </button>
              </div>
            </form>
          </section>
        )}

        {!user.needsEmailLink && (
          <section className="cabinet-link-email-block">
            <h3>Смена пароля</h3>
            <p className="muted">Укажите текущий пароль и новый — минимум 8 символов.</p>
            <form className="auth-form" onSubmit={handleChangePassword}>
              <label>
                Текущий пароль
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                Новый пароль
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  placeholder="минимум 8 символов"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Повтор нового пароля
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
                  {passwordLoading ? 'Сохранение...' : 'Сменить пароль'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
