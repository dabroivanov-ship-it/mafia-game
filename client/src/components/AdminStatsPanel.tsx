import { useEffect, useMemo, useState } from 'react';
import { fetchAdminStats, type AdminSiteStats } from '../api';
import { AuthProviderBadges } from './AuthProviderBadges';
import {
  chartPercent,
  formatChartInt,
  GlowBarRows,
  GlowDonut,
  GlowGroupedBars,
  GlowLineChart,
  GlowRingStat,
} from './StatsCharts';

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatChartInt(n);
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
  const onlineShare = chartPercent(stats.usersOnline, stats.usersTotal);
  const weekShare = chartPercent(stats.usersRegisteredWeek, Math.max(stats.usersTotal, 1));

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
            <span className="muted">активны · регистрации · 7 дней</span>
          </div>
          <GlowLineChart
            idPrefix="admin-active"
            label="Активность за 7 дней"
            values={series.map((p) => p.active)}
            secondaryValues={series.map((p) => p.registered)}
            highlight={stats.usersActiveWeek}
            withBars
          />
          <p className="admin-stats-card-footnote muted">
            Сейчас онлайн: <strong>{formatChartInt(stats.usersOnline)}</strong>
            {' · '}
            активны сегодня: <strong>{formatChartInt(stats.usersActiveToday)}</strong>
          </p>
        </article>

        <article className="admin-stats-card">
          <div className="admin-stats-card-head">
            <h5>Вход через</h5>
            <span className="muted">{formatChartInt(stats.usersTotal)} акк.</span>
          </div>
          <GlowBarRows
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
          <GlowDonut idPrefix="admin-games" centerLabel="игр" segments={gameSegs} />
        </article>

        <GlowRingStat
          idPrefix="admin-online"
          title="Онлайн"
          value={formatShort(stats.usersOnline)}
          share={onlineShare}
          hint={`от ${formatChartInt(stats.usersTotal)} игроков`}
        />
        <GlowRingStat
          idPrefix="admin-week"
          title="Новые за 7 дней"
          value={formatShort(stats.usersRegisteredWeek)}
          share={weekShare}
          hint={`сегодня +${formatChartInt(stats.usersRegisteredToday)}`}
        />

        <article className="admin-stats-card admin-stats-card--wide">
          <div className="admin-stats-card-head">
            <h5>Неделя</h5>
          </div>
          <GlowGroupedBars
            idPrefix="admin-week-bars"
            aLabel="регистрации"
            bLabel="активны"
            columns={series.map((p) => ({
              key: p.date,
              label: p.label.split(',')[0] || p.label,
              a: p.registered,
              b: p.active,
            }))}
          />
        </article>

        <article className="admin-stats-card admin-stats-card--metrics">
          <div className="admin-stats-card-head">
            <h5>Сводка</h5>
          </div>
          <dl className="admin-stats-metrics">
            <div>
              <dt>Всего игроков</dt>
              <dd>{formatChartInt(stats.usersTotal)}</dd>
            </div>
            <div>
              <dt>Посещения сегодня</dt>
              <dd>{formatChartInt(stats.visitsToday)}</dd>
            </div>
            <div>
              <dt>Посещения всего</dt>
              <dd>{formatChartInt(stats.visitsTotal)}</dd>
            </div>
            <div>
              <dt>Игр сыграно</dt>
              <dd>{formatChartInt(stats.gamesPlayedTotal)}</dd>
            </div>
            <div>
              <dt>Записей партий</dt>
              <dd>{formatChartInt(stats.gamesFinishedTotal)}</dd>
            </div>
            <div>
              <dt>Новости</dt>
              <dd>{formatChartInt(stats.newsPublished)}</dd>
            </div>
            <div>
              <dt>Журнал модерации</dt>
              <dd>{formatChartInt(stats.violationsTotal)}</dd>
            </div>
            <div>
              <dt>Админы / модеры / бан</dt>
              <dd>
                {formatChartInt(stats.usersAdmins)} / {formatChartInt(stats.usersModerators)} /{' '}
                {formatChartInt(stats.usersBanned)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="admin-stats-card admin-stats-card--wide">
          <div className="admin-stats-card-head">
            <h5>Новые за сутки</h5>
            <span className="muted">{formatChartInt(stats.usersRegisteredToday)}</span>
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
