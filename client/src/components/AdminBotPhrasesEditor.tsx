import { FormEvent, useEffect, useMemo, useState } from 'react';
import { adminSaveBotPhrases, fetchAdminBotPhrases, type BotPhraseEntry } from '../api';

export default function AdminBotPhrasesEditor() {
  const [phrases, setPhrases] = useState<BotPhraseEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminBotPhrases();
      setPhrases(res.phrases);
      const next: Record<string, string> = {};
      for (const p of res.phrases) next[p.key] = p.value;
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, BotPhraseEntry[]>();
    for (const phrase of phrases) {
      const list = map.get(phrase.group) || [];
      list.push(phrase);
      map.set(phrase.group, list);
    }
    return [...map.entries()];
  }, [phrases]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminSaveBotPhrases(draft);
      setPhrases(res.phrases);
      const next: Record<string, string> = {};
      for (const p of res.phrases) next[p.key] = p.value;
      setDraft(next);
      setSuccess(res.updated > 0 ? `Сохранено (${res.updated} изменений)` : 'Без изменений');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const resetPhrase = (key: string, defaultValue: string) => {
    setDraft((prev) => ({ ...prev, [key]: defaultValue }));
  };

  if (loading) return <p className="muted">Загрузка фраз...</p>;

  return (
    <form className="admin-bot-phrases" onSubmit={handleSave}>
      <p className="theme-settings-hint">
        Фразы ведущего (🤖) в чате и личных сообщениях. Используйте плейсхолдеры вроде{' '}
        <code>{'{nick}'}</code>, <code>{'{role}'}</code>, <code>{'{day}'}</code>. Для вариантов
        (ночь, атмосфера) — одна фраза на строку.
      </p>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      {grouped.map(([group, items]) => (
        <section key={group} className="admin-bot-phrases-group">
          <h4>{group}</h4>
          {items.map((phrase) => (
            <label key={phrase.key} className="admin-bot-phrase-field">
              <span className="admin-bot-phrase-label">
                {phrase.label}
                {phrase.placeholders?.length ? (
                  <span className="muted admin-bot-phrase-placeholders">
                    {' '}
                    ({phrase.placeholders.join(', ')})
                  </span>
                ) : null}
              </span>
              {phrase.hint && <span className="muted admin-bot-phrase-hint">{phrase.hint}</span>}
              {phrase.type === 'lines' ? (
                <textarea
                  value={draft[phrase.key] ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [phrase.key]: e.target.value }))
                  }
                  rows={4}
                />
              ) : (
                <input
                  type="text"
                  value={draft[phrase.key] ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [phrase.key]: e.target.value }))
                  }
                />
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => resetPhrase(phrase.key, phrase.defaultValue)}
              >
                По умолчанию
              </button>
            </label>
          ))}
        </section>
      ))}

      <div className="profile-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить фразы'}
        </button>
      </div>
    </form>
  );
}
