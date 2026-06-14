export default function PlayersList({ players, myId, onViewProfile }) {
  const alive = players.filter((p) => p.alive);
  const dead = players.filter((p) => !p.alive);

  const renderPlayer = (p, showRole = false) => (
    <li key={p.id} className={p.id === myId ? 'me' : ''}>
      <button
        type="button"
        className="player-name-btn"
        onClick={() => p.userId && onViewProfile?.(p.userId)}
        disabled={!p.userId}
        title={p.userId ? 'Открыть профиль' : undefined}
      >
        {p.name}
      </button>
      {showRole && p.roleLabel && <span className="player-role">{p.roleLabel}</span>}
      <span className="player-score">{p.score} pts</span>
      {!p.connected && <span className="offline">offline</span>}
      {p.hasVoted && <span className="voted">✓</span>}
    </li>
  );

  return (
    <div className="players-list">
      <h3>Игроки ({alive.length} живых)</h3>

      <ul className="players-alive">
        {alive.map((p) => renderPlayer(p))}
      </ul>

      {dead.length > 0 && (
        <>
          <h4>Выбыли</h4>
          <ul className="players-dead">
            {dead.map((p) => renderPlayer(p, true))}
          </ul>
        </>
      )}
    </div>
  );
}
