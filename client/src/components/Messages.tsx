import { useEffect, useRef, useState, FormEvent, type MouseEvent, type ReactNode } from 'react';
import {
  avatarUrl,
  fetchMailConversations,
  fetchMailThread,
  fetchUnreadMailCount,
  sendPrivateMessage,
} from '../api';
import type { MailConversation, PrivateMessage } from '../types';
import { INFO_PATHS } from '../infoRouting';

const THREAD_PAGE_SIZE = 10;
const DELETED_MAIL_TEXT = '[сообщение удалено модератором]';
const FAQ_IN_MAIL_RE = /FAQ:\s*\/info\/faq|\bFAQ\b/gi;

function renderMailText(text: string, onOpenFaq?: () => void): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(FAQ_IN_MAIL_RE.source, FAQ_IN_MAIL_RE.flags);
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`faq-${key++}`}
        className="mail-inline-link"
        href={INFO_PATHS.faq}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (!onOpenFaq) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
          }
          event.preventDefault();
          onOpenFaq();
        }}
      >
        FAQ
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

type MailView = 'list' | 'thread' | 'compose';

interface MessagesProps {
  composeToUserId?: number | null;
  composeToUsername?: string | null;
  threadUserId?: number | null;
  threadUsername?: string | null;
  openUnread?: boolean;
  onUnreadChange?: (count: number) => void;
  mailReadReceipt?: { readerId: number; messageIds: number[] } | null;
  onBack: () => void;
  onInitialNavigationHandled?: () => void;
  onOpenFaq?: () => void;
}

export default function Messages({
  composeToUserId = null,
  composeToUsername = null,
  threadUserId = null,
  threadUsername = null,
  openUnread = false,
  onUnreadChange,
  mailReadReceipt = null,
  onBack,
  onInitialNavigationHandled,
  onOpenFaq,
}: MessagesProps) {
  const [view, setView] = useState<MailView>(
    threadUserId ? 'thread' : composeToUserId || composeToUsername ? 'compose' : 'list'
  );
  const [conversations, setConversations] = useState<MailConversation[]>([]);
  const [thread, setThread] = useState<PrivateMessage[]>([]);
  const [threadUser, setThreadUser] = useState<PrivateMessage['otherUser'] | null>(null);
  const [threadHasMore, setThreadHasMore] = useState(false);
  const [threadTotal, setThreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [composeTo, setComposeTo] = useState(
    composeToUsername ? `@${composeToUsername}` : composeToUserId ? String(composeToUserId) : ''
  );
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const prependingRef = useRef(false);

  const loadConversations = async () => {
    setLoading(true);
    setError('');
    try {
      const [convRes, unreadRes] = await Promise.all([
        fetchMailConversations(),
        fetchUnreadMailCount(),
      ]);
      setConversations(convRes.conversations);
      onUnreadChange?.(unreadRes.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (
    user: PrivateMessage['otherUser'],
    opts?: { beforeId?: number; append?: boolean }
  ) => {
    if (!opts?.append) {
      setLoading(true);
      setError('');
      setThreadUser(user);
      setView('thread');
    } else {
      setLoadingEarlier(true);
      prependingRef.current = true;
    }

    try {
      const { messages, hasMore, total, unreadCount } = await fetchMailThread(user.id, {
        limit: THREAD_PAGE_SIZE,
        beforeId: opts?.beforeId,
      });

      setThread((prev) => (opts?.append ? [...messages, ...prev] : messages));
      setThreadHasMore(hasMore);
      setThreadTotal(total);
      onUnreadChange?.(unreadCount);

      if (!opts?.append && messages.length > 0) {
        setThreadUser(messages[0].otherUser);
      }

      if (!opts?.append) {
        await loadConversations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
      setLoadingEarlier(false);
    }
  };

  useEffect(() => {
    if (threadUserId || openUnread) return;
    void loadConversations();
  }, [threadUserId, openUnread]);

  useEffect(() => {
    if (composeToUserId) {
      setComposeTo(String(composeToUserId));
      setView('compose');
    } else if (composeToUsername) {
      setComposeTo(`@${composeToUsername}`);
      setView('compose');
    }
  }, [composeToUserId, composeToUsername]);

  useEffect(() => {
    if (!threadUserId) return;
    const user: PrivateMessage['otherUser'] = {
      id: threadUserId,
      username: threadUsername || '…',
      displayName: threadUsername || '',
      avatar: null,
    };
    void loadThread(user).finally(() => onInitialNavigationHandled?.());
  }, [threadUserId, threadUsername]);

  useEffect(() => {
    if (!openUnread || threadUserId) return;
    void (async () => {
      try {
        const [convRes, unreadRes] = await Promise.all([
          fetchMailConversations(),
          fetchUnreadMailCount(),
        ]);
        setConversations(convRes.conversations);
        onUnreadChange?.(unreadRes.count);
        const firstUnread = convRes.conversations.find((conv) => conv.unreadCount > 0);
        if (firstUnread) {
          await loadThread(firstUnread.otherUser);
        } else {
          setView('list');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        onInitialNavigationHandled?.();
      }
    })();
  }, [openUnread, threadUserId]);

  useEffect(() => {
    if (!mailReadReceipt?.messageIds.length) return;
    const ids = new Set(mailReadReceipt.messageIds);
    setThread((prev) =>
      prev.map((msg) =>
        msg.direction === 'out' && ids.has(msg.id) ? { ...msg, isRead: true } : msg
      )
    );
    setConversations((prev) =>
      prev.map((conv) =>
        conv.otherUser.id === mailReadReceipt.readerId &&
        conv.lastMessage.direction === 'out' &&
        ids.has(conv.lastMessage.id)
          ? { ...conv, lastMessage: { ...conv.lastMessage, isRead: true } }
          : conv
      )
    );
  }, [mailReadReceipt]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;

    if (prependingRef.current) {
      const prevHeight = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - prevHeight;
        prependingRef.current = false;
      });
      return;
    }

    if (view === 'thread' && thread.length > 0 && !loading) {
      el.scrollTop = el.scrollHeight;
    }
  }, [thread, view, loading]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    try {
      const recipient = composeToUserId ?? composeTo.trim();
      await sendPrivateMessage(recipient, composeText.trim());
      setComposeText('');
      setSuccess('Сообщение отправлено');
      await loadConversations();
      setView('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const loadEarlier = () => {
    if (!threadUser || !thread.length || loadingEarlier || !threadHasMore) return;
    void loadThread(threadUser, { beforeId: thread[0].id, append: true });
  };

  const openConversation = (conv: MailConversation) => {
    void loadThread(conv.otherUser);
  };

  const replyInThread = () => {
    if (!threadUser) return;
    setComposeTo(`@${threadUser.username}`);
    setView('compose');
  };

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="cabinet-page messages-page">
      <nav className="info-back messages-page-nav">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (view === 'list' || view === 'compose') onBack();
            else {
              setView('list');
              setThreadUser(null);
              setThread([]);
            }
          }}
        >
          {view === 'thread' ? '← Диалоги' : '← Кабинет'}
        </button>
        {view !== 'compose' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setView('compose')}>
            Написать
          </button>
        )}
      </nav>

      <header className="messages-hero">
        <div>
          <h1>
            {view === 'thread' && threadUser
              ? threadUser.displayName || threadUser.username
              : view === 'compose'
                ? 'Новое сообщение'
                : 'Сообщения'}
          </h1>
          {view === 'thread' && threadUser && (
            <p className="muted">
              @{threadUser.username}
              {threadTotal > 0 && ` · ${threadTotal.toLocaleString('ru-RU')} сообщ.`}
            </p>
          )}
          {view === 'list' && (
            <p className="muted">
              {unreadTotal > 0
                ? `Непрочитанных: ${unreadTotal.toLocaleString('ru-RU')}`
                : 'Личные диалоги'}
            </p>
          )}
          {view === 'compose' && <p className="muted">Личное сообщение игроку</p>}
        </div>
        {view === 'list' && unreadTotal > 0 && (
          <span className="messages-hero-badge">{unreadTotal}</span>
        )}
      </header>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      {view === 'compose' && (
        <form className="auth-form mail-compose mail-compose-card" onSubmit={handleSend}>
          <label>
            {composeToUserId ? (
              <>
                Кому
                <input
                  type="text"
                  value={`${composeToUsername ? `@${composeToUsername}` : ''} (ID ${composeTo})`}
                  readOnly
                />
              </>
            ) : (
              <>
                Кому (логин)
                <input
                  type="text"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="@username"
                  required
                />
              </>
            )}
          </label>
          <label>
            Сообщение
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Текст сообщения..."
              required
            />
          </label>
          <div className="profile-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      )}

      {view === 'list' && (
        <div className="messages-panel">
          {loading && <p className="muted">Загрузка...</p>}
          {!loading && (
            <div className="mail-list mail-conversation-list">
              {conversations.length === 0 && (
                <p className="muted messages-empty">Диалогов пока нет</p>
              )}
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.otherUser.id}
                  conv={conv}
                  onOpen={() => openConversation(conv)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'thread' && threadUser && (
        <div className="mail-thread-shell">
          {loading && <p className="muted">Загрузка...</p>}
          {!loading && (
            <div className="mail-thread" ref={threadRef}>
              {threadHasMore && (
                <div className="mail-thread-load-more">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={loadingEarlier}
                    onClick={loadEarlier}
                  >
                    {loadingEarlier ? 'Загрузка...' : '↑ Ранее'}
                  </button>
                </div>
              )}
              {thread.length === 0 && <p className="muted messages-empty">Переписки пока нет</p>}
              {thread.map((msg) => (
                <ThreadBubble key={msg.id} msg={msg} onOpenFaq={onOpenFaq} />
              ))}
              <div className="mail-thread-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={replyInThread}>
                  Ответить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationItem({
  conv,
  onOpen,
}: {
  conv: MailConversation;
  onOpen: () => void;
}) {
  const { otherUser, lastMessage, unreadCount } = conv;
  const preview =
    lastMessage.direction === 'out' ? `Вы: ${lastMessage.text}` : lastMessage.text;

  return (
    <button
      type="button"
      className={`mail-item mail-conversation-item ${unreadCount > 0 ? 'unread' : ''}`}
      onClick={onOpen}
    >
      <div className="mail-item-header">
        {otherUser.avatar ? (
          <img src={avatarUrl(otherUser.avatar) ?? undefined} alt="" className="mail-avatar" />
        ) : (
          <span className="mail-avatar placeholder" aria-hidden="true" />
        )}
        <div className="mail-conversation-body">
          <div className="mail-conversation-top">
            <strong>{otherUser.displayName || otherUser.username}</strong>
            <span className="muted mail-time">
              {new Date(lastMessage.createdAt).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <span className="muted mail-conversation-login">@{otherUser.username}</span>
          <p className="mail-text mail-conversation-preview">{preview}</p>
          {lastMessage.direction === 'out' && (
            <span className={`mail-read-status ${lastMessage.isRead ? 'is-read' : 'is-unread'}`}>
              {lastMessage.isRead ? 'Прочитано' : 'Не прочитано'}
            </span>
          )}
        </div>
        {unreadCount > 0 && <span className="mail-conversation-badge">{unreadCount}</span>}
      </div>
    </button>
  );
}

function ThreadBubble({
  msg,
  onOpenFaq,
}: {
  msg: PrivateMessage;
  onOpenFaq?: () => void;
}) {
  const isOut = msg.direction === 'out';
  const authorName = isOut ? 'Вы' : msg.otherUser.username;
  const attachmentSrc = msg.attachmentUrl ? avatarUrl(msg.attachmentUrl) : null;
  const deleted = msg.text === DELETED_MAIL_TEXT;

  return (
    <div className={`mail-thread-bubble ${isOut ? 'out' : 'in'}${deleted ? ' is-deleted' : ''}`}>
      <div className="mail-thread-meta">
        <strong>{authorName}</strong>
        <span className="muted">
          {new Date(msg.createdAt).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <p>{deleted ? msg.text : renderMailText(msg.text, onOpenFaq)}</p>
      {isOut && (
        <span className={`mail-read-status ${msg.isRead ? 'is-read' : 'is-unread'}`}>
          {msg.isRead ? 'Прочитано' : 'Не прочитано'}
        </span>
      )}
      {attachmentSrc && !deleted && (
        <a href={attachmentSrc} target="_blank" rel="noopener noreferrer" className="mail-thread-attachment">
          <img src={attachmentSrc} alt="Вложение" />
        </a>
      )}
    </div>
  );
}
