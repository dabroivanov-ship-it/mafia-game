import type { GamePhase, LobbyRoom } from '../types';

function mailNoticeLabel(count: number): string {
  if (count === 1) return 'У вас 1 новое сообщение';
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `У вас ${count} новых сообщения`;
  }
  return `У вас ${count} новых сообщений`;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  roles: 'Раздача ролей',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

export type LobbyScreen =
  | 'rooms'
  | 'online-users'
  | 'cabinet'
  | 'cabinet-settings'
  | 'cabinet-site-settings'
  | 'cabinet-messages'
  | 'cabinet-support'
  | 'cabinet-search';

interface LobbyProps {
  rooms: LobbyRoom[];
  siteOnlineCount?: number;
  onJoin: (roomId: number) => void;
  unreadMailCount?: number;
  onOpenMessages?: () => void;
  onOpenOnlineUsers?: () => void;
}

function RoomCard({
  room,
  onJoin,
  joinLabel,
  showPhase = true,
}: {
  room: LobbyRoom;
  onJoin: (roomId: number) => void;
  joinLabel: string;
  showPhase?: boolean;
}) {
  const isChat = room.kind === 'chat';

  return (
    <div className={`room-card-wrap${isChat ? ' room-card-wrap--chat' : ''}`}>
      <div className="room-card">
        <div className="room-card-info">
          <h2>{room.name}</h2>
          <div className="room-card-meta">
            {showPhase && !isChat && (
              <span className="room-status">{PHASE_LABELS[room.phase] || room.phase}</span>
            )}
            <span className="room-count">{room.playerCount}</span>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onJoin(room.id)}>
          {joinLabel}
        </button>
      </div>
    </div>
  );
}

export default function Lobby({
  rooms,
  siteOnlineCount = 0,
  onJoin,
  unreadMailCount = 0,
  onOpenMessages,
  onOpenOnlineUsers,
}: LobbyProps) {
  const gameRooms = rooms.filter((r) => r.kind !== 'chat');
  const chatRooms = rooms.filter((r) => r.kind === 'chat');

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div className="lobby-header-brand">
          <h1>Мафия</h1>
          <p>Выберите комнату для игры</p>
        </div>
      </header>

      {unreadMailCount > 0 && (
        <button type="button" className="lobby-mail-notice" onClick={onOpenMessages}>
          <span className="lobby-mail-notice-icon">✉️</span>
          <span>
            {mailNoticeLabel(unreadMailCount)} — открыть
          </span>
        </button>
      )}

      <section className="lobby-rooms-section">
        <h2 className="lobby-section-title">Игровые комнаты</h2>
        <div className="rooms-list">
          {rooms.length === 0 && <p className="muted">Загрузка комнат...</p>}
          {gameRooms.length === 0 && rooms.length > 0 && (
            <p className="muted">Игровых комнат нет</p>
          )}
          {gameRooms.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={onJoin} joinLabel="Войти" />
          ))}
        </div>
      </section>

      <section className="lobby-rooms-section">
        <h2 className="lobby-section-title">Чат</h2>
        <div className="rooms-list">
          {chatRooms.length === 0 && rooms.length > 0 && (
            <p className="muted">Чат-комнат пока нет</p>
          )}
          {chatRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={onJoin}
              joinLabel="Войти"
              showPhase={false}
            />
          ))}
        </div>
      </section>

      <footer className="lobby-online-footer">
        <p className="lobby-online-count muted">
          На сайте:{' '}
          <button type="button" className="lobby-online-link" onClick={onOpenOnlineUsers}>
            {siteOnlineCount}
          </button>{' '}
          в сети
        </p>
      </footer>
    </div>
  );
}
