import { useEffect, useRef } from 'react';
import type { UserNotification } from '../types';

function iconForType(type: UserNotification['type']): string {
  if (type === 'reputation_up') return '↑';
  if (type === 'reputation_down') return '↓';
  return '•';
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

interface NotificationBellProps {
  notifications: UserNotification[];
  unreadCount: number;
  open: boolean;
  loading?: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMarkAllRead: () => void;
  onSelect: (notification: UserNotification) => void;
}

export default function NotificationBell({
  notifications,
  unreadCount,
  open,
  loading = false,
  onToggle,
  onClose,
  onMarkAllRead,
  onSelect,
}: NotificationBellProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  return (
    <div className="notification-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className={`notification-bell-btn${open ? ' open' : ''}`}
        onClick={onToggle}
        aria-label="Уведомления"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="notification-bell-icon">
          <path
            d="M12 22a2.2 2.2 0 0 0 2.15-1.75H9.85A2.2 2.2 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Уведомления">
          <div className="notification-panel-head">
            <strong>Уведомления</strong>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onMarkAllRead}>
                Прочитать все
              </button>
            )}
          </div>

          {loading && notifications.length === 0 && <p className="notification-panel-empty muted">Загрузка…</p>}

          {!loading && notifications.length === 0 && (
            <p className="notification-panel-empty muted">Пока нет уведомлений</p>
          )}

          {notifications.length > 0 && (
            <ul className="notification-list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notification-item${item.isRead ? '' : ' unread'}`}
                    onClick={() => onSelect(item)}
                  >
                    <span
                      className={`notification-item-icon notification-item-icon--${item.type}`}
                      aria-hidden="true"
                    >
                      {iconForType(item.type)}
                    </span>
                    <span className="notification-item-body">
                      <span className="notification-item-title">{item.title}</span>
                      <span className="notification-item-text">{item.body}</span>
                      <span className="notification-item-time">{formatWhen(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
