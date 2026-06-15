import type { RoomPlayer, RoomSpectator } from '../types';

interface PlayersListProps {
  players: RoomPlayer[];
  spectators?: RoomSpectator[];
  myId: number;
  onViewProfile?: (userId: number) => void;
}

export default function PlayersList({
  players,
  spectators = [],
  myId,
  onViewProfile,
}: PlayersListProps) {
  const alive = players.filter((p) => p.alive);
  const dead = players.filter((p) => !p.alive);

  const renderPerson = (p: RoomPlayer | RoomSpectator, showRole = false, isSpectator = false) => (
    <li key={p.id} className={p.id === myId ? 'me' : ''}>
      <button
        type="button"
        className="player-name-btn"
        onClick={() => p.userId && onViewProfile?.(p.userId)}
        disabled={!p.userId}
        title={p.userId ? 'Открыть профиль' : undefined}
      >
        {p.username || p.name}
      </button>
      {isSpectator && <span className="spectator-badge">👁</span>}
      {showRole && 'roleLabel' in p && p.roleLabel && (
        <span className="player-role">{p.roleLabel}</span>
      )}
      {!isSpectator && 'score' in p && <span className="player-score">{p.score} pts</span>}
      {!p.connected && <span className="offline">offline</span>}
      {'hasVoted' in p && p.hasVoted && <span className="voted">✓</span>}
    </li>
  );

  return (
    <div className="players-list">
      <h3>Игроки ({alive.length} живых)</h3>

      <ul className="players-alive">
        {alive.map((p) => renderPerson(p))}
      </ul>

      {dead.length > 0 && (
        <>
          <h4>Выбыли</h4>
          <ul className="players-dead">
            {dead.map((p) => renderPerson(p, true))}
          </ul>
        </>
      )}

      {spectators.length > 0 && (
        <>
          <h4>Наблюдатели ({spectators.length})</h4>
          <ul className="players-spectators">
            {spectators.map((p) => renderPerson(p, false, true))}
          </ul>
        </>
      )}
    </div>
  );
}
