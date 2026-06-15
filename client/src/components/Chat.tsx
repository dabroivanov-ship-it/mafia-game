import { useState, useRef, useEffect, FormEvent } from 'react';
import type { ChatChannel, ChatMessage, ChatReplyTarget } from '../types';

export interface ChatSendOptions {
  toPlayerId?: number;
  isPrivate?: boolean;
}

interface ChatProps {
  messages: ChatMessage[];
  canSend: boolean;
  myPlayerId?: number;
  onSend: (text: string, opts?: ChatSendOptions) => void;
  onDeleteMessage?: ((messageId: string | number, sourceChannel?: ChatChannel) => void) | null;
  onViewProfile?: (userId: number) => void;
  canModerate?: boolean;
  placeholder?: string;
  hasMoreChat?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  replyTo?: ChatReplyTarget | null;
  onReplyToChange?: (target: ChatReplyTarget | null) => void;
  privateMode?: boolean;
  onPrivateModeChange?: (value: boolean) => void;
}

export default function Chat({
  messages,
  canSend,
  myPlayerId,
  onSend,
  onDeleteMessage,
  onViewProfile,
  canModerate,
  placeholder = 'Сообщение...',
  hasMoreChat = false,
  onLoadMore,
  loadingMore = false,
  replyTo = null,
  onReplyToChange,
  privateMode = false,
  onPrivateModeChange,
}: ChatProps) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !canSend) return;
    atBottomRef.current = true;
    onSend(trimmed, {
      toPlayerId: replyTo?.playerId,
      isPrivate: privateMode && !!replyTo,
    });
    setText('');
  };

  const handleLoadMore = () => {
    if (!onLoadMore || loadingMore) return;
    loadingMoreRef.current = true;
    onLoadMore();
  };

  const handleAuthorClick = (msg: ChatMessage) => {
    if (!msg.playerId || msg.playerId === myPlayerId) return;
    onReplyToChange?.({
      playerId: msg.playerId,
      playerName: msg.playerName,
      userId: msg.userId,
    });
    onPrivateModeChange?.(false);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`chat ${replyTo ? 'chat-has-reply' : ''}`}>
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
            className={`chat-msg ${msg.system ? 'system' : ''} ${msg.deleted ? 'deleted' : ''} ${msg.sourceChannel === 'spectator' ? 'spectator-only' : ''} ${msg.isPrivate ? 'private' : ''} ${msg.toPlayerName && !msg.isPrivate ? 'direct' : ''}`}
          >
            <span className="chat-time">{formatTime(msg.time)}</span>
            {msg.isPrivate && (
              <span className="chat-private-tag" title="Приватное сообщение">
                [P]
              </span>
            )}
            {msg.sourceChannel === 'spectator' && (
              <span className="chat-spectator-tag" title="Только для наблюдателей">
                👁
              </span>
            )}
            {msg.system || !msg.userId ? (
              <span className="chat-author">{msg.playerName}:</span>
            ) : (
              <span className="chat-author-row">
                <button
                  type="button"
                  className={`chat-author-btn ${replyTo?.playerId === msg.playerId ? 'selected' : ''}`}
                  onClick={() => handleAuthorClick(msg)}
                  title="Написать игроку"
                  disabled={!msg.playerId || msg.playerId === myPlayerId}
                >
                  {msg.playerName}:
                </button>
                {onViewProfile && (
                  <button
                    type="button"
                    className="chat-profile-btn"
                    onClick={() => onViewProfile(msg.userId!)}
                    title="Профиль"
                  >
                    👤
                  </button>
                )}
              </span>
            )}
            {msg.toPlayerName && (
              <span className="chat-direct-to" title="Адресат">
                → {msg.toPlayerName}
              </span>
            )}
            <span className="chat-text">{msg.text}</span>
            {canModerate && !msg.system && !msg.deleted && onDeleteMessage && (
              <button
                type="button"
                className="chat-delete-btn"
                title="Удалить сообщение"
                onClick={() =>
                  onDeleteMessage(msg.id, msg.isPrivate ? 'private' : msg.sourceChannel)
                }
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="chat-reply-bar">
          <span>
            Кому: <strong>{replyTo.playerName}</strong>
            {privateMode && <span className="chat-reply-private"> · приватно [P]</span>}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onReplyToChange?.(null);
              onPrivateModeChange?.(false);
            }}
            aria-label="Отменить адресата"
          >
            ✕
          </button>
        </div>
      )}

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            !canSend
              ? 'Чат недоступен'
              : replyTo
                ? privateMode
                  ? `Приватно для ${replyTo.playerName}...`
                  : `Сообщение для ${replyTo.playerName}...`
                : placeholder
          }
          disabled={!canSend}
          maxLength={300}
        />
        <button
          type="button"
          className={`btn chat-private-btn ${privateMode ? 'active' : ''}`}
          disabled={!canSend || !replyTo}
          onClick={() => onPrivateModeChange?.(!privateMode)}
          title="Приватно — видят только вы и адресат"
        >
          🔒
        </button>
        <button type="submit" className="btn btn-primary" disabled={!canSend || !text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
