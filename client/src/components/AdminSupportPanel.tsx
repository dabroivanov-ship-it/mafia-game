import { useCallback, useEffect, useState } from 'react';
import {
  adminSetSupportTicketStatus,
  avatarUrl,
  fetchAdminSupportTickets,
} from '../api';
import type { SupportTicket, SupportTicketStatus } from '../types';

interface AdminSupportPanelProps {
  onOpenStatistics?: (userId: number) => void;
  onReplyToUser?: (userId: number, username: string) => void;
  onOpenCountChange?: (count: number) => void;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

export default function AdminSupportPanel({
  onOpenStatistics,
  onReplyToUser,
  onOpenCountChange,
}: AdminSupportPanelProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-support-panel">
      <div className="admin-support-toolbar">
        <p className="muted admin-support-hint">
          Обращения игроков. Ответ пишите в личные сообщения.
        </p>
        <label className="admin-support-filter">
          Показать
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SupportTicketStatus | 'all')}
          >
            <option value="open">Новые</option>
            <option value="done">Закрытые</option>
            <option value="all">Все</option>
          </select>
        </label>
      </div>

      {loading && tickets.length === 0 && <p className="muted">Загрузка...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && tickets.length === 0 && (
        <p className="muted">
          {filter === 'open' ? 'Новых обращений нет.' : 'Обращений пока нет.'}
        </p>
      )}

      <ul className="admin-support-list">
        {tickets.map((ticket) => (
          <li
            key={ticket.id}
            className={`admin-support-card${ticket.status === 'open' ? ' is-open' : ''}`}
          >
            <header className="admin-support-card-head">
              <div>
                <strong>{ticket.displayName}</strong>
                {ticket.username && (
                  <span className="muted"> @{ticket.username}</span>
                )}
              </div>
              <span className={`admin-support-status admin-support-status--${ticket.status}`}>
                {ticket.status === 'open' ? 'Новое' : 'Закрыто'}
              </span>
            </header>
            <time className="muted admin-support-time" dateTime={ticket.createdAt}>
              {formatWhen(ticket.createdAt)}
            </time>
            <p className="admin-support-text">{ticket.text}</p>
            {ticket.attachmentUrl && (
              <a
                href={avatarUrl(ticket.attachmentUrl) ?? ticket.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="admin-support-photo-link"
              >
                <img
                  src={avatarUrl(ticket.attachmentUrl) ?? ticket.attachmentUrl}
                  alt="Вложение"
                  className="admin-support-photo"
                />
              </a>
            )}
            <div className="admin-support-actions">
              {onReplyToUser && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onReplyToUser(ticket.userId, ticket.username)}
                >
                  Ответить
                </button>
              )}
              {onOpenStatistics && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOpenStatistics(ticket.userId)}
                >
                  Профиль
                </button>
              )}
              {ticket.status === 'open' ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === ticket.id}
                  onClick={() => void setStatus(ticket, 'done')}
                >
                  Закрыть
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === ticket.id}
                  onClick={() => void setStatus(ticket, 'open')}
                >
                  Открыть снова
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
