import { FormEvent, useEffect, useState } from 'react';
import { adminSetLobbyAnnouncement, fetchThemeSettings } from '../api';
import type { LobbyAnnouncement } from '../types';

interface AdminLobbyAnnouncementEditorProps {
  onAnnouncementChange?: (announcement: LobbyAnnouncement) => void;
}

const EMPTY_ANNOUNCEMENT: LobbyAnnouncement = {
  enabled: false,
  text: '',
};

export default function AdminLobbyAnnouncementEditor({
  onAnnouncementChange,
}: AdminLobbyAnnouncementEditorProps) {
  const [draft, setDraft] = useState<LobbyAnnouncement>(EMPTY_ANNOUNCEMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchThemeSettings()
      .then(({ lobbyAnnouncement }) => {
        if (cancelled) return;
        setDraft(lobbyAnnouncement);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { lobbyAnnouncement } = await adminSetLobbyAnnouncement(draft);
      setDraft(lobbyAnnouncement);
      onAnnouncementChange?.(lobbyAnnouncement);
      setSuccess('Объявление опубликовано');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="muted">Загрузка...</p>;
  }

  return (
    <form className="theme-settings-block admin-theme-block" onSubmit={(e) => void handleSave(e)}>
      <p className="theme-settings-hint">
        Объявление показывается на главной странице комнат под заголовком «Мафия — Выберите комнату
        для игры».
      </p>

      <label className="theme-use-default">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
          disabled={saving}
        />
        <span>Показывать объявление</span>
      </label>

      <label>
        Текст объявления
        <textarea
          value={draft.text}
          onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
          placeholder="Например: сегодня турнир в комнате №1 в 20:00"
          rows={5}
          maxLength={500}
          disabled={saving}
        />
      </label>

      {draft.enabled && draft.text.trim() && (
        <div className="lobby-announcement lobby-announcement-preview" aria-hidden="true">
          <span className="lobby-announcement-icon">📢</span>
          <p>{draft.text}</p>
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
      {success && <p className="muted">{success}</p>}

      <div className="profile-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить объявление'}
        </button>
      </div>
    </form>
  );
}
