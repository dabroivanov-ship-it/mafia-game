import { useEffect, useMemo, useState } from 'react';
import { fetchAdminStats, type AdminSiteStats, type AdminStatsDayPoint } from '../api';
import { AuthProviderBadges } from './AuthProviderBadges';

function formatInt(n: number): string {
  return n.toLocaleString('ru-RU');
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatInt(n);
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function buildLinePath(values: number[], width: number, height: number, pad = 8): string {
  const max = Math.max(...values, 1);
  if (values.length === 0) return '';
  if (values.length === 1) {
    const y = pad + (1 - values[0] / max) * (height - pad * 2);
    return `M ${pad} ${y} L ${width - pad} ${y}`;
  }
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - v / max) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function LineChart({
  series,
  highlight,
}: {
  series: AdminStatsDayPoint[];
  highlight: number;
}) {
  const w = 420;
  const h = 160;
  const values = series.map((p) => p.active);
  const path = buildLinePath(values, w, h);
  const max = Math.max(...values, 1);
  const lastIdx = values.length - 1;
  const lastX =
    values.length <= 1 ? w / 2 : 8 + (lastIdx / Math.max(values.length - 1, 1)) * (w - 16);
  const lastY = 8 + (1 - (values[lastIdx] ?? 0) / max) * (h - 16);

  return (
    <svg className="admin-stats-line" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Активность за 7 дней">
      <defs>
        <linearGradient id="adminStatsLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {path && (
        <path
          d={`${path} L ${w - 8} ${h - 8} L 8 ${h - 8} Z`}
          fill="url(#adminStatsLineFill)"
          stroke="none"
        />
      )}
      {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />}
      {values.length > 0 && (
        <>
          <circle cx={lastX} cy={lastY} r="5" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="2" />
          <g transform={`translate(${Math.min(lastX + 10, w - 90)}, ${Math.max(lastY - 28, 4)})`}>
            <rect width="80" height="24" rx="8" fill="var(--bg-elevated, var(--bg-hover))" stroke="var(--border)" />
            <text x="40" y="16" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="700">
              {formatInt(highlight)}
            </text>
          </g>
        </>
      )}
    </svg>
  );
}

function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; tone: 'accent' | 'success' | 'warning' }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="admin-stats-donut-wrap">
      <svg className="admin-stats-donut" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        {segments.map((seg) => {
          const len = (seg.value / total) * c;
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
          {formatShort(total)}
        </text>
        <text x="60" y="74" textAnchor="middle" fill="var(--text-muted)" fontSize="10">
          игр
        </text>
      </svg>
      <ul className="admin-stats-legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className={`admin-stats-legend-dot admin-stats-legend-dot--${seg.tone}`} />
            <span>{seg.label}</span>
            <strong>{percent(seg.value, total)}%</strong>
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
  value: number;
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
        <strong className="admin-stats-ring-value">{formatShort(value)}</strong>
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

function BarRows({
  rows,
}: {
  rows: { label: string; value: number; max: number }[];
}) {
  return (
    <ul className="admin-stats-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="admin-stats-bars-meta">
            <span>{row.label}</span>
            <strong>{formatInt(row.value)}</strong>
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

function GroupedBars({ series }: { series: AdminStatsDayPoint[] }) {
  const max = Math.max(...series.flatMap((p) => [p.registered, p.active]), 1);
  return (
    <div className="admin-stats-grouped">
      {series.map((point) => (
        <div key={point.date} className="admin-stats-grouped-col">
          <div className="admin-stats-grouped-bars" aria-hidden="true">
            <span
              className="admin-stats-grouped-bar admin-stats-grouped-bar--reg"
              style={{ height: `${(point.registered / max) * 100}%` }}
              title={`Регистрации: ${point.registered}`}
            />
            <span
              className="admin-stats-grouped-bar admin-stats-grouped-bar--act"
              style={{ height: `${(point.active / max) * 100}%` }}
              title={`Активны: ${point.active}`}
            />
          </div>
          <span className="admin-stats-grouped-label">{point.label.split(',')[0] || point.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminStatsPanel() {
  const [stats, setStats] = useState<AdminSiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  if (loading) return <p className="muted">Загрузка статистики...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return null;

  const series = stats.seriesLast7Days ?? [];
  const authMax = Math.max(
    stats.authProviders?.telegram ?? 0,
    stats.authProviders?.vk ?? 0,
    stats.authProviders?.email ?? 0,
    1
  );
  const gameSegs = [
    { label: 'Мирные', value: stats.gamesByWinner?.town ?? 0, tone: 'success' as const },
    { label: 'Мафия', value: stats.gamesByWinner?.mafia ?? 0, tone: 'accent' as const },
    { label: 'Ничьи', value: stats.gamesByWinner?.draw ?? 0, tone: 'warning' as const },
  ];
  const onlineShare = percent(stats.usersOnline, stats.usersTotal);
  const weekShare = percent(stats.usersRegisteredWeek, Math.max(stats.usersTotal, 1));

  return (
    <div className="admin-stats-panel admin-stats-overview">
      <header className="admin-stats-overview-head">
        <div>
          <h4 className="admin-stats-overview-title">Обзор</h4>
          <p className="muted admin-stats-overview-date">{todayLabel}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      <div className="admin-stats-grid">
        <article className="admin-stats-card admin-stats-card--wide">
          <div className="admin-stats-card-head">
            <h5>Активные пользователи</h5>
            <span className="muted">по last seen · 7 дней</span>
          </div>
          <LineChart series={series} highlight={stats.usersActiveWeek} />
          <p className="admin-stats-card-footnote muted">
            Сейчас онлайн: <strong>{formatInt(stats.usersOnline)}</strong>
            {' · '}
            активны сегодня: <strong>{formatInt(stats.usersActiveToday)}</strong>
          </p>
        </article>

        <article className="admin-stats-card">
          <div className="admin-stats-card-head">
            <h5>Вход через</h5>
            <span className="muted">{formatInt(stats.usersTotal)} акк.</span>
          </div>
          <BarRows
            rows={[
              { label: 'Telegram', value: stats.authProviders?.telegram ?? 0, max: authMax },
              { label: 'ВКонтакте', value: stats.authProviders?.vk ?? 0, max: authMax },
              { label: 'Email', value: stats.authProviders?.email ?? 0, max: authMax },
            ]}
          />
        </article>

        <article className="admin-stats-card">
          <div className="admin-stats-card-head">
            <h5>Исходы партий</h5>
            <span className="muted">архив игр</span>
          </div>
          <DonutChart segments={gameSegs} />
        </article>

        <RingStat
          title="Онлайн"
          value={stats.usersOnline}
          share={onlineShare}
          hint={`от ${formatInt(stats.usersTotal)} игроков`}
        />
        <RingStat
          title="Новые за 7 дней"
          value={stats.usersRegisteredWeek}
          share={weekShare}
          hint={`сегодня +${formatInt(stats.usersRegisteredToday)}`}
        />

        <article className="admin-stats-card admin-stats-card--wide">
          <div className="admin-stats-card-head">
            <h5>Неделя</h5>
            <div className="admin-stats-grouped-legend muted">
              <span>
                <i className="admin-stats-legend-dot admin-stats-legend-dot--accent" /> регистрации
              </span>
              <span>
                <i className="admin-stats-legend-dot admin-stats-legend-dot--success" /> активны
              </span>
            </div>
          </div>
          <GroupedBars series={series} />
        </article>

        <article className="admin-stats-card admin-stats-card--metrics">
          <div className="admin-stats-card-head">
            <h5>Сводка</h5>
          </div>
          <dl className="admin-stats-metrics">
            <div>
              <dt>Всего игроков</dt>
              <dd>{formatInt(stats.usersTotal)}</dd>
            </div>
            <div>
              <dt>Посещения сегодня</dt>
              <dd>{formatInt(stats.visitsToday)}</dd>
            </div>
            <div>
              <dt>Посещения всего</dt>
              <dd>{formatInt(stats.visitsTotal)}</dd>
            </div>
            <div>
              <dt>Игр сыграно</dt>
              <dd>{formatInt(stats.gamesPlayedTotal)}</dd>
            </div>
            <div>
              <dt>Записей партий</dt>
              <dd>{formatInt(stats.gamesFinishedTotal)}</dd>
            </div>
            <div>
              <dt>Новости</dt>
              <dd>{formatInt(stats.newsPublished)}</dd>
            </div>
            <div>
              <dt>Журнал модерации</dt>
              <dd>{formatInt(stats.violationsTotal)}</dd>
            </div>
            <div>
              <dt>Админы / модеры / бан</dt>
              <dd>
                {formatInt(stats.usersAdmins)} / {formatInt(stats.usersModerators)} /{' '}
                {formatInt(stats.usersBanned)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="admin-stats-card admin-stats-card--wide">
          <div className="admin-stats-card-head">
            <h5>Новые за сутки</h5>
            <span className="muted">{formatInt(stats.usersRegisteredToday)}</span>
          </div>
          {!(stats.usersNewLast24h?.length) ? (
            <p className="muted">За последние 24 часа новых регистраций нет.</p>
          ) : (
            <ul className="admin-new-users-list">
              {(stats.usersNewLast24h ?? []).map((user) => (
                <li key={user.id}>
                  <strong>{user.displayName || user.username}</strong>
                  <span className="muted">@{user.username}</span>
                  <AuthProviderBadges providers={user.authProviders} />
                  <time className="muted" dateTime={user.createdAt}>
                    {new Date(user.createdAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
