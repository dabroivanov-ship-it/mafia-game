import { useEffect, useState } from 'react';
import { fetchQuizLeaderboard, avatarUrl } from '../api';
import type { QuizLeaderboardEntry, User } from '../types';
import UserProfileModal from './UserProfileModal';

interface QuizLeadersProps {
  embedded?: boolean;
  currentUser?: User | null;
  onWriteMessage?: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
}

export default function QuizLeaders({
  embedded = false,
  currentUser = null,
  onWriteMessage,
  onOpenStatistics,
}: QuizLeadersProps) {
  const [players, setPlayers] = useState<QuizLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const { players: list } = await fetchQuizLeaderboard(10);
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
        <p className="muted">Пока никто не ответил на вопросы викторины</p>
      )}

      {!loading && !error && players.length > 0 && (
        <div className="rating-table-wrap">
          <table className="rating-table rating-table-compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Игрок</th>
                <th>Верных ответов</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => {
                const isSelf = currentUser?.id === player.id;
                const canOpenProfile = currentUser != null;

                return (
                  <tr key={player.id} className={isSelf ? 'rating-row-self' : ''}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="quiz-leader-player">
                        {player.avatar ? (
                          <img
                            src={avatarUrl(player.avatar) ?? undefined}
                            alt=""
                            className="quiz-leader-avatar"
                          />
                        ) : (
                          <span className="quiz-leader-avatar placeholder">👤</span>
                        )}
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
                      </div>
                    </td>
                    <td className="rating-score">{player.quizCorrectAnswers}</td>
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
          onClose={() => setProfileUserId(null)}
          onWriteMessage={onWriteMessage}
          onOpenStatistics={onOpenStatistics}
        />
      )}
    </div>
  );
}
