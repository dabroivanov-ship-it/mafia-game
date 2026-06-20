import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { sendSupportMessage } from '../api';

const MAX_LENGTH = 1500;

interface CabinetSupportProps {
  onBack: () => void;
}

export default function CabinetSupport({ onBack }: CabinetSupportProps) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Опишите проблему');
      return;
    }
    setLoading(true);
    try {
      await sendSupportMessage(trimmed, photo ?? undefined);
      setText('');
      clearPhoto();
      setSuccess('Обращение отправлено. Администратор ответит в личных сообщениях.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
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
        <h1>🆘 Поддержка</h1>
        <p className="muted">Опишите проблему — сообщение придёт главному администратору</p>
      </header>

      <div className="profile-card cabinet-card support-form-card">
        <form onSubmit={handleSubmit} className="support-form">
          <label className="support-label">
            <span>Текст обращения</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={6}
              placeholder="Что произошло? Когда и в какой комнате?"
              disabled={loading}
            />
            <span className="muted support-char-count">
              {text.length} / {MAX_LENGTH}
            </span>
          </label>

          <div className="support-photo-block">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhoto}
              id="support-photo-upload"
              hidden
              disabled={loading}
            />
            <label htmlFor="support-photo-upload" className="btn btn-ghost btn-sm">
              📎 Прикрепить фото
            </label>
            {photo && (
              <button type="button" className="btn btn-ghost btn-sm danger" onClick={clearPhoto}>
                Убрать фото
              </button>
            )}
            {preview && (
              <img src={preview} alt="Превью" className="support-photo-preview" />
            )}
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Отправка…' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  );
}
