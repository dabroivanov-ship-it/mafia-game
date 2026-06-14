export default function PlayersList({ players, myId }) {
  const alive = players.filter((p) => p.alive);
  const dead = players.filter((p) => !p.alive);

  return (
    <div className="players-list">
      <h3>Игроки ({alive.length} живых)</h3>

      <ul className="players-alive">
        {alive.map((p) => (
          <li key={p.id} className={p.id === myId ? 'me' : ''}>
            <span className="player-name">{p.name}</span>
            <span className="player-score">{p.score} pts</span>
            {!p.connected && <span className="offline">offline</span>}
            {p.hasVoted && <span className="voted">✓</span>}
          </li>
        ))}
      </ul>

      {dead.length > 0 && (
        <>
          <h4>Выбыли</h4>
          <ul className="players-dead">
            {dead.map((p) => (
              <li key={p.id}>
                <span className="player-name">{p.name}</span>
                <span className="player-role">{p.roleLabel}</span>
                <span className="player-score">{p.score} pts</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
