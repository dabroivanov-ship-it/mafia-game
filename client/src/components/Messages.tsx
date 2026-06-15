import { useEffect, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchMailHistory,
  fetchMailThread,
  fetchUnreadMailCount,
  sendPrivateMessage,
  markMessageRead,
} from '../api';
import type { PrivateMessage } from '../types';

type MailView = 'history' | 'thread' | 'compose';

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
  const [view, setView] = useState<MailView>(composeToUserId || composeToUsername ? 'compose' : 'history');
  const [history, setHistory] = useState<PrivateMessage[]>([]);
  const [thread, setThread] = useState<PrivateMessage[]>([]);
  const [threadUser, setThreadUser] = useState<PrivateMessage['otherUser'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [composeTo, setComposeTo] = useState(
    composeToUsername ? `@${composeToUsername}` : composeToUserId ? String(composeToUserId) : ''
  );
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const [histRes, unreadRes] = await Promise.all([fetchMailHistory(), fetchUnreadMailCount()]);
      setHistory(histRes.messages);
      onUnreadChange?.(unreadRes.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (user: PrivateMessage['otherUser']) => {
    setLoading(true);
    setError('');
    setThreadUser(user);
    setView('thread');
    try {
      const { messages, unreadCount } = await fetchMailThread(user.id);
      setThread(messages);
      onUnreadChange?.(unreadCount);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
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

  const handleRead = async (msg: PrivateMessage) => {
    if (msg.direction !== 'in' || msg.isRead) return;
    try {
      const { unreadCount } = await markMessageRead(msg.id);
      setHistory((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
      onUnreadChange?.(unreadCount);
    } catch {
      /* ignore */
    }
  };

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
      setView('history');
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const replyInThread = (username: string) => {
    setComposeTo(`@${username}`);
    setView('compose');
  };

  return (
    <div className="cabinet-page messages-page">
      <nav className="info-back messages-page-nav">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (view === 'history' || view === 'compose') onBack();
            else {
              setView('history');
              setThreadUser(null);
            }
          }}
        >
          {view === 'thread' ? '← История' : '← Кабинет'}
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
          <p className="muted">@{threadUser.username}</p>
        )}
        {view === 'history' && (
          <p className="muted">История всех сообщений</p>
        )}
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
            <button type="button" className="btn btn-ghost" onClick={() => setView('history')}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      )}

      {view === 'history' && (
        <>
          {loading && <p className="muted">Загрузка...</p>}
          {!loading && (
            <div className="mail-list">
              {history.length === 0 && <p className="muted">Сообщений пока нет</p>}
              {history.map((msg) => (
                <HistoryItem
                  key={msg.id}
                  msg={msg}
                  onOpen={() => {
                    void handleRead(msg);
                    void openThread(msg.otherUser);
                  }}
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
            <div className="mail-thread">
              {thread.length === 0 && <p className="muted">Переписки пока нет</p>}
              {thread.map((msg) => (
                <ThreadBubble key={msg.id} msg={msg} />
              ))}
              <div className="mail-thread-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => replyInThread(threadUser.username)}
                >
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

function HistoryItem({ msg, onOpen }: { msg: PrivateMessage; onOpen: () => void }) {
  return (
    <button type="button" className={`mail-item mail-history-item ${!msg.isRead && msg.direction === 'in' ? 'unread' : ''}`} onClick={onOpen}>
      <div className="mail-item-header">
        {msg.otherUser.avatar ? (
          <img src={avatarUrl(msg.otherUser.avatar) ?? undefined} alt="" className="mail-avatar" />
        ) : (
          <span className="mail-avatar placeholder">👤</span>
        )}
        <div>
          <strong>{msg.otherUser.displayName}</strong>
          <span className="muted">@{msg.otherUser.username}</span>
        </div>
        <span className={`mail-direction ${msg.direction === 'out' ? 'out' : 'in'}`}>
          {msg.direction === 'out' ? '↑ исх.' : '↓ вх.'}
        </span>
        <span className="muted mail-time">{new Date(msg.createdAt).toLocaleString('ru-RU')}</span>
      </div>
      <p className="mail-text">{msg.text}</p>
    </button>
  );
}

function ThreadBubble({ msg }: { msg: PrivateMessage }) {
  const isOut = msg.direction === 'out';
  return (
    <div className={`mail-thread-bubble ${isOut ? 'out' : 'in'}`}>
      <div className="mail-thread-meta">
        <span>{isOut ? 'Вы' : msg.otherUser.displayName}</span>
        <span className="muted">{new Date(msg.createdAt).toLocaleString('ru-RU')}</span>
      </div>
      <p>{msg.text}</p>
    </div>
  );
}
