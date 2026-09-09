import { useCallback, useEffect, useState } from 'react';
import {
  adminSetSupportTicketStatus,
  fetchAdminSupportTickets,
  fetchSupportTicket,
  sendSupportTicketReply,
} from '../api';
import type { SupportTicket, SupportTicketMessage, SupportTicketStatus } from '../types';
import SupportTicketThread from './SupportTicketThread';

interface AdminSupportPanelProps {
  onOpenStatistics?: (userId: number) => void;
  onOpenCountChange?: (count: number) => void;
  initialTicketId?: number | null;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

export default function AdminSupportPanel({
  onOpenStatistics,
  onOpenCountChange,
  initialTicketId = null,
}: AdminSupportPanelProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialTicketId);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (status: SupportTicketStatus | 'all' = filter) => {
    setError('');
    try {
      const data = await fetchAdminSupportTickets(status);
      setTickets(data.tickets);
      onOpenCountChange?.(data.openCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filter, onOpenCountChange]);

  useEffect(() => {
    setLoading(true);
    void load(filter);
  }, [filter, load]);

  const openTicket = useCallback(async (id: number) => {
    setSelectedId(id);
    setThreadLoading(true);
    setReplyError('');
    try {
      const data = await fetchSupportTicket(id);
      setSelected(data.ticket);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть обращение');
      setSelected(null);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTicketId) void openTicket(initialTicketId);
  }, [initialTicketId, openTicket]);

  const setStatus = async (ticket: SupportTicket, status: SupportTicketStatus) => {
    setBusyId(ticket.id);
    setError('');
    try {
      const data = await adminSetSupportTicketStatus(ticket.id, status);
      onOpenCountChange?.(data.openCount);
      setTickets((prev) => {
        const next = prev.map((item) => (item.id === ticket.id ? data.ticket : item));
        if (filter === 'all') return next;
        return next.filter((item) => item.status === filter);
      });
      if (selected?.id === ticket.id) setSelected(data.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (text: string, photo?: File) => {
    if (!selected) return;
    setSending(true);
    setReplyError('');
    try {
      const data = await sendSupportTicketReply(selected.id, text, photo);
      setSelected(data.ticket);
      setMessages(data.messages);
      if (data.openCount != null) onOpenCountChange?.(data.openCount);
      setTickets((prev) =>
        prev.map((item) => (item.id === data.ticket.id ? { ...item, ...data.ticket } : item))
      );
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
      throw err;
    } finally {
      setSending(false);
    }
  };

  if (selectedId) {
    return (
      <div className="admin-support-panel">
        <div className="admin-support-toolbar">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedId(null);
              setSelected(null);
              setMessages([]);
              void load(filter);
            }}
          >
            ← К обращениям
          </button>
          {selected && (
            <span className={`admin-support-status admin-support-status--${selected.status}`}>
              {selected.status === 'open' ? 'Открыто' : 'Закрыто'}
            </span>
          )}
        </div>
        {threadLoading && <p className="muted">Загрузка переписки...</p>}
        {selected && !threadLoading && (
          <>
            <header className="admin-support-card-head">
              <div>
                <strong>{selected.displayName}</strong>
                {selected.username && <span className="muted"> @{selected.username}</span>}
              </div>
            </header>
            <SupportTicketThread
              viewer="staff"
              ticket={selected}
              messages={messages}
              sending={sending}
              error={replyError}
              onSend={sendReply}
              extraActions={
                <div className="admin-support-actions">
                  {onOpenStatistics && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onOpenStatistics(selected.userId)}
                    >
                      Профиль
                    </button>
                  )}
                  {selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === selected.id}
                      onClick={() => void setStatus(selected, 'done')}
                    >
                      Закрыть
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === selected.id}
                      onClick={() => void setStatus(selected, 'open')}
                    >
                      Открыть снова
                    </button>
                  )}
                </div>
              }
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="admin-support-panel">
      <div className="admin-support-toolbar">
        <p className="muted admin-support-hint">Переписка с игроком внутри обращения.</p>
        <label className="admin-support-filter">
          Показать
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SupportTicketStatus | 'all')}
          >
            <option value="open">Открытые</option>
            <option value="done">Закрытые</option>
            <option value="all">Все</option>
          </select>
        </label>
      </div>

      {loading && tickets.length === 0 && <p className="muted">Загрузка...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && tickets.length === 0 && (
        <p className="muted">
          {filter === 'open' ? 'Открытых обращений нет.' : 'Обращений пока нет.'}
        </p>
      )}

      <ul className="admin-support-list">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <button
              type="button"
              className={`admin-support-card admin-support-card-btn${ticket.status === 'open' ? ' is-open' : ''}`}
              onClick={() => void openTicket(ticket.id)}
            >
              <header className="admin-support-card-head">
                <div>
                  <strong>{ticket.displayName}</strong>
                  {ticket.username && <span className="muted"> @{ticket.username}</span>}
                </div>
                <span className={`admin-support-status admin-support-status--${ticket.status}`}>
                  {ticket.status === 'open' ? 'Открыто' : 'Закрыто'}
                </span>
              </header>
              <time className="muted admin-support-time" dateTime={ticket.lastAt || ticket.createdAt}>
                {formatWhen(ticket.lastAt || ticket.createdAt)}
              </time>
              <p className="admin-support-text">
                {ticket.lastRole === 'staff' ? 'Поддержка: ' : ''}
                {ticket.lastPreview || ticket.text}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
