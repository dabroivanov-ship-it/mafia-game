import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../api';
import type { LeaderboardEntry, User } from '../types';
import { profileStatsPath } from '../profileRouting';
import UserProfileModal from './UserProfileModal';

const PAGE_SIZE = 15;

interface PlayerRatingProps {
  embedded?: boolean;
  currentUser?: User | null;
  onWriteMessage?: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
}

export default function PlayerRating({
  embedded = false,
  currentUser = null,
  onWriteMessage,
  onOpenStatistics,
}: PlayerRatingProps) {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const { players: list, total: count } = await fetchLeaderboard(PAGE_SIZE, page * PAGE_SIZE);
        setPlayers(list);
        setTotal(count);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  return (
    <div className={embedded ? 'rating-embedded' : 'rating-page'}>
      {loading && <p className="muted">Загрузка...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && total === 0 && (
        <p className="muted">Пока нет игроков в рейтинге</p>
      )}

      {!loading && !error && players.length > 0 && (
        <>
          <div className="rating-table-wrap">
            <table className="rating-table rating-table-compact">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ник</th>
                  <th>Игр</th>
                  <th>MMR</th>
                  <th>Репутация</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const isSelf = currentUser?.id === player.id;
                  const canOpenProfile = currentUser != null;

                  return (
                    <tr key={player.id} className={isSelf ? 'rating-row-self' : ''}>
                      <td className="muted">{player.rank}</td>
                      <td>
                        {canOpenProfile ? (
                          <button
                            type="button"
                            className="rating-name-link"
                            onClick={() => setProfileUserId(player.id)}
                          >
                            {player.username}
                          </button>
                        ) : (
                          player.username
                        )}
                      </td>
                      <td>{player.gamesPlayed}</td>
                      <td className="rating-score">
                        {onOpenStatistics && currentUser ? (
                          <button
                            type="button"
                            className="rating-mmr-link"
                            onClick={() => onOpenStatistics(player.id)}
                          >
                            {player.mmr ?? player.totalScore}
                          </button>
                        ) : (
                          <a href={profileStatsPath(player.id)} className="rating-mmr-link">
                            {player.mmr ?? player.totalScore}
                          </a>
                        )}
                      </td>
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

          {totalPages > 1 && (
            <nav className="rating-pagination" aria-label="Страницы рейтинга">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Назад
              </button>
              <span className="rating-pagination-info muted">
                Страница {page + 1} из {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд →
              </button>
            </nav>
          )}
        </>
      )}

      {profileUserId != null && currentUser && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUser.id}
          viewerIsAdmin={currentUser.isAdmin}
          viewerCanModerate={currentUser.isStaff}
          onClose={() => setProfileUserId(null)}
          onWriteMessage={onWriteMessage}
          onOpenStatistics={onOpenStatistics}
        />
      )}
    </div>
  );
}
