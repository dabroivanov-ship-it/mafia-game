import { useState, useEffect } from 'react';
import { updateProfile, fetchThemeSettings } from '../api';
import type { User, ThemeId } from '../types';
import ThemePicker from './ThemePicker';
import { applyTheme, resolveTheme, THEMES } from '../themes';

function themeName(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.name ?? id;
}

interface CabinetSiteSettingsProps {
  user: User;
  onUpdate: (user: User) => void;
  onBack: () => void;
}

export default function CabinetSiteSettings({ user, onUpdate, onBack }: CabinetSiteSettingsProps) {
  const [siteDefaultTheme, setSiteDefaultTheme] = useState<ThemeId>('midnight');
  const [useSiteTheme, setUseSiteTheme] = useState(!user.theme);
  const [personalTheme, setPersonalTheme] = useState<ThemeId>(resolveTheme(user.theme, 'midnight'));
  const [themeSaving, setThemeSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchThemeSettings()
      .then(({ defaultTheme }) => {
        setSiteDefaultTheme(defaultTheme);
        setPersonalTheme(resolveTheme(user.theme, defaultTheme));
        setUseSiteTheme(!user.theme);
      })
      .catch(() => {});
  }, [user.theme]);

  const saveTheme = async (theme: ThemeId | null) => {
    setThemeSaving(true);
    setError('');
    setSuccess('');
    try {
      const { user: updated } = await updateProfile({
        displayName: user.displayName,
        city: user.city,
        bio: user.bio,
        chatLimit: user.chatLimit,
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

  return (
    <div className="cabinet-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="page-header">
        <h1>🎨 Оформление сайта</h1>
        <p className="muted">Цветовая тема интерфейса</p>
      </header>

      <div className="profile-card cabinet-card">
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <div className="theme-settings-block">
          <h3>Тема сайта</h3>
          <p className="theme-settings-hint">
            Сейчас на сайте установлена тема «{themeName(siteDefaultTheme)}». Вы можете
            использовать её или выбрать свою личную.
          </p>
          <label className="theme-use-default">
            <input
              type="checkbox"
              checked={useSiteTheme}
              disabled={themeSaving}
              onChange={(e) => handleUseSiteTheme(e.target.checked)}
            />
            <span>Как на сайте — {themeName(siteDefaultTheme)}</span>
          </label>
        </div>

        {!useSiteTheme && (
          <div className="theme-settings-block">
            <h3>Личная тема</h3>
            <p className="theme-settings-hint">Будет применяться только для вас, независимо от настроек сайта.</p>
            <ThemePicker
              value={personalTheme}
              onChange={handlePersonalTheme}
              disabled={themeSaving}
            />
          </div>
        )}
      </div>
    </div>
  );
}
