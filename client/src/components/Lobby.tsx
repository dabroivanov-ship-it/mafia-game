import type { GamePhase, LobbyRoom } from '../types';

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

interface LobbyProps {
  rooms: LobbyRoom[];
  onJoin: (roomId: number) => void;
  unreadMailCount?: number;
  onOpenMessages?: () => void;
}

export default function Lobby({ rooms, onJoin, unreadMailCount = 0, onOpenMessages }: LobbyProps) {
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
    </div>
  );
}
