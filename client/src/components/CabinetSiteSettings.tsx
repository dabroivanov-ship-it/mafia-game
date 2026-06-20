import { useState, useEffect } from 'react';
import { updateProfile, fetchThemeSettings } from '../api';
import type { User, ThemeId } from '../types';
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

  const handleUseSiteTheme = () => {
    setUseSiteTheme(true);
    applyTheme(siteDefaultTheme);
    void saveTheme(null);
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
        <h1>🎨 Оформление сайта</h1>
        <p className="muted">Выберите тему — изменения применяются сразу</p>
      </header>

      <div className="profile-card cabinet-card">
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <div className="theme-settings-block">
          <p className="theme-settings-hint">
            «Как на сайте» — общая тема проекта ({themeName(siteDefaultTheme)}). Личная тема
            сохраняется только для вашего аккаунта.
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
        </div>
      </div>
    </div>
  );
}
