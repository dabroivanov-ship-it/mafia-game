import { useState } from 'react';

const PHASE_LABELS = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

export default function Lobby({ rooms, user, onJoin, onLogout }) {
  const [joining, setJoining] = useState(null);

  const handleJoin = (roomId) => {
    setJoining(roomId);
    onJoin(roomId);
    setJoining(null);
  };

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>🎭 Мафия</h1>
        <p>Многопользовательская игра с автоматическим ведущим</p>
      </header>

      <div className="user-bar">
        <div className="user-info">
          <span className="user-name">{user.displayName}</span>
          <span className="user-login">@{user.username}</span>
          <span className="user-score">🏆 {user.totalScore} очков</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          Выйти
        </button>
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
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleJoin(room.id)}
              disabled={joining === room.id}
            >
              Войти
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
