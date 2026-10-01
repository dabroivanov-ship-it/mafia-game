import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { fetchClanChat, sendClanChat } from '../api';
import type { ClanChatMessage } from '../types';

interface ClanChatProps {
  clanId: number;
  socket: Socket | null;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ClanChat({ clanId, socket }: ClanChatProps) {
  const [messages, setMessages] = useState<ClanChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const append = (message: ClanChatMessage) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setMessages([]);
    void fetchClanChat(clanId)
      .then((res) => {
        if (!cancelled) setMessages(res.messages);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить чат');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clanId]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: ClanChatMessage) => {
      if (message.clanId !== clanId) return;
      append(message);
    };
    const onCleared = (payload: { clanId?: number }) => {
      if (payload?.clanId !== clanId) return;
      setMessages([]);
    };
    socket.on('clan:message', onMessage);
    socket.on('clan:cleared', onCleared);
    return () => {
      socket.off('clan:message', onMessage);
      socket.off('clan:cleared', onCleared);
    };
  }, [socket, clanId]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    void sendClanChat(clanId, body)
      .then((res) => {
        setText('');
        append(res.message);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось отправить'))
      .finally(() => setSending(false));
  };

  return (
    <section className="clans-section clans-chat-section">
      <h3>Чат клана</h3>
      <div className="clans-chat">
        <div
          className="clans-chat-log"
          ref={logRef}
          onScroll={() => {
            const el = logRef.current;
            if (!el) return;
            atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
        >
          {loading ? (
            <p className="muted">Загрузка…</p>
          ) : messages.length === 0 ? (
            <p className="muted">Сообщений пока нет</p>
          ) : (
            messages.map((message) => (
              <p key={message.id} className="clans-chat-line">
                <span className="clans-chat-time">{formatTime(message.createdAt)}</span>
                <span className="clans-chat-author">@{message.username}</span>
                <span className="clans-chat-body">{message.body}</span>
              </p>
            ))
          )}
        </div>
        <form className="clans-chat-form" onSubmit={handleSubmit}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            placeholder="Сообщение клану"
            disabled={sending}
            aria-label="Сообщение клану"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !text.trim()}>
            Отправить
          </button>
        </form>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
