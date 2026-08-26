import { useId, useState } from 'react';
import type { PublicSiteStats } from '../types';

const ACTIVE_HINT = 'Игроки, которые заходили на сайт за последние 30 дней.';

interface SiteServerStatsProps {
  stats: PublicSiteStats;
  onOpenOnline?: () => void;
  onlineHref?: string;
}

type StatTone = 'accent' | 'success' | 'warning' | 'danger' | 'muted';

function MiniRing({ share, tone }: { share: number; tone: StatTone }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, share));
  const dash = `${(clamped / 100) * c} ${c}`;

  return (
    <svg className="site-server-stat-ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} className="site-server-stat-ring-track" fill="none" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        className={`site-server-stat-ring-fill site-server-stat-tone--${tone}`}
        fill="none"
        strokeWidth="4"
        strokeDasharray={dash}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
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

function StatTile({
  value,
  label,
  tone,
  share,
  clickable,
  onOpen,
  href,
  hint,
  hintOpen,
  onToggleHint,
  hintId,
}: {
  value: number;
  label: string;
  tone: StatTone;
  share?: number;
  clickable?: boolean;
  onOpen?: () => void;
  href?: string;
  hint?: string;
  hintOpen?: boolean;
  onToggleHint?: () => void;
  hintId?: string;
}) {
  return (
    <div className={`site-server-stat site-server-stat--${tone}`}>
      <div className="site-server-stat-top">
        <StatValue
          value={value}
          clickable={clickable}
          onOpen={onOpen}
          href={href}
          label={clickable || href ? `${label}, открыть список` : label}
        />
        {share != null && <MiniRing share={share} tone={tone} />}
      </div>
      <span className="site-server-stat-label">
        {label}
        {hint && onToggleHint && (
          <>
            {' '}
            <button
              type="button"
              className="site-server-stat-hint"
              aria-expanded={!!hintOpen}
              aria-controls={hintId}
              title={hint}
              onClick={onToggleHint}
            >
              ?
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export default function SiteServerStats({ stats, onOpenOnline, onlineHref }: SiteServerStatsProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const hintId = useId();
  const archive = Math.max(stats.gamesArchived, 1);
  const onlineShare = percent(stats.online, Math.max(stats.activePlayers, stats.online, 1));

  return (
    <div className="site-server-stats-wrap">
      <div className="site-server-stats">
        <StatTile
          value={stats.gamesArchived}
          label="Партий в архиве"
          tone="accent"
        />
        <StatTile
          value={stats.mafiaWins}
          label="Победила мафия"
          tone="danger"
          share={percent(stats.mafiaWins, archive)}
        />
        <StatTile
          value={stats.townWins}
          label="Победили честные"
          tone="success"
          share={percent(stats.townWins, archive)}
        />
        <StatTile
          value={stats.draws}
          label="Ничьих"
          tone="warning"
          share={percent(stats.draws, archive)}
        />
        <StatTile
          value={stats.online}
          label="Сейчас онлайн"
          tone="accent"
          share={onlineShare}
          clickable={!!onOpenOnline}
          onOpen={onOpenOnline}
          href={onlineHref}
        />
        <StatTile
          value={stats.activePlayers}
          label="Активных игроков"
          tone="muted"
          hint={ACTIVE_HINT}
          hintOpen={hintOpen}
          onToggleHint={() => setHintOpen((open) => !open)}
          hintId={hintId}
        />
      </div>
      {hintOpen && (
        <p id={hintId} className="muted site-server-stats-note">
          {ACTIVE_HINT}
        </p>
      )}
    </div>
  );
}
