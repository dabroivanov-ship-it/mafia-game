import { useState, useRef, useEffect, FormEvent, type MouseEvent } from 'react';
import type { ChatChannel, ChatMessage, ChatReplyTarget, ViolationType } from '../types';
import { isHostSender } from '../content/hostContent';
import { roomGamePath } from '../roomRouting';
import DeleteMessageModal from './DeleteMessageModal';
import HostProfileModal from './HostProfileModal';

const GAME_START_ROOM_LINK_RE =
  /Запускается игра в комнате\s+[«"„](.+?)[»"“]\.?\s*\/room\/(\d+)/u;

function parseGameStartRoomLink(text: string): {
  before: string;
  roomName: string;
  after: string;
  roomId: number;
} | null {
  const match = String(text || '').trim().match(GAME_START_ROOM_LINK_RE);
  if (!match) return null;
  const roomId = Number(match[2]);
  if (!Number.isFinite(roomId) || roomId <= 0) return null;
  const roomName = match[1].trim();
  if (!roomName) return null;
  return {
    before: 'Запускается игра в комнате «',
    roomName,
    after: '».',
    roomId,
  };
}

export interface ChatSendOptions {
  toPlayerId?: number;
  isPrivate?: boolean;
}

interface ChatProps {
  messages: ChatMessage[];
  canSend: boolean;
  myPlayerId?: number;
  currentUserId?: number;
  onSend: (text: string, opts?: ChatSendOptions) => void;
  onDeleteMessage?: (
    messageId: string | number,
    sourceChannel: ChatChannel | undefined,
    violationType: ViolationType
  ) => void;
  onOpenPlayerPage?: (target: ChatReplyTarget) => void;
  onJoinRoom?: (roomId: number) => void;
  canModerate?: boolean;
  placeholder?: string;
  hasMoreChat?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  replyTo?: ChatReplyTarget | null;
  onReplyToChange?: (target: ChatReplyTarget | null) => void;
}

export default function Chat({
  messages,
  canSend,
  myPlayerId,
  currentUserId,
  onSend,
  onDeleteMessage,
  onOpenPlayerPage,
  onJoinRoom,
  canModerate,
  placeholder = 'Сообщение...',
  hasMoreChat = false,
  onLoadMore,
  loadingMore = false,
  replyTo = null,
  onReplyToChange,
}: ChatProps) {
  const [text, setText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [showHostProfile, setShowHostProfile] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const [atTop, setAtTop] = useState(true);

  const checkAtBottom = () => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const checkAtTop = () => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollTop <= 8;
  };

  const handleScroll = () => {
    atBottomRef.current = checkAtBottom();
    setAtTop(checkAtTop());
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
        setAtTop(checkAtTop());
      });
    } else if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: grew ? 'smooth' : 'auto' });
      setAtTop(checkAtTop());
    } else {
      setAtTop(checkAtTop());
    }

    prevLenRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    // Короткий список без скролла — кнопка «ранее» тоже видна.
    setAtTop(checkAtTop());
  }, [hasMoreChat, messages.length]);

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
    });
    setText('');
  };

  const handleLoadMore = () => {
    if (!onLoadMore || loadingMore) return;
    loadingMoreRef.current = true;
    onLoadMore();
  };

  const isOwnMessage = (msg: ChatMessage): boolean => {
    if (currentUserId && msg.userId === currentUserId) return true;
    if (myPlayerId != null && msg.playerId === myPlayerId) return true;
    return false;
  };

  const canOpenAuthorProfile = (msg: ChatMessage): boolean =>
    !msg.system &&
    !!onOpenPlayerPage &&
    (!!msg.userId || (!isOwnMessage(msg) && !!msg.isBot));

  const canOpenHostProfile = (msg: ChatMessage): boolean =>
    !!msg.system && isHostSender(msg.playerName);

  const handleAuthorClick = (msg: ChatMessage) => {
    if (!canOpenAuthorProfile(msg)) return;
    onOpenPlayerPage?.({
      userId: msg.userId ?? undefined,
      playerId: msg.playerId ?? undefined,
      playerName: msg.playerName,
      isBot: msg.isBot,
    });
  };

  const isReplyTarget = (msg: ChatMessage): boolean =>
    !!replyTo &&
    replyTo.playerId != null &&
    msg.playerId != null &&
    replyTo.playerId === msg.playerId;

  const renderAuthor = (msg: ChatMessage) => {
    if (canOpenAuthorProfile(msg)) {
      return (
        <button
          type="button"
          className={`chat-author-btn ${msg.isBot ? 'chat-bot-btn' : ''} ${isReplyTarget(msg) ? 'selected' : ''}`}
          onClick={() => handleAuthorClick(msg)}
          title={
            msg.isBot
              ? 'AI игрок'
              : isOwnMessage(msg)
                ? 'Открыть свой профиль'
                : 'Открыть профиль и написать'
          }
        >
          {msg.playerName}:
        </button>
      );
    }

    if (canOpenHostProfile(msg)) {
      return (
        <button
          type="button"
          className="chat-author-btn chat-host-btn"
          onClick={() => setShowHostProfile(true)}
          title="О ведущем"
        >
          {msg.playerName}:
        </button>
      );
    }

    return <span className="chat-author">{msg.playerName}:</span>;
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleRoomLinkClick = (event: MouseEvent<HTMLAnchorElement>, roomId: number) => {
    if (!onJoinRoom) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onJoinRoom(roomId);
  };

  const renderText = (msg: ChatMessage) => {
    const parsed = parseGameStartRoomLink(msg.text);
    if (parsed) {
      return (
        <span className="chat-text">
          {parsed.before}
          <a
            className="chat-room-link"
            href={roomGamePath(parsed.roomId)}
            onClick={(event) => handleRoomLinkClick(event, parsed.roomId)}
          >
            {parsed.roomName}
          </a>
          {parsed.after}
        </span>
      );
    }
    return <span className="chat-text">{msg.text}</span>;
  };

  return (
    <div className={`chat ${replyTo ? 'chat-has-reply' : ''}`}>
      <div className="chat-messages" ref={listRef} onScroll={handleScroll}>
        {hasMoreChat && onLoadMore && atTop && (
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
            className={`chat-msg ${msg.system ? 'system' : ''} ${msg.deleted ? 'deleted' : ''} ${msg.sourceChannel === 'spectator' ? 'spectator-only' : ''} ${msg.isPrivate ? 'private' : ''} ${msg.toPlayerName ? 'direct' : ''}`}
          >
            {msg.isPrivate && (
              <span className="chat-private-tag" title="Приватное сообщение">
                [P]
              </span>
            )}
            <span className="chat-line">
              <span className="chat-time">{formatTime(msg.time)}</span>
              {renderAuthor(msg)}
              {msg.toPlayerName && (
                <span className="chat-direct-to" title="Адресат">
                  → {msg.toPlayerName}:
                </span>
              )}
              {renderText(msg)}
            </span>
            {canModerate && !msg.system && !msg.deleted && onDeleteMessage && (
              <button
                type="button"
                className="chat-delete-btn"
                title="Удалить сообщение"
                onClick={() => setDeleteTarget(msg)}
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
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onReplyToChange?.(null)}
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
                ? `Сообщение для ${replyTo.playerName}...`
                : placeholder
          }
          disabled={!canSend}
          maxLength={300}
        />
        <button type="submit" className="btn btn-primary" disabled={!canSend || !text.trim()}>
          ➤
        </button>
      </form>

      {deleteTarget && onDeleteMessage && (
        <DeleteMessageModal
          authorName={deleteTarget.playerName}
          messageText={deleteTarget.text}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(violationType) => {
            onDeleteMessage(
              deleteTarget.id,
              deleteTarget.isPrivate ? 'private' : deleteTarget.sourceChannel,
              violationType
            );
            setDeleteTarget(null);
          }}
        />
      )}

      {showHostProfile && <HostProfileModal onClose={() => setShowHostProfile(false)} />}
    </div>
  );
}
