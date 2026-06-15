import type { GamePhase, LobbyRoom, User } from '../types';
import Cabinet from './Cabinet';

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

export type LobbyTab = 'rooms' | 'cabinet';
export type CabinetTab = 'settings' | 'messages';

interface LobbyProps {
  rooms: LobbyRoom[];
  user: User;
  tab: LobbyTab;
  onTabChange: (tab: LobbyTab) => void;
  onJoin: (roomId: number) => void;
  onUserUpdate: (user: User) => void;
  cabinetTab: CabinetTab;
  onCabinetTabChange: (tab: CabinetTab) => void;
  composeToUserId?: number | null;
  composeToUsername?: string | null;
  onComposeReset?: () => void;
  unreadMailCount?: number;
  onUnreadChange?: (count: number) => void;
  onOpenMessages?: () => void;
}

export default function Lobby({
  rooms,
  user,
  tab,
  onTabChange,
  onJoin,
  onUserUpdate,
  cabinetTab,
  onCabinetTabChange,
  composeToUserId = null,
  composeToUsername = null,
  onComposeReset,
  unreadMailCount = 0,
  onUnreadChange,
  onOpenMessages,
}: LobbyProps) {
  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>🎭 Мафия</h1>
        <p>{tab === 'rooms' ? 'Выберите комнату для игры' : 'Ваш личный кабинет'}</p>
      </header>

      <div className="lobby-tabs">
        <button
          type="button"
          className={`lobby-tab ${tab === 'rooms' ? 'active' : ''}`}
          onClick={() => onTabChange('rooms')}
        >
          🎮 Комнаты
        </button>
        <button
          type="button"
          className={`lobby-tab ${tab === 'cabinet' ? 'active' : ''}`}
          onClick={() => onTabChange('cabinet')}
        >
          👤 Кабинет
          {unreadMailCount > 0 && (
            <span className="lobby-tab-badge">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
          )}
        </button>
      </div>

      {tab === 'rooms' && (
        <>
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
        </>
      )}

      {tab === 'cabinet' && (
        <Cabinet
          user={user}
          onUpdate={onUserUpdate}
          onBackToRooms={() => {
            onComposeReset?.();
            onCabinetTabChange('settings');
            onTabChange('rooms');
          }}
          initialTab={cabinetTab}
          onTabChange={onCabinetTabChange}
          composeToUserId={composeToUserId}
          composeToUsername={composeToUsername}
          onUnreadChange={onUnreadChange}
          embedded
        />
      )}
    </div>
  );
}
