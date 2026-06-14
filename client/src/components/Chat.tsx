import { useState, useRef, useEffect, FormEvent } from 'react';
import type { ChatChannel, ChatMessage } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  canSend: boolean;
  onSend: (text: string) => void;
  onDeleteMessage?: ((messageId: string | number, sourceChannel?: ChatChannel) => void) | null;
  onViewProfile?: (userId: number) => void;
  canModerate?: boolean;
  placeholder?: string;
  hasMoreChat?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export default function Chat({
  messages,
  canSend,
  onSend,
  onDeleteMessage,
  onViewProfile,
  canModerate,
  placeholder = 'Сообщение...',
  hasMoreChat = false,
  onLoadMore,
  loadingMore = false,
}: ChatProps) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const checkAtBottom = () => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const handleScroll = () => {
    atBottomRef.current = checkAtBottom();
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const grew = messages.length > prevLenRef.current;
    const prepended = grew && loadingMoreRef.current;
    loadingMoreRef.current = false;

    if (prepended) {
      const prevHeight = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - prevHeight;
      });
    } else if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: grew ? 'smooth' : 'auto' });
    }

    prevLenRef.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !canSend) return;
    atBottomRef.current = true;
    onSend(trimmed);
    setText('');
  };

  const handleLoadMore = () => {
    if (!onLoadMore || loadingMore) return;
    loadingMoreRef.current = true;
    onLoadMore();
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages" ref={listRef} onScroll={handleScroll}>
        {hasMoreChat && onLoadMore && (
          <div className="chat-load-more">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Загрузка...' : '↑ Загрузить ранее'}
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg ${msg.system ? 'system' : ''} ${msg.deleted ? 'deleted' : ''} ${msg.sourceChannel === 'spectator' ? 'spectator-only' : ''}`}
          >
            <span className="chat-time">{formatTime(msg.time)}</span>
            {msg.sourceChannel === 'spectator' && (
              <span className="chat-spectator-tag" title="Только для наблюдателей">👁</span>
            )}
            {msg.system || !msg.userId ? (
              <span className="chat-author">{msg.playerName}:</span>
            ) : (
              <button
                type="button"
                className="chat-author-btn"
                onClick={() => onViewProfile?.(msg.userId!)}
                title="Открыть профиль"
              >
                {msg.playerName}:
              </button>
            )}
            <span className="chat-text">{msg.text}</span>
            {canModerate && !msg.system && !msg.deleted && onDeleteMessage && (
              <button
                type="button"
                className="chat-delete-btn"
                title="Удалить сообщение"
                onClick={() => onDeleteMessage(msg.id, msg.sourceChannel)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canSend ? placeholder : 'Чат недоступен'}
          disabled={!canSend}
          maxLength={300}
        />
        <button type="submit" className="btn btn-primary" disabled={!canSend || !text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
