import { useRef, useState, ChangeEvent, FormEvent } from 'react';
import { adminUploadNewsImage, avatarUrl } from '../api';
import { isEmptyNewsBody } from './newsBodyUtils';
import NewsRichEditor from './NewsRichEditor';
import ToggleSwitch from './ToggleSwitch';

const EMPTY_POLL_OPTIONS = ['', ''];

export interface NewsEditorValue {
  title: string;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  pollEnabled: boolean;
  pollQuestion: string;
  pollOptions: string[];
  pollEndsAt: string;
}

interface NewsEditorProps {
  value: NewsEditorValue;
  onChange: (value: NewsEditorValue) => void;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
  pollHasVotes?: boolean;
}

export default function NewsEditor({
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
  pollHasVotes = false,
}: NewsEditorProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isEmptyNewsBody(value.body)) {
      setError('Введите текст новости');
      return;
    }
    if (value.pollEnabled) {
      if (!value.pollQuestion.trim()) {
        setError('Укажите вопрос голосования');
        return;
      }
      const filledOptions = value.pollOptions.map((item) => item.trim()).filter(Boolean);
      if (filledOptions.length < 2) {
        setError('Добавьте минимум 2 варианта ответа');
        return;
      }
    }
    setError('');
    onSubmit(e);
  };

  const updatePollOption = (index: number, text: string) => {
    const pollOptions = [...value.pollOptions];
    pollOptions[index] = text;
    onChange({ ...value, pollOptions });
  };

  const addPollOption = () => {
    if (value.pollOptions.length >= 10) return;
    onChange({ ...value, pollOptions: [...value.pollOptions, ''] });
  };

  const removePollOption = (index: number) => {
    if (value.pollOptions.length <= 2) return;
    onChange({ ...value, pollOptions: value.pollOptions.filter((_, i) => i !== index) });
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
  const editorBusy = uploading;

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
          placeholder="Заголовок новости"
        />
      </label>

      <div className="news-editor-field">
        <span className="news-editor-field-label">Изображение</span>
        <div className="news-editor-image-row">
          <input
            className="news-editor-input"
            type="url"
            value={value.coverImage ?? ''}
            onChange={(e) =>
              onChange({ ...value, coverImage: e.target.value.trim() || null })
            }
            placeholder="https://..."
          />
          <button
            type="button"
            className="btn btn-ghost news-editor-upload-btn"
            disabled={editorBusy}
            onClick={() => coverInputRef.current?.click()}
          >
            <span aria-hidden>↑</span> Загрузить изображение
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
          id="news-published"
          label="Опубликовано"
          checked={value.isPublished}
          onChange={(isPublished) => onChange({ ...value, isPublished })}
        />
        <ToggleSwitch
          id="news-featured"
          label="Избранное"
          checked={value.isFeatured}
          onChange={(isFeatured) => onChange({ ...value, isFeatured })}
        />
        <ToggleSwitch
          id="news-poll"
          label="Голосование"
          checked={value.pollEnabled}
          onChange={(pollEnabled) =>
            onChange({
              ...value,
              pollEnabled,
              pollOptions:
                pollEnabled && value.pollOptions.length < 2
                  ? [...EMPTY_POLL_OPTIONS]
                  : value.pollOptions,
            })
          }
        />
      </div>

      {value.pollEnabled && (
        <div className="news-editor-poll">
          <label className="news-editor-field">
            <span className="news-editor-field-label">Вопрос голосования</span>
            <input
              className="news-editor-input"
              value={value.pollQuestion}
              onChange={(e) => onChange({ ...value, pollQuestion: e.target.value })}
              maxLength={200}
              placeholder="Например: Какую роль добавить в игру?"
            />
          </label>

          <div className="news-editor-field">
            <span className="news-editor-field-label">Варианты ответа</span>
            {pollHasVotes && (
              <p className="muted news-editor-poll-note">
                Уже есть голоса — можно менять только вопрос и дату окончания.
              </p>
            )}
            <div className="news-editor-poll-options">
              {value.pollOptions.map((option, index) => (
                <div key={index} className="news-editor-poll-option-row">
                  <input
                    className="news-editor-input"
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    maxLength={120}
                    placeholder={`Вариант ${index + 1}`}
                    disabled={pollHasVotes}
                  />
                  {!pollHasVotes && value.pollOptions.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removePollOption(index)}
                      aria-label="Удалить вариант"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!pollHasVotes && value.pollOptions.length < 10 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={addPollOption}>
                + Добавить вариант
              </button>
            )}
          </div>

          <label className="news-editor-field">
            <span className="news-editor-field-label">Окончание голосования (необязательно)</span>
            <input
              className="news-editor-input"
              type="datetime-local"
              value={value.pollEndsAt}
              onChange={(e) => onChange({ ...value, pollEndsAt: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="news-editor-field news-editor-content">
        <span className="news-editor-field-label">Содержание</span>
        <NewsRichEditor
          value={value.body}
          onChange={(body) => onChange({ ...value, body })}
          disabled={editorBusy}
          onUploadingChange={setUploading}
          onUploadError={setError}
        />
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="news-editor-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        )}
        <button type="submit" className="btn btn-primary news-editor-save" disabled={editorBusy}>
          {editorBusy ? 'Загрузка...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
