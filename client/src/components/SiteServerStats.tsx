import { useState } from 'react';
import type { PublicSiteStats } from '../types';

const ACTIVE_HINT = 'Игроки, которые заходили на сайт за последние 30 дней.';

interface SiteServerStatsProps {
  stats: PublicSiteStats;
  onOpenOnline?: () => void;
  onlineHref?: string;
}

function StatValue({
  value,
  clickable,
  onOpen,
  href,
  label,
}: {
  value: number;
  clickable?: boolean;
  onOpen?: () => void;
  href?: string;
  label: string;
}) {
  const formatted = value.toLocaleString('ru-RU');
  if (href) {
    return (
      <a href={href} className="site-server-stat-value site-server-stat-link" aria-label={label}>
        {formatted}
      </a>
    );
  }
  if (clickable && onOpen) {
    return (
      <button
        type="button"
        className="site-server-stat-value site-server-stat-link"
        onClick={onOpen}
        aria-label={label}
      >
        {formatted}
      </button>
    );
  }
  return <span className="site-server-stat-value">{formatted}</span>;
}

export default function SiteServerStats({ stats, onOpenOnline, onlineHref }: SiteServerStatsProps) {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <div className="site-server-stats-wrap">
      <div className="site-server-stats">
        <div className="site-server-stat">
          <StatValue value={stats.gamesArchived} label="Партий в архиве" />
          <span className="site-server-stat-label">Партий в архиве</span>
        </div>
        <div className="site-server-stat">
          <StatValue value={stats.mafiaWins} label="Победила мафия" />
          <span className="site-server-stat-label">Победила мафия</span>
        </div>
        <div className="site-server-stat">
          <StatValue value={stats.townWins} label="Победили честные" />
          <span className="site-server-stat-label">Победили честные</span>
        </div>
        <div className="site-server-stat">
          <StatValue value={stats.draws} label="Ничьих" />
          <span className="site-server-stat-label">Ничьих</span>
        </div>
        <div className="site-server-stat">
          <StatValue
            value={stats.online}
            clickable={!!onOpenOnline}
            onOpen={onOpenOnline}
            href={onlineHref}
            label="Сейчас онлайн, открыть список"
          />
          <span className="site-server-stat-label">Сейчас онлайн</span>
        </div>
        <div className="site-server-stat">
          <StatValue value={stats.activePlayers} label="Активных игроков" />
          <span className="site-server-stat-label">
            Активных игроков{' '}
            <button
              type="button"
              className="site-server-stat-hint"
              aria-expanded={hintOpen}
              aria-controls="site-server-stats-hint"
              onClick={() => setHintOpen((open) => !open)}
            >
              [?]
            </button>
          </span>
        </div>
      </div>
      {hintOpen && (
        <p id="site-server-stats-hint" className="muted site-server-stats-note">
          {ACTIVE_HINT}
        </p>
      )}
    </div>
  );
}
