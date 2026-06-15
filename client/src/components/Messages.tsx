import { useEffect, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchInbox,
  fetchOutbox,
  fetchUnreadMailCount,
  sendPrivateMessage,
  markMessageRead,
} from '../api';
import type { PrivateMessage } from '../types';

type MailTab = 'inbox' | 'outbox' | 'compose';

interface MessagesProps {
  composeToUserId?: number | null;
  composeToUsername?: string | null;
  onUnreadChange?: (count: number) => void;
}

export default function Messages({
  composeToUserId = null,
  composeToUsername = null,
  onUnreadChange,
}: MessagesProps) {
  const [tab, setTab] = useState<MailTab>(composeToUserId ? 'compose' : 'inbox');
  const [inbox, setInbox] = useState<PrivateMessage[]>([]);
  const [outbox, setOutbox] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [composeTo, setComposeTo] = useState(
    composeToUserId ? String(composeToUserId) : ''
  );
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [inRes, outRes, unreadRes] = await Promise.all([
        fetchInbox(),
        fetchOutbox(),
        fetchUnreadMailCount(),
      ]);
      setInbox(inRes.messages);
      setOutbox(outRes.messages);
      onUnreadChange?.(unreadRes.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (composeToUserId) {
      setComposeTo(String(composeToUserId));
      setTab('compose');
    }
  }, [composeToUserId]);

  const handleRead = async (msg: PrivateMessage) => {
    if (msg.isRead) return;
    try {
      const { unreadCount } = await markMessageRead(msg.id);
      setInbox((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
      );
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
      await sendPrivateMessage(Number(composeTo), composeText.trim());
      setComposeText('');
      setSuccess('Сообщение отправлено');
      setTab('outbox');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const replyTo = (userId: number) => {
    setComposeTo(String(userId));
    setTab('compose');
  };

  return (
    <div className="messages-panel">
      <div className="messages-tabs">
        <button
          type="button"
          className={tab === 'inbox' ? 'active' : ''}
          onClick={() => setTab('inbox')}
        >
          Входящие ({inbox.filter((m) => !m.isRead).length})
        </button>
        <button type="button" className={tab === 'outbox' ? 'active' : ''} onClick={() => setTab('outbox')}>
          Исходящие
        </button>
        <button type="button" className={tab === 'compose' ? 'active' : ''} onClick={() => setTab('compose')}>
          Написать
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}
      {loading && tab !== 'compose' && <p className="muted">Загрузка...</p>}

      {tab === 'inbox' && !loading && (
        <div className="mail-list">
          {inbox.length === 0 && <p className="muted">Входящих писем нет</p>}
          {inbox.map((msg) => (
            <MailItem key={msg.id} msg={msg} direction="inbox" onOpen={() => void handleRead(msg)} onReply={() => replyTo(msg.otherUser.id)} />
          ))}
        </div>
      )}

      {tab === 'outbox' && !loading && (
        <div className="mail-list">
          {outbox.length === 0 && <p className="muted">Исходящих писем нет</p>}
          {outbox.map((msg) => (
            <MailItem key={msg.id} msg={msg} direction="outbox" onReply={() => replyTo(msg.otherUser.id)} />
          ))}
        </div>
      )}

      {tab === 'compose' && (
        <form className="auth-form mail-compose" onSubmit={handleSend}>
          <label>
            {composeToUserId ? (
              <>
                Кому
                <input type="text" value={`${composeToUsername ? `@${composeToUsername}` : ''} (ID ${composeTo})`} readOnly />
                <input type="hidden" value={composeTo} readOnly />
              </>
            ) : (
              <>
                Кому (ID пользователя)
                <input
                  type="number"
                  min="1"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="ID получателя"
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
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      )}
    </div>
  );
}

function MailItem({
  msg,
  direction,
  onOpen,
  onReply,
}: {
  msg: PrivateMessage;
  direction: 'inbox' | 'outbox';
  onOpen?: () => void;
  onReply?: () => void;
}) {
  return (
    <div
      className={`mail-item ${!msg.isRead && direction === 'inbox' ? 'unread' : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
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
        <span className="muted mail-time">
          {new Date(msg.createdAt).toLocaleString('ru-RU')}
        </span>
      </div>
      <p className="mail-text">{msg.text}</p>
      {onReply && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={(e) => {
            e.stopPropagation();
            onReply();
          }}
        >
          Ответить
        </button>
      )}
    </div>
  );
}
