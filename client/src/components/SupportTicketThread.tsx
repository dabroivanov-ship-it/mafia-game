import { ChangeEvent, FormEvent, ReactNode, useRef, useState } from 'react';
import { avatarUrl } from '../api';
import type { SupportTicket, SupportTicketMessage } from '../types';

const MAX_LENGTH = 1500;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

function messageLabel(message: SupportTicketMessage, viewer: 'player' | 'staff'): string {
  if (viewer === 'player' && message.role === 'staff') return 'Поддержка';
  return message.authorName;
}

interface SupportTicketThreadProps {
  viewer: 'player' | 'staff';
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
  sending?: boolean;
  error?: string;
  onSend: (text: string, photo?: File) => Promise<void>;
  extraActions?: ReactNode;
}

export default function SupportTicketThread({
  viewer,
  ticket,
  messages,
  sending = false,
  error = '',
  onSend,
  extraActions,
}: SupportTicketThreadProps) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearPhoto = () => {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await onSend(trimmed, photo ?? undefined);
      setText('');
      clearPhoto();
    } catch {
      /* draft stays; error is shown by parent */
    }
  };

  const inputId = `support-thread-photo-${ticket.id}-${viewer}`;

  return (
    <div className="support-thread">
      <div className="support-thread-messages">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`support-msg support-msg--${message.role}`}
          >
            <header className="support-msg-head">
              <strong>{messageLabel(message, viewer)}</strong>
              <time dateTime={message.createdAt}>{formatWhen(message.createdAt)}</time>
            </header>
            <p className="support-msg-text">{message.text}</p>
            {message.attachmentUrl && (
              <a
                href={avatarUrl(message.attachmentUrl) ?? message.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="admin-support-photo-link"
              >
                <img
                  src={avatarUrl(message.attachmentUrl) ?? message.attachmentUrl}
                  alt="Вложение"
                  className="admin-support-photo"
                />
              </a>
            )}
          </article>
        ))}
      </div>

      {extraActions}

      <form onSubmit={(e) => void handleSubmit(e)} className="support-form support-thread-form">
        <label className="support-label">
          <span>Сообщение</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            placeholder={viewer === 'staff' ? 'Ответ игроку' : 'Дополните обращение'}
            disabled={sending}
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
            id={inputId}
            hidden
            disabled={sending}
          />
          <label htmlFor={inputId} className="btn btn-ghost btn-sm">
            Прикрепить фото
          </label>
          {photo && (
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={clearPhoto}>
              Убрать фото
            </button>
          )}
          {preview && <img src={preview} alt="Превью" className="support-photo-preview" />}
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
    </div>
  );
}
