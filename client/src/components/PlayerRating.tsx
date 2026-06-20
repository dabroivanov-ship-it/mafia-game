import { useEffect, useState } from 'react';
import { avatarUrl, fetchLeaderboard } from '../api';
import type { LeaderboardEntry } from '../types';

interface PlayerRatingProps {
  embedded?: boolean;
  currentUserId?: number | null;
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export default function PlayerRating({ embedded = false, currentUserId = null }: PlayerRatingProps) {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const { players: list } = await fetchLeaderboard(100);
        setPlayers(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={embedded ? 'rating-embedded' : 'rating-page'}>
      {!embedded && (
        <header className="page-header">
          <h1>🏆 Рейтинг игроков</h1>
          <p className="muted">Топ игроков по очкам за сыгранные партии</p>
        </header>
      )}

      {loading && <p className="muted">Загрузка...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && players.length === 0 && (
        <p className="muted">Пока нет игроков в рейтинге</p>
      )}

      {!loading && !error && players.length > 0 && (
        <div className="rating-table-wrap">
          <table className="rating-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Игрок</th>
                <th>Город</th>
                <th>Игр</th>
                <th>Очки</th>
                <th>Репутация</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const isSelf = currentUserId != null && player.id === currentUserId;
                return (
                  <tr
                    key={player.id}
                    className={[
                      player.rank <= 3 ? 'rating-row-top' : '',
                      isSelf ? 'rating-row-self' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td className="rating-rank">{rankLabel(player.rank)}</td>
                    <td>
                      <div className="rating-player-cell">
                        {player.avatar ? (
                          <img
                            src={avatarUrl(player.avatar) ?? undefined}
                            alt=""
                            className="rating-avatar"
                          />
                        ) : (
                          <span className="rating-avatar placeholder">👤</span>
                        )}
                        <div>
                          <strong>{player.displayName}</strong>
                          <span className="muted">@{player.username}</span>
                          {player.isAdmin && <span className="admin-badge">admin</span>}
                          {player.isModerator && <span className="mod-badge">mod</span>}
                          {isSelf && <span className="rating-you-badge">вы</span>}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{player.city || '—'}</td>
                    <td>{player.gamesPlayed}</td>
                    <td className="rating-score">{player.totalScore}</td>
                    <td
                      className={
                        player.reputation > 0
                          ? 'reputation-positive'
                          : player.reputation < 0
                            ? 'reputation-negative'
                            : 'muted'
                      }
                    >
                      {player.reputation > 0 ? '+' : ''}
                      {player.reputation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
