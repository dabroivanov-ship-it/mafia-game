import { useEffect, useRef, useState } from 'react';
import type { GamePhase, LobbyRoom } from '../types';

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  roles: 'Раздача ролей',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

export type LobbyScreen = 'rooms' | 'cabinet' | 'cabinet-settings' | 'cabinet-messages';

interface LobbyProps {
  rooms: LobbyRoom[];
  onJoin: (roomId: number) => void;
  onOpenNews?: () => void;
  onOpenInfo?: () => void;
  onOpenCabinet?: () => void;
  onLogout?: () => void;
  unreadMailCount?: number;
  onOpenMessages?: () => void;
}

export default function Lobby({
  rooms,
  onJoin,
  onOpenNews,
  onOpenInfo,
  onOpenCabinet,
  onLogout,
  unreadMailCount = 0,
  onOpenMessages,
}: LobbyProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div className="lobby-header-row">
          <div className="lobby-header-brand">
            <h1>🎭 Мафия</h1>
            <p>Выберите комнату для игры</p>
            <button type="button" className="lobby-chat-link" onClick={onOpenMessages}>
              <span>&gt; 💬 Чат для общения</span>
              {unreadMailCount > 0 && (
                <span className="lobby-chat-badge">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
              )}
            </button>
          </div>

          <div className="lobby-header-menu" ref={menuRef}>
            <button
              type="button"
              className={`lobby-menu-btn ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="Меню"
            >
              ☰
            </button>
            {menuOpen && (
              <div className="lobby-menu-dropdown" role="menu">
                <button
                  type="button"
                  className="lobby-menu-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onOpenNews?.();
                  }}
                >
                  <span aria-hidden="true">📰</span>
                  <span>Новости</span>
                </button>
                <button
                  type="button"
                  className="lobby-menu-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onOpenInfo?.();
                  }}
                >
                  <span aria-hidden="true">ℹ️</span>
                  <span>Информация</span>
                </button>
                <button
                  type="button"
                  className="lobby-menu-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onOpenCabinet?.();
                  }}
                >
                  <span aria-hidden="true">👤</span>
                  <span>Кабинет</span>
                </button>
                <button
                  type="button"
                  className="lobby-menu-dropdown-item logout"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onLogout?.();
                  }}
                >
                  <span aria-hidden="true">🚪</span>
                  <span>Выход</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {unreadMailCount > 0 && (
        <button type="button" className="lobby-mail-notice" onClick={onOpenMessages}>
          <span className="lobby-mail-notice-icon">✉️</span>
          <span>
            У вас {unreadMailCount} нов{unreadMailCount === 1 ? 'ое' : unreadMailCount < 5 ? 'ых' : 'ых'}{' '}
            сообщени{unreadMailCount === 1 ? 'е' : unreadMailCount < 5 ? 'я' : 'й'} — открыть письма
          </span>
        </button>
      )}

      <div className="rooms-list">
        {rooms.length === 0 && <p className="muted">Загрузка комнат...</p>}
        {rooms.map((room) => (
          <div key={room.id} className="room-card">
            <div className="room-card-info">
              <h2>{room.name}</h2>
              <div className="room-card-meta">
                <span className="room-status">{PHASE_LABELS[room.phase] || room.phase}</span>
                <span className="room-count">
                  👥 {room.playerCount}/{room.maxPlayers}
                  {room.spectatorCount > 0 && ` · 👁 ${room.spectatorCount}`}
                </span>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => onJoin(room.id)}>
              Войти
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
