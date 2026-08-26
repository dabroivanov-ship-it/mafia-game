import { useEffect, useMemo, useState } from 'react';
import { avatarUrl, fetchUserStatistics } from '../api';
import type { RecentGameStat, User, UserStatistics } from '../types';
import { profileStatsPath } from '../profileRouting';
import { updatePageMeta } from '../seo';
import {
  formatChartInt,
  GlowBarRows,
  GlowDonut,
  GlowLineChart,
  GlowRingStat,
} from './StatsCharts';

interface UserStatisticsPageProps {
  userId: number;
  currentUser?: User | null;
  onBack: () => void;
  onWriteMessage?: (userId: number, username: string) => void;
}

function mmrSeries(games: RecentGameStat[]): number[] {
  if (games.length === 0) return [1000];
  return [...games].reverse().map((g) => g.mmrAfter);
}

function RecentBars({ games }: { games: RecentGameStat[] }) {
  const chronological = useMemo(() => [...games].reverse().slice(-10), [games]);
  if (chronological.length === 0) {
    return <p className="muted">Пока нет сыгранных партий в статистике</p>;
  }
  return (
    <div className="user-stats-recent-bars" role="list">
      {chronological.map((game) => {
        const tone = game.isDraw ? 'draw' : game.won ? 'win' : 'loss';
        const height = Math.max(18, Math.min(100, 40 + Math.abs(game.mmrDelta) * 2));
        return (
          <div key={game.id} className="user-stats-recent-col" role="listitem" title={game.roleLabel}>
            <span
              className={`user-stats-recent-bar user-stats-recent-bar--${tone}`}
              style={{ height: `${height}%` }}
            />
            <span className="user-stats-recent-delta muted">
              {game.mmrDelta > 0 ? `+${game.mmrDelta}` : game.mmrDelta}
            </span>
          </div>
        );
      })}
    </div>
  );
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
  const draws = stats ? Math.max(0, stats.gamesPlayed - stats.wins - stats.losses) : 0;
  const mmrValues = useMemo(() => (stats ? mmrSeries(stats.recentGames) : [1000]), [stats]);
  const roleMax = Math.max(...(stats?.roles.map((r) => r.games) ?? [0]), 1);

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
        <div className="admin-stats-overview user-stats-overview">
          <header className="user-stats-hero">
            <div className="user-stats-hero-main">
              {user.avatar ? (
                <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="user-stats-avatar" />
              ) : (
                <div className="user-stats-avatar placeholder" aria-hidden="true" />
              )}
              <div>
                <h1>{user.displayName || user.username}</h1>
                <p className="muted">@{user.username}</p>
              </div>
            </div>
            <div className="user-stats-mmr-card">
              <span className="user-stats-mmr-label">MMR</span>
              <strong className="user-stats-mmr-value">{stats.mmr}</strong>
              {stats.rank != null && <span className="muted">Место в рейтинге: #{stats.rank}</span>}
              {canWriteMail && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm user-stats-write-btn"
                  onClick={() => onWriteMessage?.(user.id, user.username)}
                >
                  Написать
                </button>
              )}
            </div>
          </header>

          <div className="admin-stats-grid">
            <article className="admin-stats-card admin-stats-card--wide">
              <div className="admin-stats-card-head">
                <h5>Динамика MMR</h5>
                <span className="muted">по последним играм</span>
              </div>
              <GlowLineChart
                idPrefix={`user-mmr-${userId}`}
                label="Динамика MMR"
                values={mmrValues}
                highlight={stats.mmr}
                mode="minmax"
                withBars
              />
              <p className="admin-stats-card-footnote muted">
                Средний балл: <strong>{stats.averageScore}</strong>
                {' · '}
                игр: <strong>{formatChartInt(stats.gamesPlayed)}</strong>
              </p>
            </article>

            <article className="admin-stats-card">
              <div className="admin-stats-card-head">
                <h5>Результаты</h5>
                <span className="muted">все партии</span>
              </div>
              <GlowDonut
                idPrefix={`user-res-${userId}`}
                centerLabel="игр"
                segments={[
                  { label: 'Победы', value: stats.wins, tone: 'success' },
                  { label: 'Поражения', value: stats.losses, tone: 'danger' },
                  { label: 'Ничьи', value: draws, tone: 'warning' },
                ]}
              />
            </article>

            <GlowRingStat
              idPrefix={`user-wr-${userId}`}
              title="Винрейт"
              value={`${stats.winRate}%`}
              share={stats.winRate}
              hint={`${formatChartInt(stats.wins)} из ${formatChartInt(stats.gamesPlayed)}`}
            />
            <GlowRingStat
              idPrefix={`user-town-${userId}`}
              title="За мирных"
              value={`${stats.town.winRate}%`}
              share={stats.town.winRate}
              hint={`${formatChartInt(stats.town.wins)} / ${formatChartInt(stats.town.games)}`}
            />
            <GlowRingStat
              idPrefix={`user-mafia-${userId}`}
              title="За мафию"
              value={`${stats.mafia.winRate}%`}
              share={stats.mafia.winRate}
              hint={`${formatChartInt(stats.mafia.wins)} / ${formatChartInt(stats.mafia.games)}`}
            />

            <article className="admin-stats-card">
              <div className="admin-stats-card-head">
                <h5>По командам</h5>
              </div>
              <GlowBarRows
                rows={[
                  {
                    label: 'Мирные · игр',
                    value: stats.town.games,
                    max: Math.max(stats.town.games, stats.mafia.games, 1),
                  },
                  {
                    label: 'Мафия · игр',
                    value: stats.mafia.games,
                    max: Math.max(stats.town.games, stats.mafia.games, 1),
                  },
                  {
                    label: 'Мирные · винрейт',
                    value: stats.town.winRate,
                    max: 100,
                    suffix: '%',
                  },
                  {
                    label: 'Мафия · винрейт',
                    value: stats.mafia.winRate,
                    max: 100,
                    suffix: '%',
                  },
                ]}
              />
            </article>

            {stats.roles.length > 0 && (
              <article className="admin-stats-card admin-stats-card--wide">
                <div className="admin-stats-card-head">
                  <h5>По ролям</h5>
                  <span className="muted">игр</span>
                </div>
                <GlowBarRows
                  rows={stats.roles.slice(0, 8).map((role) => ({
                    label: `${role.roleLabel} · ${role.winRate}%`,
                    value: role.games,
                    max: roleMax,
                  }))}
                />
              </article>
            )}

            <article className="admin-stats-card admin-stats-card--wide">
              <div className="admin-stats-card-head">
                <h5>Последние партии</h5>
                <div className="admin-stats-grouped-legend muted">
                  <span>
                    <i className="stats-chart-legend-dot stats-chart-tone-bg--success" /> победа
                  </span>
                  <span>
                    <i className="stats-chart-legend-dot stats-chart-tone-bg--danger" /> поражение
                  </span>
                  <span>
                    <i className="stats-chart-legend-dot stats-chart-tone-bg--warning" /> ничья
                  </span>
                </div>
              </div>
              <RecentBars games={stats.recentGames} />
            </article>

            {stats.recentGames.length > 0 && (
              <article className="admin-stats-card admin-stats-card--wide">
                <div className="admin-stats-card-head">
                  <h5>Журнал</h5>
                </div>
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
                          <td className={game.isDraw ? '' : game.won ? 'user-stats-win' : 'user-stats-loss'}>
                            {game.isDraw ? 'Ничья' : game.won ? 'Победа' : 'Поражение'}
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
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
