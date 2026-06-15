import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchMailConversations,
  fetchMailThread,
  fetchUnreadMailCount,
  sendPrivateMessage,
} from '../api';
import type { MailConversation, PrivateMessage } from '../types';

const THREAD_PAGE_SIZE = 10;

type MailView = 'list' | 'thread' | 'compose';

interface MessagesProps {
  composeToUserId?: number | null;
  composeToUsername?: string | null;
  onUnreadChange?: (count: number) => void;
  onBack: () => void;
}

export default function Messages({
  composeToUserId = null,
  composeToUsername = null,
  onUnreadChange,
  onBack,
}: MessagesProps) {
  const [view, setView] = useState<MailView>(composeToUserId || composeToUsername ? 'compose' : 'list');
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
    void loadConversations();
  }, []);

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
            ✏️ Написать
          </button>
        )}
      </nav>

      <header className="page-header">
        <h1>
          {view === 'thread' && threadUser
            ? `💬 ${threadUser.displayName}`
            : view === 'compose'
              ? '✏️ Новое письмо'
              : '✉️ Письма'}
        </h1>
        {view === 'thread' && threadUser && (
          <p className="muted">
            @{threadUser.username}
            {threadTotal > 0 && ` · ${threadTotal} сообщ.`}
          </p>
        )}
        {view === 'list' && <p className="muted">Диалоги по именам</p>}
      </header>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      {view === 'compose' && (
        <form className="auth-form mail-compose profile-card" onSubmit={handleSend}>
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
              placeholder="Текст письма..."
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
        <>
          {loading && <p className="muted">Загрузка...</p>}
          {!loading && (
            <div className="mail-list mail-conversation-list">
              {conversations.length === 0 && <p className="muted">Диалогов пока нет</p>}
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.otherUser.id}
                  conv={conv}
                  onOpen={() => openConversation(conv)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'thread' && threadUser && (
        <>
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
              {thread.length === 0 && <p className="muted">Переписки пока нет</p>}
              {thread.map((msg) => (
                <ThreadBubble key={msg.id} msg={msg} />
              ))}
              <div className="mail-thread-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={replyInThread}>
                  Ответить
                </button>
              </div>
            </div>
          )}
        </>
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
          <span className="mail-avatar placeholder">👤</span>
        )}
        <div className="mail-conversation-body">
          <div className="mail-conversation-top">
            <strong>{otherUser.displayName}</strong>
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
        </div>
        {unreadCount > 0 && <span className="mail-conversation-badge">{unreadCount}</span>}
      </div>
    </button>
  );
}

function ThreadBubble({ msg }: { msg: PrivateMessage }) {
  const isOut = msg.direction === 'out';
  const authorName = isOut ? 'Вы' : msg.otherUser.displayName;

  return (
    <div className={`mail-thread-bubble ${isOut ? 'out' : 'in'}`}>
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
      <p>{msg.text}</p>
    </div>
  );
}
