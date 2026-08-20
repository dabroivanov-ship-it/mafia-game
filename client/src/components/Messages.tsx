import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchMailConversations,
  fetchMailThread,
  fetchUnreadMailCount,
  sendPrivateMessage,
  fetchFriends,
  reportPrivateMessage,
} from '../api';
import type { MailConversation, PrivateMessage, FriendUser } from '../types';
import DeleteMessageModal, { type ViolationType } from './DeleteMessageModal';

const THREAD_PAGE_SIZE = 10;
const DELETED_MAIL_TEXT = '[сообщение удалено модератором]';

type MailView = 'list' | 'thread' | 'compose';
type ListTab = 'dialogs' | 'friends';

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
  returnToRoomLabel?: string | null;
  onReturnToRoom?: () => void;
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
  returnToRoomLabel = null,
  onReturnToRoom,
}: MessagesProps) {
  const [view, setView] = useState<MailView>(
    threadUserId ? 'thread' : composeToUserId || composeToUsername ? 'compose' : 'list'
  );
  const [listTab, setListTab] = useState<ListTab>('dialogs');
  const [conversations, setConversations] = useState<MailConversation[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
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
  const [reportTarget, setReportTarget] = useState<PrivateMessage | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const prependingRef = useRef(false);

  const loadFriends = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchFriends();
      setFriends(res.friends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки друзей');
    } finally {
      setLoading(false);
    }
  };

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
    if (listTab === 'dialogs') void loadConversations();
    else void loadFriends();
  }, [listTab, threadUserId, openUnread]);

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

  const openComposeToFriend = (friend: FriendUser) => {
    setComposeTo(`@${friend.username}`);
    setView('compose');
  };

  const replyInThread = () => {
    if (!threadUser) return;
    setComposeTo(`@${threadUser.username}`);
    setView('compose');
  };

  const handleReportMessage = async (violationType: ViolationType) => {
    if (!reportTarget) return;
    const id = reportTarget.id;
    setError('');
    try {
      await reportPrivateMessage(id, violationType);
      setThread((prev) =>
        prev.map((m) => (m.id === id ? { ...m, text: DELETED_MAIL_TEXT } : m))
      );
      setReportTarget(null);
      setSuccess('Сообщение отмечено и попало в журнал модерации');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отметить сообщение');
      setReportTarget(null);
    }
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
            Написать
          </button>
        )}
      </nav>

      {returnToRoomLabel && onReturnToRoom && (
        <div className="messages-return-room">
          <button type="button" className="btn btn-primary btn-sm" onClick={onReturnToRoom}>
            {returnToRoomLabel}
          </button>
        </div>
      )}

      <header className="page-header">
        <h1>
          {view === 'thread' && threadUser
            ? threadUser.username
            : view === 'compose'
              ? 'Новое письмо'
              : 'Письма'}
        </h1>
        {view === 'thread' && threadUser && (
          <p className="muted">
            @{threadUser.username}
            {threadTotal > 0 && ` · ${threadTotal} сообщ.`}
          </p>
        )}
        {view === 'list' && <p className="muted">Диалоги и друзья</p>}
      </header>

      {view === 'list' && (
        <div className="messages-tabs">
          <button
            type="button"
            className={`btn btn-sm ${listTab === 'dialogs' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setListTab('dialogs')}
          >
            Диалоги
          </button>
          <button
            type="button"
            className={`btn btn-sm ${listTab === 'friends' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setListTab('friends')}
          >
            Друзья
          </button>
        </div>
      )}

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
          {!loading && listTab === 'dialogs' && (
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
          {!loading && listTab === 'friends' && (
            <div className="mail-list friends-list">
              {friends.length === 0 && (
                <p className="muted">Друзей пока нет. Добавляйте игроков из профиля.</p>
              )}
              {friends.map((friend) => (
                <FriendItem
                  key={friend.id}
                  friend={friend}
                  onWrite={() => openComposeToFriend(friend)}
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
                <ThreadBubble
                  key={msg.id}
                  msg={msg}
                  onReport={
                    msg.direction === 'in' && msg.text !== DELETED_MAIL_TEXT
                      ? () => setReportTarget(msg)
                      : undefined
                  }
                />
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

      {reportTarget && (
        <DeleteMessageModal
          authorName={reportTarget.otherUser.username}
          messageText={reportTarget.text}
          onConfirm={(violationType) => {
            void handleReportMessage(violationType);
          }}
          onCancel={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

function FriendItem({
  friend,
  onWrite,
}: {
  friend: FriendUser;
  onWrite: () => void;
}) {
  return (
    <div className="mail-item friend-item">
      <div className="mail-item-header">
        {friend.avatar ? (
          <img src={avatarUrl(friend.avatar) ?? undefined} alt="" className="mail-avatar" />
        ) : (
          <span className="mail-avatar placeholder" aria-hidden="true" />
        )}
        <div className="mail-conversation-body">
          <div className="mail-conversation-top">
            <strong>{friend.username}</strong>
            <span className={`presence-label ${friend.isOnline ? 'presence-online' : 'presence-offline'}`}>
              {friend.isOnline ? 'в сети' : 'не в сети'}
            </span>
          </div>
          <span className="muted mail-conversation-login">@{friend.username}</span>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onWrite}>
          Написать
        </button>
      </div>
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
            <strong>{otherUser.username}</strong>
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
  onReport,
}: {
  msg: PrivateMessage;
  onReport?: () => void;
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
        {onReport && (
          <button
            type="button"
            className="mail-report-btn"
            title="Отметить нарушение"
            onClick={onReport}
          >
            ✕
          </button>
        )}
      </div>
      <p>{msg.text}</p>
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
