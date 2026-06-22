import { useEffect, useState } from 'react';
import { avatarUrl, fetchUserStatistics } from '../api';
import type { User, UserStatistics } from '../types';
import { profileStatsPath } from '../profileRouting';
import { updatePageMeta } from '../seo';

interface UserStatisticsPageProps {
  userId: number;
  currentUser?: User | null;
  onBack: () => void;
  onWriteMessage?: (userId: number, username: string) => void;
}

export default function UserStatisticsPage({
  userId,
  currentUser = null,
  onBack,
  onWriteMessage,
}: UserStatisticsPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchUserStatistics(userId)
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setStats(res.statistics);
        updatePageMeta({
          title: `Статистика ${res.user.username}`,
          description: `MMR, винрейт и история игр игрока ${res.user.displayName || res.user.username}.`,
          path: profileStatsPath(userId),
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки статистики');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const canWriteMail = !!currentUser && currentUser.id !== userId && !!onWriteMessage;

  return (
    <div className="cabinet-page user-stats-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Назад
        </button>
      </nav>

      {loading && <p className="muted">Загрузка статистики...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && user && stats && (
        <>
          <header className="user-stats-hero">
            <div className="user-stats-hero-main">
              {user.avatar ? (
                <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="user-stats-avatar" />
              ) : (
                <div className="user-stats-avatar placeholder">👤</div>
              )}
              <div>
                <h1>{user.displayName || user.username}</h1>
                <p className="muted">@{user.username}</p>
                {user.city && <p className="muted">{user.city}</p>}
              </div>
            </div>
            <div className="user-stats-mmr-card">
              <span className="user-stats-mmr-label">MMR</span>
              <strong className="user-stats-mmr-value">{stats.mmr}</strong>
              {stats.rank != null && <span className="muted">Место в рейтинге: #{stats.rank}</span>}
            </div>
          </header>

          <section className="user-stats-section">
            <h2>Общая статистика</h2>
            <div className="user-stats-grid">
              <div className="user-stats-card">
                <span className="user-stats-card-label">Игр</span>
                <strong>{stats.gamesPlayed}</strong>
              </div>
              <div className="user-stats-card">
                <span className="user-stats-card-label">Побед</span>
                <strong>{stats.wins}</strong>
              </div>
              <div className="user-stats-card">
                <span className="user-stats-card-label">Поражений</span>
                <strong>{stats.losses}</strong>
              </div>
              <div className="user-stats-card">
                <span className="user-stats-card-label">Винрейт</span>
                <strong>{stats.winRate}%</strong>
              </div>
              <div className="user-stats-card">
                <span className="user-stats-card-label">Средний балл</span>
                <strong>{stats.averageScore}</strong>
              </div>
            </div>
          </section>

          <section className="user-stats-section">
            <h2>По командам</h2>
            <div className="user-stats-team-grid">
              <div className="user-stats-team-card">
                <h3>За мирных</h3>
                <ul>
                  <li>
                    <span>Игр</span>
                    <strong>{stats.town.games}</strong>
                  </li>
                  <li>
                    <span>Побед</span>
                    <strong>{stats.town.wins}</strong>
                  </li>
                  <li>
                    <span>Винрейт</span>
                    <strong>{stats.town.winRate}%</strong>
                  </li>
                </ul>
              </div>
              <div className="user-stats-team-card">
                <h3>За мафию</h3>
                <ul>
                  <li>
                    <span>Игр</span>
                    <strong>{stats.mafia.games}</strong>
                  </li>
                  <li>
                    <span>Побед</span>
                    <strong>{stats.mafia.wins}</strong>
                  </li>
                  <li>
                    <span>Винрейт</span>
                    <strong>{stats.mafia.winRate}%</strong>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {stats.roles.length > 0 && (
            <section className="user-stats-section">
              <h2>По ролям</h2>
              <div className="rating-table-wrap">
                <table className="rating-table user-stats-roles-table">
                  <thead>
                    <tr>
                      <th>Роль</th>
                      <th>Игр</th>
                      <th>Побед</th>
                      <th>Винрейт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.roles.map((role) => (
                      <tr key={role.role}>
                        <td>{role.roleLabel}</td>
                        <td>{role.games}</td>
                        <td>{role.wins}</td>
                        <td>{role.winRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="user-stats-section">
            <h2>Последние игры</h2>
            {stats.recentGames.length === 0 ? (
              <p className="muted">Пока нет сыгранных партий в статистике</p>
            ) : (
              <div className="rating-table-wrap">
                <table className="rating-table user-stats-games-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Роль</th>
                      <th>Результат</th>
                      <th>Баллы</th>
                      <th>MMR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentGames.map((game) => (
                      <tr key={game.id}>
                        <td>{new Date(game.createdAt).toLocaleString('ru-RU')}</td>
                        <td>{game.roleLabel}</td>
                        <td className={game.won ? 'user-stats-win' : 'user-stats-loss'}>
                          {game.won ? 'Победа' : 'Поражение'}
                        </td>
                        <td>{game.score > 0 ? `+${game.score}` : game.score}</td>
                        <td className={game.mmrDelta >= 0 ? 'user-stats-win' : 'user-stats-loss'}>
                          {game.mmrDelta > 0 ? `+${game.mmrDelta}` : game.mmrDelta} → {game.mmrAfter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {canWriteMail && (
            <div className="user-stats-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onWriteMessage?.(user.id, user.username)}
              >
                ✉️ Написать игроку
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
