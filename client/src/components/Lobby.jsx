import { useState } from 'react';

const PHASE_LABELS = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

export default function Lobby({ rooms, onJoin, defaultName }) {
  const [name, setName] = useState(defaultName);
  const [joining, setJoining] = useState(null);

  const handleJoin = (roomId) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setJoining(roomId);
    onJoin(roomId, trimmed);
    setJoining(null);
  };

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>🎭 Мафия</h1>
        <p>Многопользовательская игра с автоматическим ведущим</p>
      </header>

      <div className="name-input-block">
        <label htmlFor="player-name">Ваше имя</label>
        <input
          id="player-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите имя..."
          maxLength={20}
        />
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
              disabled={!name.trim() || joining === room.id}
            >
              Войти
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
