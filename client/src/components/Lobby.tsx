import { avatarUrl } from '../api';
import type { GamePhase, LobbyRoom, User } from '../types';

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
  user: User;
  onJoin: (roomId: number) => void;
  onOpenNews?: () => void;
  onOpenCabinet?: () => void;
  unreadMailCount?: number;
  onOpenMessages?: () => void;
}

export default function Lobby({
  rooms,
  user,
  onJoin,
  onOpenNews,
  onOpenCabinet,
  unreadMailCount = 0,
  onOpenMessages,
}: LobbyProps) {
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

      <section className="lobby-cabinet-section lobby-mobile-shortcuts">
        <button type="button" className="lobby-news-card" onClick={onOpenNews}>
          <span className="info-hub-icon" aria-hidden="true">📰</span>
          <span className="lobby-cabinet-body">
            <strong>Новости</strong>
            <span className="muted">Объявления и обновления</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">→</span>
        </button>

        <h2 className="lobby-cabinet-title">👤 Кабинет</h2>
        <button type="button" className="lobby-cabinet-card" onClick={onOpenCabinet}>
          {user.avatar ? (
            <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="lobby-cabinet-avatar" />
          ) : (
            <div className="lobby-cabinet-avatar placeholder">👤</div>
          )}
          <span className="lobby-cabinet-body">
            <strong>{user.displayName}</strong>
            <span className="muted">@{user.username} · 🏆 {user.totalScore}</span>
          </span>
          {unreadMailCount > 0 && (
            <span className="lobby-cabinet-badge">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
          )}
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </section>
    </div>
  );
}
