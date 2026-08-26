import { useEffect, useMemo, useRef, useState } from 'react';
import { avatarUrl, fetchUserStatistics } from '../api';
import type { RecentGameStat, User, UserStatistics } from '../types';
import { profileStatsPath } from '../profileRouting';
import { updatePageMeta } from '../seo';
import { attachPageWheelScroll } from '../utils/wheelScroll';

interface UserStatisticsPageProps {
  userId: number;
  currentUser?: User | null;
  onBack: () => void;
  onWriteMessage?: (userId: number, username: string) => void;
}

function formatInt(n: number): string {
  return n.toLocaleString('ru-RU');
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function buildLinePath(values: number[], width: number, height: number, pad = 10): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  if (values.length === 0) return '';
  if (values.length === 1) {
    const y = pad + (1 - (values[0] - min) / span) * (height - pad * 2);
    return `M ${pad} ${y} L ${width - pad} ${y}`;
  }
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function mmrSeries(games: RecentGameStat[]): number[] {
  if (games.length === 0) return [1000];
  const chronological = [...games].reverse();
  return chronological.map((g) => g.mmrAfter);
}

function DonutChart({
  segments,
  centerLabel,
}: {
  segments: { label: string; value: number; tone: 'accent' | 'success' | 'warning' | 'danger' }[];
  centerLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const base = total || 1;

  return (
    <div className="admin-stats-donut-wrap">
      <svg className="admin-stats-donut" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        {total > 0 &&
          segments.map((seg) => {
            const len = (seg.value / base) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={seg.label}
                className={`admin-stats-donut-seg admin-stats-donut-seg--${seg.tone}`}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += len;
            return el;
          })}
        <text x="60" y="56" textAnchor="middle" className="admin-stats-donut-total" fontSize="18" fontWeight="700">
          {formatInt(total)}
        </text>
        <text x="60" y="74" textAnchor="middle" fill="var(--text-muted)" fontSize="10">
          {centerLabel}
        </text>
      </svg>
      <ul className="admin-stats-legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className={`admin-stats-legend-dot admin-stats-legend-dot--${seg.tone}`} />
            <span>{seg.label}</span>
            <strong>{total ? `${percent(seg.value, total)}%` : '—'}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RingStat({
  title,
  value,
  share,
  hint,
}: {
  title: string;
  value: string;
  share: number;
  hint: string;
}) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, share));
  const dash = `${(clamped / 100) * c} ${c}`;

  return (
    <article className="admin-stats-card admin-stats-ring-card">
      <div className="admin-stats-ring-copy">
        <span className="admin-stats-card-label">{title}</span>
        <strong className="admin-stats-ring-value">{value}</strong>
        <span className="admin-stats-ring-hint muted">{hint}</span>
      </div>
      <svg className="admin-stats-ring" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="700">
          {clamped.toFixed(clamped % 1 ? 1 : 0)}%
        </text>
      </svg>
    </article>
  );
}

function BarRows({ rows }: { rows: { label: string; value: number; max: number; suffix?: string }[] }) {
  return (
    <ul className="admin-stats-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="admin-stats-bars-meta">
            <span>{row.label}</span>
            <strong>
              {formatInt(row.value)}
              {row.suffix ?? ''}
            </strong>
          </div>
          <div className="admin-stats-bars-track" aria-hidden="true">
            <div
              className="admin-stats-bars-fill"
              style={{ width: `${row.max > 0 ? Math.max(4, (row.value / row.max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MmrLineChart({ values, highlight }: { values: number[]; highlight: number }) {
  const w = 420;
  const h = 150;
  const path = buildLinePath(values, w, h);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const lastIdx = values.length - 1;
  const lastX =
    values.length <= 1 ? w / 2 : 10 + (lastIdx / Math.max(values.length - 1, 1)) * (w - 20);
  const lastY = 10 + (1 - (values[lastIdx] - min) / span) * (h - 20);

  return (
    <svg className="admin-stats-line" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Динамика MMR">
      <defs>
        <linearGradient id="userStatsMmrFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {path && (
        <path d={`${path} L ${w - 10} ${h - 10} L 10 ${h - 10} Z`} fill="url(#userStatsMmrFill)" stroke="none" />
      )}
      {path && (
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {values.length > 0 && (
        <>
          <circle cx={lastX} cy={lastY} r="5" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="2" />
          <g transform={`translate(${Math.min(lastX + 10, w - 90)}, ${Math.max(lastY - 28, 4)})`}>
            <rect width="80" height="24" rx="8" fill="var(--bg-elevated)" stroke="var(--border)" />
            <text x="40" y="16" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="700">
              {formatInt(highlight)}
            </text>
          </g>
        </>
      )}
    </svg>
  );
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
                {user.city && <p className="muted">{user.city}</p>}
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
              <MmrLineChart values={mmrValues} highlight={stats.mmr} />
              <p className="admin-stats-card-footnote muted">
                Средний балл: <strong>{stats.averageScore}</strong>
                {' · '}
                игр: <strong>{formatInt(stats.gamesPlayed)}</strong>
              </p>
            </article>

            <article className="admin-stats-card">
              <div className="admin-stats-card-head">
                <h5>Результаты</h5>
                <span className="muted">все партии</span>
              </div>
              <DonutChart
                centerLabel="игр"
                segments={[
                  { label: 'Победы', value: stats.wins, tone: 'success' },
                  { label: 'Поражения', value: stats.losses, tone: 'danger' },
                  { label: 'Ничьи', value: draws, tone: 'warning' },
                ]}
              />
            </article>

            <RingStat
              title="Винрейт"
              value={`${stats.winRate}%`}
              share={stats.winRate}
              hint={`${formatInt(stats.wins)} из ${formatInt(stats.gamesPlayed)}`}
            />
            <RingStat
              title="За мирных"
              value={`${stats.town.winRate}%`}
              share={stats.town.winRate}
              hint={`${formatInt(stats.town.wins)} / ${formatInt(stats.town.games)}`}
            />
            <RingStat
              title="За мафию"
              value={`${stats.mafia.winRate}%`}
              share={stats.mafia.winRate}
              hint={`${formatInt(stats.mafia.wins)} / ${formatInt(stats.mafia.games)}`}
            />

            <article className="admin-stats-card">
              <div className="admin-stats-card-head">
                <h5>По командам</h5>
              </div>
              <BarRows
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
                <BarRows
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
                    <i className="admin-stats-legend-dot admin-stats-legend-dot--success" /> победа
                  </span>
                  <span>
                    <i className="admin-stats-legend-dot admin-stats-legend-dot--danger" /> поражение
                  </span>
                  <span>
                    <i className="admin-stats-legend-dot admin-stats-legend-dot--warning" /> ничья
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
