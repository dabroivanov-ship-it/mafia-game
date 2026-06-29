import { useEffect, useState } from 'react';
import { fetchAdminStats, type AdminSiteStats } from '../api';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-system-stat-card">
      <div>
        <span className="muted">{label}</span>
        <strong>{value.toLocaleString('ru-RU')}</strong>
      </div>
    </div>
  );
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-stats-group">
      <h4 className="admin-subsection-title">{title}</h4>
      <div className="admin-system-stats admin-system-stats-compact">{children}</div>
    </section>
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

  if (loading) return <p className="muted">Загрузка статистики...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return null;

  return (
    <div className="admin-stats-panel">
      <div className="admin-section-head">
        <p className="theme-settings-hint">
          Сводка по сайту. Посещения считаются при каждой загрузке сессии авторизованного пользователя.
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
          Обновить
        </button>
      </div>

      <StatGroup title="Пользователи">
        <StatCard label="Всего зарегистрировано" value={stats.usersTotal} />
        <StatCard label="Сейчас онлайн" value={stats.usersOnline} />
        <StatCard label="Активны сегодня" value={stats.usersActiveToday} />
        <StatCard label="Активны за 7 дней" value={stats.usersActiveWeek} />
        <StatCard label="Регистраций сегодня" value={stats.usersRegisteredToday} />
        <StatCard label="Регистраций за 7 дней" value={stats.usersRegisteredWeek} />
        <StatCard label="Администраторы" value={stats.usersAdmins} />
        <StatCard label="Модераторы" value={stats.usersModerators} />
        <StatCard label="Заблокированы" value={stats.usersBanned} />
      </StatGroup>

      <StatGroup title="Посещения">
        <StatCard label="Сегодня" value={stats.visitsToday} />
        <StatCard label="Всего" value={stats.visitsTotal} />
      </StatGroup>

      <StatGroup title="Игра и контент">
        <StatCard label="Игр сыграно (сумма)" value={stats.gamesPlayedTotal} />
        <StatCard label="Завершённых партий" value={stats.gamesFinishedTotal} />
        <StatCard label="Опубликованных новостей" value={stats.newsPublished} />
        <StatCard label="Записей в журнале модерации" value={stats.violationsTotal} />
      </StatGroup>
    </div>
  );
}
