import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  adminRemoveSiteLogo,
  adminSetSiteBranding,
  adminUploadSiteLogo,
  avatarUrl,
  fetchSiteBranding,
} from '../api';
import type { SiteBranding } from '../types';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';

interface AdminSiteBrandingEditorProps {
  onBrandingChange?: (branding: SiteBranding) => void;
}

export default function AdminSiteBrandingEditor({ onBrandingChange }: AdminSiteBrandingEditorProps) {
  const [branding, setBranding] = useState<SiteBranding>(DEFAULT_SITE_BRANDING);
  const [draft, setDraft] = useState({
    logoText: DEFAULT_SITE_BRANDING.logoText,
    logoMark: DEFAULT_SITE_BRANDING.logoMark,
    footerText: DEFAULT_SITE_BRANDING.footerText,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSiteBranding();
      setBranding(data);
      setDraft({
        logoText: data.logoText,
        logoMark: data.logoMark,
        footerText: data.footerText,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const applyBranding = (next: SiteBranding) => {
    setBranding(next);
    onBrandingChange?.(next);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { branding: saved } = await adminSetSiteBranding(draft);
      applyBranding(saved);
      setDraft({
        logoText: saved.logoText,
        logoMark: saved.logoMark,
        footerText: saved.footerText,
      });
      setSuccess('Сохранено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploading(true);
    setError('');
    setSuccess('');
    try {
      const { branding: saved } = await adminUploadSiteLogo(file);
      applyBranding(saved);
      setSuccess('Логотип загружен');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки логотипа');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUploading(true);
    setError('');
    setSuccess('');
    try {
      const { branding: saved } = await adminRemoveSiteLogo();
      applyBranding(saved);
      setSuccess('Изображение логотипа удалено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setLogoUploading(false);
    }
  };

  if (loading) return <p className="muted">Загрузка настроек оформления...</p>;

  const logoSrc = avatarUrl(branding.logoUrl);

  return (
    <form className="admin-site-branding" onSubmit={handleSave}>
      <h4 className="admin-branding-section-title">Логотип</h4>
      <p className="theme-settings-hint">
        Загрузите картинку или оставьте символ и текст. Логотип показывается в меню и на странице входа.
      </p>

      <div className="admin-branding-logo-preview">
        {logoSrc ? (
          <img src={logoSrc} alt="" className="admin-branding-logo-image" />
        ) : (
          <span className="admin-branding-logo-mark">{draft.logoMark || '♠'}</span>
        )}
        <span className="admin-branding-logo-text">{draft.logoText || 'Mafia'}</span>
      </div>

      <div className="admin-branding-logo-actions">
        <label className="btn btn-sm btn-ghost admin-branding-file-label">
          {logoUploading ? 'Загрузка...' : 'Загрузить изображение'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={(e) => void handleLogoUpload(e)}
            disabled={logoUploading || saving}
            hidden
          />
        </label>
        {branding.logoUrl && (
          <button
            type="button"
            className="btn btn-sm btn-ghost danger"
            onClick={() => void handleRemoveLogo()}
            disabled={logoUploading || saving}
          >
            Удалить изображение
          </button>
        )}
      </div>

      <label>
        Текст логотипа
        <input
          type="text"
          value={draft.logoText}
          onChange={(e) => setDraft((prev) => ({ ...prev, logoText: e.target.value }))}
          maxLength={40}
          required
        />
      </label>

      <label>
        Символ без картинки
        <input
          type="text"
          value={draft.logoMark}
          onChange={(e) => setDraft((prev) => ({ ...prev, logoMark: e.target.value }))}
          maxLength={8}
          placeholder="♠"
        />
      </label>

      <h4 className="admin-branding-section-title">Футер сайта</h4>
      <p className="theme-settings-hint">
        Текст внизу страниц. Оставьте пустым, чтобы скрыть футер. Можно использовать несколько строк.
      </p>
      <label>
        Текст футера
        <textarea
          value={draft.footerText}
          onChange={(e) => setDraft((prev) => ({ ...prev, footerText: e.target.value }))}
          rows={4}
          maxLength={500}
          placeholder="© 2026 Мафия онлайн"
        />
      </label>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <div className="profile-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || logoUploading}>
          {saving ? 'Сохранение...' : 'Сохранить оформление'}
        </button>
      </div>
    </form>
  );
}
