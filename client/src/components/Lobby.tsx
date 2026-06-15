import { avatarUrl } from '../api';
import News from './News';
import CabinetHub from './CabinetHub';
import CabinetSettings from './CabinetSettings';
import Messages from './Messages';
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

export type LobbyScreen = 'rooms' | 'news' | 'cabinet' | 'cabinet-settings' | 'cabinet-messages';

interface LobbyProps {
  rooms: LobbyRoom[];
  user: User;
  screen: LobbyScreen;
  onScreenChange: (screen: LobbyScreen) => void;
  onJoin: (roomId: number) => void;
  onUserUpdate: (user: User) => void;
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
  screen,
  onScreenChange,
  onJoin,
  onUserUpdate,
  composeToUserId = null,
  composeToUsername = null,
  onComposeReset,
  unreadMailCount = 0,
  onUnreadChange,
  onOpenMessages,
}: LobbyProps) {
  if (screen === 'news') {
    return <News onBack={() => onScreenChange('rooms')} />;
  }

  if (screen === 'cabinet') {
    return (
      <CabinetHub
        user={user}
        unreadMailCount={unreadMailCount}
        onOpenSettings={() => onScreenChange('cabinet-settings')}
        onOpenMessages={() => onScreenChange('cabinet-messages')}
        onBack={() => onScreenChange('rooms')}
      />
    );
  }

  if (screen === 'cabinet-settings') {
    return (
      <CabinetSettings
        user={user}
        onUpdate={onUserUpdate}
        onBack={() => onScreenChange('cabinet')}
      />
    );
  }

  if (screen === 'cabinet-messages') {
    return (
      <Messages
        composeToUserId={composeToUserId}
        composeToUsername={composeToUsername}
        onUnreadChange={onUnreadChange}
        onBack={() => {
          onComposeReset?.();
          onScreenChange('cabinet');
        }}
      />
    );
  }

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

      <section className="lobby-cabinet-section">
        <button type="button" className="lobby-news-card" onClick={() => onScreenChange('news')}>
          <span className="info-hub-icon" aria-hidden="true">📰</span>
          <span className="lobby-cabinet-body">
            <strong>Новости</strong>
            <span className="muted">Объявления и обновления</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">→</span>
        </button>

        <h2 className="lobby-cabinet-title">👤 Кабинет</h2>
        <button type="button" className="lobby-cabinet-card" onClick={() => onScreenChange('cabinet')}>
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
