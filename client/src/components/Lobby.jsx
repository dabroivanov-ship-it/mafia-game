import { avatarUrl } from '../api.js';

const PHASE_LABELS = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

export default function Lobby({ rooms, user, onJoin }) {
  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>🎭 Мафия</h1>
        <p>Выберите комнату для игры</p>
      </header>

      <div className="user-bar">
        <div className="user-info">
          {user.avatar ? (
            <img src={avatarUrl(user.avatar)} alt="" className="user-avatar-sm" />
          ) : (
            <span className="user-avatar-sm placeholder">👤</span>
          )}
          <div>
            <span className="user-name">{user.displayName}</span>
            {user.city && <span className="user-city">📍 {user.city}</span>}
            <span className="user-score">🏆 {user.totalScore} очков</span>
          </div>
        </div>
      </div>

      <div className="rooms-list">
        {rooms.length === 0 && <p className="muted">Загрузка комнат...</p>}
        {rooms.map((room) => (
          <div key={room.id} className="room-card">
            <div className="room-card-info">
              <h2>{room.name}</h2>
              <span className="room-status">{PHASE_LABELS[room.phase] || room.phase}</span>
              <span className="room-count">
                {room.playerCount} / {room.maxPlayers}
                {room.spectatorCount > 0 && ` · 👁 ${room.spectatorCount}`}
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => onJoin(room.id)}>
              Войти
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
