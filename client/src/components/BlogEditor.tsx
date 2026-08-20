import { useRef, useState, ChangeEvent, FormEvent } from 'react';
import { adminUploadNewsImage, avatarUrl } from '../api';
import { isEmptyNewsBody } from './newsBodyUtils';
import NewsRichEditor from './NewsRichEditor';
import ToggleSwitch from './ToggleSwitch';

export interface BlogEditorValue {
  title: string;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
}

interface BlogEditorProps {
  value: BlogEditorValue;
  onChange: (value: BlogEditorValue) => void;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}

export default function BlogEditor({
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: BlogEditorProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isEmptyNewsBody(value.body)) {
      setError('Введите текст статьи');
      return;
    }
    setError('');
    onSubmit(e);
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

  const coverPreview = value.coverImage ? avatarUrl(value.coverImage) : null;

  return (
    <form className="news-editor-panel" onSubmit={handleSubmit}>
      <label className="news-editor-field">
        <span className="news-editor-field-label">Заголовок</span>
        <input
          className="news-editor-input"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          maxLength={120}
          required
          placeholder="Заголовок статьи"
        />
      </label>

      <div className="news-editor-field">
        <span className="news-editor-field-label">Обложка</span>
        <div className="news-editor-image-row">
          <input
            className="news-editor-input"
            type="url"
            value={value.coverImage ?? ''}
            onChange={(e) =>
              onChange({ ...value, coverImage: e.target.value.trim() || null })
            }
            placeholder="https://... или загрузите файл"
          />
          <button
            type="button"
            className="btn btn-ghost news-editor-upload-btn"
            disabled={uploading}
            onClick={() => coverInputRef.current?.click()}
          >
            Загрузить
          </button>
        </div>
        {coverPreview && (
          <img src={coverPreview} alt="" className="news-editor-cover-preview" />
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => void handleCoverUpload(e)}
        />
      </div>

      <div className="news-editor-toggles">
        <ToggleSwitch
          id="blog-published"
          label="Опубликовано"
          checked={value.isPublished}
          onChange={(isPublished) => onChange({ ...value, isPublished })}
        />
      </div>

      <div className="news-editor-field">
        <span className="news-editor-field-label">Текст</span>
        <NewsRichEditor
          value={value.body}
          onChange={(body) => onChange({ ...value, body })}
          disabled={uploading}
          onUploadError={setError}
        />
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="profile-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
