import { useRef, useState, ChangeEvent, FormEvent } from 'react';
import { adminUploadNewsImage, avatarUrl } from '../api';
import NewsBody from './NewsBody';

export interface NewsEditorValue {
  title: string;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
}

interface NewsEditorProps {
  value: NewsEditorValue;
  onChange: (value: NewsEditorValue) => void;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}

export default function NewsEditor({
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: NewsEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');

  const insertAtCursor = (snippet: string) => {
    const el = bodyRef.current;
    if (!el) {
      onChange({ ...value, body: `${value.body}${snippet}` });
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.body.slice(0, start) + snippet + value.body.slice(end);
    onChange({ ...value, body: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const wrapBold = () => {
    const el = bodyRef.current;
    if (!el) return;
    const selected = value.body.slice(el.selectionStart, el.selectionEnd);
    if (!selected.trim()) return;
    const before = value.body.slice(0, el.selectionStart);
    const after = value.body.slice(el.selectionEnd);
    onChange({ ...value, body: `${before}**${selected}**${after}` });
  };

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await adminUploadNewsImage(file);
      onChange({ ...value, coverImage: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleInlineImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await adminUploadNewsImage(file);
      insertAtCursor(`\n\n![Изображение](${url})\n\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (inlineImageRef.current) inlineImageRef.current.value = '';
    }
  };

  return (
    <form className="admin-news-form news-editor" onSubmit={onSubmit}>
      <label>
        Заголовок
        <input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          maxLength={120}
          required
        />
      </label>

      <div className="news-editor-cover">
        <label>Обложка (необязательно)</label>
        {value.coverImage && (
          <img
            src={avatarUrl(value.coverImage) ?? undefined}
            alt=""
            className="news-editor-cover-preview"
          />
        )}
        <div className="news-editor-toolbar">
          <button
            type="button"
            className="btn btn-sm"
            disabled={uploading}
            onClick={() => coverInputRef.current?.click()}
          >
            {value.coverImage ? 'Сменить обложку' : 'Загрузить обложку'}
          </button>
          {value.coverImage && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => onChange({ ...value, coverImage: null })}
            >
              Убрать
            </button>
          )}
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => void handleCoverUpload(e)}
        />
      </div>

      <div className="news-editor-body">
        <label>Текст новости</label>
        <div className="news-editor-toolbar">
          <button type="button" className="btn btn-sm" onClick={wrapBold} title="Жирный">
            B
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={uploading}
            onClick={() => inlineImageRef.current?.click()}
          >
            Вставить картинку
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-ghost ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? 'Редактор' : 'Превью'}
          </button>
        </div>
        <input
          ref={inlineImageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => void handleInlineImage(e)}
        />
        {showPreview ? (
          <div className="news-editor-preview">
            {value.coverImage && (
              <img
                src={avatarUrl(value.coverImage) ?? undefined}
                alt=""
                className="news-cover-image"
              />
            )}
            <NewsBody body={value.body || '—'} />
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            value={value.body}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
            rows={12}
            maxLength={20000}
            required
            placeholder="Текст. **Жирный**, картинки через кнопку «Вставить картинку»."
          />
        )}
      </div>

      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={value.isPublished}
          onChange={(e) => onChange({ ...value, isPublished: e.target.checked })}
        />
        Опубликовать сразу
      </label>

      {error && <p className="auth-error">{error}</p>}

      <div className="profile-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Загрузка...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
