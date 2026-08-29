import type { GamePhase, LobbyRoom, LobbyAnnouncement } from '../types';
import SiteOnlineStatus from './SiteOnlineStatus';

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
  | 'cabinet-account-settings'
  | 'cabinet-messages'
  | 'cabinet-support'
  | 'cabinet-sanctions'
  | 'cabinet-friends';

interface LobbyProps {
  rooms: LobbyRoom[];
  siteOnlineCount?: number;
  announcement?: LobbyAnnouncement | null;
  onJoin: (roomId: number) => void;
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
            {room.aiEnabled && (room.aiCount ?? 0) > 0 && (
              <span className="room-status">AI {room.aiCount}</span>
            )}
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
  announcement = null,
  onJoin,
  onOpenOnlineUsers,
}: LobbyProps) {
  const gameRooms = rooms.filter((r) => r.kind === 'game');
  const chatRooms = rooms.filter((r) => r.kind === 'chat');

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div className="lobby-header-brand">
          <h1>Мафия</h1>
          <p>Выберите комнату для игры</p>
        </div>
      </header>

      {announcement?.enabled && announcement.text.trim() && (
        <div className="lobby-announcement" role="status">
          <span className="lobby-announcement-icon" aria-hidden="true">
            📢
          </span>
          <p>{announcement.text}</p>
        </div>
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

      {onOpenOnlineUsers && (
        <footer className="lobby-online-footer">
          <SiteOnlineStatus count={siteOnlineCount} onOpen={onOpenOnlineUsers} />
        </footer>
      )}
    </div>
  );
}
