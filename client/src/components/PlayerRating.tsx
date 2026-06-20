import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../api';
import type { LeaderboardEntry, User } from '../types';
import UserProfileModal from './UserProfileModal';

interface PlayerRatingProps {
  embedded?: boolean;
  currentUser?: User | null;
  onWriteMessage?: (userId: number, username: string) => void;
}

export default function PlayerRating({
  embedded = false,
  currentUser = null,
  onWriteMessage,
}: PlayerRatingProps) {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

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
      {loading && <p className="muted">Загрузка...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && players.length === 0 && (
        <p className="muted">Пока нет игроков в рейтинге</p>
      )}

      {!loading && !error && players.length > 0 && (
        <div className="rating-table-wrap">
          <table className="rating-table rating-table-compact">
            <thead>
              <tr>
                <th>Ник</th>
                <th>Игр</th>
                <th>Очки</th>
                <th>Репутация</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const isSelf = currentUser?.id === player.id;
                const canOpenProfile = currentUser != null;

                return (
                  <tr key={player.id} className={isSelf ? 'rating-row-self' : ''}>
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

      {profileUserId != null && currentUser && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUser.id}
          viewerIsAdmin={currentUser.isAdmin}
          viewerCanModerate={currentUser.isStaff}
          onClose={() => setProfileUserId(null)}
          onWriteMessage={onWriteMessage}
        />
      )}
    </div>
  );
}
