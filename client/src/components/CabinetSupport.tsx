import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  fetchMySupportTickets,
  fetchSupportTicket,
  sendSupportMessage,
  sendSupportTicketReply,
} from '../api';
import type { SupportTicket, SupportTicketMessage } from '../types';
import SupportTicketThread from './SupportTicketThread';

const MAX_LENGTH = 1500;

interface CabinetSupportProps {
  onBack: () => void;
  initialTicketId?: number | null;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

export default function CabinetSupport({ onBack, initialTicketId = null }: CabinetSupportProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [listError, setListError] = useState('');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(initialTicketId);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadList = async () => {
    try {
      const data = await fetchMySupportTickets();
      setTickets(data.tickets);
      setListError('');
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Не удалось загрузить обращения');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    if (!listLoading && !listError && tickets.length === 0) setComposing(true);
  }, [listLoading, listError, tickets.length]);

  const openTicket = async (id: number) => {
    setSelectedId(id);
    setComposing(false);
    setThreadLoading(true);
    setReplyError('');
    try {
      const data = await fetchSupportTicket(id);
      setSelected(data.ticket);
      setMessages(data.messages);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Не удалось открыть обращение');
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (initialTicketId) void openTicket(initialTicketId);
  }, [initialTicketId]);

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
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Опишите проблему');
      return;
    }
    setLoading(true);
    try {
      const data = await sendSupportMessage(trimmed, photo ?? undefined);
      setText('');
      clearPhoto();
      setTickets((prev) => [data.ticket, ...prev.filter((item) => item.id !== data.ticket.id)]);
      setSelected(data.ticket);
      setMessages(data.messages);
      setSelectedId(data.ticket.id);
      setComposing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setSelectedId(null);
    setSelected(null);
    setMessages([]);
    setComposing(false);
    void loadList();
  };

  if (selectedId) {
    return (
      <div className="cabinet-page">
        <nav className="info-back">
          <button type="button" className="btn btn-ghost btn-sm" onClick={backToList}>
            ← Обращения
          </button>
        </nav>
        <header className="page-header">
          <h1>Обращение</h1>
          {selected && (
            <p className="muted">
              {selected.status === 'open' ? 'Открыто' : 'Закрыто'}
              {selected.lastAt ? ` · ${formatWhen(selected.lastAt)}` : ''}
            </p>
          )}
        </header>
        {threadLoading && <p className="muted">Загрузка переписки...</p>}
        {selected && !threadLoading && (
          <div className="profile-card cabinet-card support-form-card support-thread-card">
            <SupportTicketThread
              viewer="player"
              ticket={selected}
              messages={messages}
              sending={sending}
              error={replyError}
              onSend={async (replyText, replyPhoto) => {
                setSending(true);
                setReplyError('');
                try {
                  const data = await sendSupportTicketReply(selected.id, replyText, replyPhoto);
                  setSelected(data.ticket);
                  setMessages(data.messages);
                } catch (err) {
                  setReplyError(err instanceof Error ? err.message : 'Не удалось отправить');
                  throw err;
                } finally {
                  setSending(false);
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cabinet-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="page-header">
        <h1>Поддержка</h1>
        <p className="muted">Опишите проблему — мы постараемся ее решить как можно скорее.</p>
      </header>

      {listError && <div className="auth-error">{listError}</div>}

      {listLoading ? (
        <p className="muted">Загрузка...</p>
      ) : (
        tickets.length > 0 && (
          <ul className="admin-support-list support-mine-list">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className={`admin-support-card admin-support-card-btn${ticket.status === 'open' ? ' is-open' : ''}`}
                  onClick={() => void openTicket(ticket.id)}
                >
                  <header className="admin-support-card-head">
                    <strong>Обращение #{ticket.id}</strong>
                    <span className={`admin-support-status admin-support-status--${ticket.status}`}>
                      {ticket.status === 'open' ? 'Открыто' : 'Закрыто'}
                    </span>
                  </header>
                  <time className="muted admin-support-time" dateTime={ticket.lastAt || ticket.createdAt}>
                    {formatWhen(ticket.lastAt || ticket.createdAt)}
                  </time>
                  <p className="admin-support-text">
                    {ticket.lastRole === 'staff' ? 'Поддержка: ' : ''}
                    {ticket.lastPreview || ticket.text}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {!composing ? (
        <button type="button" className="btn btn-primary" onClick={() => setComposing(true)}>
          Новое обращение
        </button>
      ) : (
        <div className="profile-card cabinet-card support-form-card">
          <form onSubmit={handleSubmit} className="support-form">
            <label className="support-label">
              <span>Текст обращения</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_LENGTH}
                rows={6}
                placeholder="Напишите ваш вопрос или пришлите скриншот"
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

            <div className="admin-support-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Отправка…' : 'Отправить'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setComposing(false);
                  setError('');
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
