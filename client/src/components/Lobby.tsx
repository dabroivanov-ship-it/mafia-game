import { useState } from 'react';
import { avatarUrl } from '../api';
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
  onLogout?: () => void;
  unreadMailCount?: number;
  onOpenMessages?: () => void;
}

export default function Lobby({
  rooms,
  onJoin,
  onOpenNews,
  onOpenInfo,
  onLogout,
  unreadMailCount = 0,
  onOpenMessages,
}: LobbyProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>🎭 Мафия</h1>
        <p>Выберите комнату для игры</p>
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

      <section className="lobby-mobile-menu">
        <button
          type="button"
          className={`lobby-mobile-menu-toggle ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
        >
          <span>☰ Меню</span>
          <span className="lobby-mobile-menu-chevron" aria-hidden="true">
            {mobileMenuOpen ? '▲' : '▼'}
          </span>
        </button>
        {mobileMenuOpen && (
          <div className="lobby-mobile-menu-items">
            <button
              type="button"
              className="lobby-mobile-menu-item"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenNews?.();
              }}
            >
              <span aria-hidden="true">📰</span>
              <span>Новости</span>
            </button>
            <button
              type="button"
              className="lobby-mobile-menu-item"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenInfo?.();
              }}
            >
              <span aria-hidden="true">ℹ️</span>
              <span>Информация</span>
            </button>
            <button
              type="button"
              className="lobby-mobile-menu-item logout"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout?.();
              }}
            >
              <span aria-hidden="true">🚪</span>
              <span>Выход</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
