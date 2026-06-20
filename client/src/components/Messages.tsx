import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchMailConversations,
  fetchMailThread,
  fetchUnreadMailCount,
  sendPrivateMessage,
  fetchFriends,
} from '../api';
import type { MailConversation, PrivateMessage, FriendUser } from '../types';

const THREAD_PAGE_SIZE = 10;

type MailView = 'list' | 'thread' | 'compose';
type ListTab = 'dialogs' | 'friends';

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
    if (listTab === 'dialogs') void loadConversations();
    else void loadFriends();
  }, [listTab]);

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

  const openComposeToFriend = (friend: FriendUser) => {
    setComposeTo(`@${friend.username}`);
    setView('compose');
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
            ? `💬 ${threadUser.username}`
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
        {view === 'list' && <p className="muted">Диалоги и друзья</p>}
      </header>

      {view === 'list' && (
        <div className="messages-tabs">
          <button
            type="button"
            className={`btn btn-sm ${listTab === 'dialogs' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setListTab('dialogs')}
          >
            💬 Диалоги
          </button>
          <button
            type="button"
            className={`btn btn-sm ${listTab === 'friends' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setListTab('friends')}
          >
            👥 Друзья
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
          <span className="mail-avatar placeholder">👤</span>
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
          ✉️ Написать
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
          <span className="mail-avatar placeholder">👤</span>
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
        </div>
        {unreadCount > 0 && <span className="mail-conversation-badge">{unreadCount}</span>}
      </div>
    </button>
  );
}

function ThreadBubble({ msg }: { msg: PrivateMessage }) {
  const isOut = msg.direction === 'out';
  const authorName = isOut ? 'Вы' : msg.otherUser.username;
  const attachmentSrc = msg.attachmentUrl ? avatarUrl(msg.attachmentUrl) : null;

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
      {attachmentSrc && (
        <a href={attachmentSrc} target="_blank" rel="noopener noreferrer" className="mail-thread-attachment">
          <img src={attachmentSrc} alt="Вложение" />
        </a>
      )}
    </div>
  );
}
