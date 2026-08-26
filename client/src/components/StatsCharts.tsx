/** Общие SVG-графики для админки и статистики игрока (glow / градиенты на токенах темы). */

export type ChartTone = 'accent' | 'success' | 'warning' | 'danger' | 'secondary';

export function formatChartInt(n: number): string {
  return n.toLocaleString('ru-RU');
}

export function chartPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Плавная кривая (Catmull-Rom → кубические Безье). */
export function smoothLinePath(
  values: number[],
  width: number,
  height: number,
  pad = 12,
  mode: 'zero' | 'minmax' = 'zero'
): string {
  if (values.length === 0) return '';
  const min = mode === 'minmax' ? Math.min(...values) : 0;
  const max = mode === 'minmax' ? Math.max(...values) : Math.max(...values, 1);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => {
    const x = pad + (values.length === 1 ? 0 : i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return { x, y };
  });
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${width - pad} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function ChartGlowDefs({ idPrefix }: { idPrefix: string }) {
  return (
    <defs>
      <filter id={`${idPrefix}-glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id={`${idPrefix}-fill-accent`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-fill-secondary`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--warning)" stopOpacity="0.35" />
        <stop offset="100%" stopColor="var(--warning)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-bar`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
        <stop offset="55%" stopColor="var(--accent)" />
        <stop offset="100%" stopColor="var(--warning)" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-bar-alt`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="var(--success)" stopOpacity="0.3" />
        <stop offset="100%" stopColor="var(--success)" />
      </linearGradient>
    </defs>
  );
}

interface GlowLineChartProps {
  values: number[];
  highlight: number;
  label: string;
  idPrefix: string;
  mode?: 'zero' | 'minmax';
  secondaryValues?: number[];
  /** Столбцы под кривой (как на neon-дашбордах). */
  withBars?: boolean;
}

export function GlowLineChart({
  values,
  highlight,
  label,
  idPrefix,
  mode = 'zero',
  secondaryValues,
  withBars = false,
}: GlowLineChartProps) {
  const w = 440;
  const h = 168;
  const pad = 14;
  const path = smoothLinePath(values, w, h, pad, mode);
  const path2 = secondaryValues ? smoothLinePath(secondaryValues, w, h, pad, mode) : '';
  const min = mode === 'minmax' ? Math.min(...values) : 0;
  const max = mode === 'minmax' ? Math.max(...values) : Math.max(...values, 1);
  const span = Math.max(max - min, 1);
  const lastIdx = Math.max(values.length - 1, 0);
  const lastX =
    values.length <= 1 ? w / 2 : pad + (lastIdx / Math.max(values.length - 1, 1)) * (w - pad * 2);
  const lastY = pad + (1 - ((values[lastIdx] ?? 0) - min) / span) * (h - pad * 2);
  const barW = values.length <= 1 ? 28 : Math.min(22, ((w - pad * 2) / values.length) * 0.55);

  return (
    <svg className="stats-chart-line" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <ChartGlowDefs idPrefix={idPrefix} />
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          className="stats-chart-grid"
          x1={pad}
          x2={w - pad}
          y1={pad + t * (h - pad * 2)}
          y2={pad + t * (h - pad * 2)}
        />
      ))}
      {withBars &&
        values.map((v, i) => {
          const x =
            values.length <= 1
              ? w / 2 - barW / 2
              : pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2) - barW / 2;
          const y = pad + (1 - (v - min) / span) * (h - pad * 2);
          const barH = Math.max(4, h - pad - y);
          return (
            <rect
              key={`bar-${i}`}
              className="stats-chart-under-bar"
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="4"
              fill={`url(#${idPrefix}-bar)`}
              opacity="0.55"
            />
          );
        })}
      {path && !withBars && (
        <path
          d={`${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
          fill={`url(#${idPrefix}-fill-accent)`}
          stroke="none"
        />
      )}
      {path2 && (
        <path
          d={path2}
          fill="none"
          stroke="var(--warning)"
          strokeWidth="2"
          strokeLinejoin="round"
          filter={`url(#${idPrefix}-glow)`}
          opacity="0.9"
        />
      )}
      {path && (
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.75"
          strokeLinejoin="round"
          filter={`url(#${idPrefix}-glow)`}
        />
      )}
      {values.length > 0 &&
        values.map((v, i) => {
          if (values.length > 12 && i % 2 === 1 && i !== lastIdx) return null;
          const x =
            values.length <= 1 ? w / 2 : pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
          const y = pad + (1 - (v - min) / span) * (h - pad * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === lastIdx ? 4.5 : 3}
              className="stats-chart-dot"
              filter={i === lastIdx ? `url(#${idPrefix}-glow)` : undefined}
            />
          );
        })}
      {values.length > 0 && (
        <g transform={`translate(${Math.min(lastX + 12, w - 96)}, ${Math.max(lastY - 32, 6)})`}>
          <rect className="stats-chart-tooltip" width="84" height="26" rx="10" />
          <text x="42" y="17" textAnchor="middle" className="stats-chart-tooltip-text">
            {formatChartInt(highlight)}
          </text>
        </g>
      )}
    </svg>
  );
}

interface GlowDonutProps {
  segments: { label: string; value: number; tone: ChartTone }[];
  centerLabel: string;
  idPrefix: string;
}

export function GlowDonut({ segments, centerLabel, idPrefix }: GlowDonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 44;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const base = total || 1;

  return (
    <div className="stats-chart-donut-wrap">
      <svg className="stats-chart-donut" viewBox="0 0 120 120" aria-hidden="true">
        <ChartGlowDefs idPrefix={idPrefix} />
        <circle cx="60" cy="60" r={r} fill="none" className="stats-chart-donut-track" strokeWidth="16" />
        {total > 0 &&
          segments.map((seg) => {
            const len = (seg.value / base) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={seg.label}
                className={`stats-chart-donut-seg stats-chart-tone--${seg.tone}`}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform="rotate(-90 60 60)"
                filter={`url(#${idPrefix}-glow)`}
              />
            );
            offset += len;
            return el;
          })}
        <circle cx="60" cy="60" r="28" className="stats-chart-donut-hole" />
        <text x="60" y="56" textAnchor="middle" className="stats-chart-donut-total">
          {formatChartInt(total)}
        </text>
        <text x="60" y="72" textAnchor="middle" className="stats-chart-donut-caption">
          {centerLabel}
        </text>
      </svg>
      <ul className="stats-chart-legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className={`stats-chart-legend-dot stats-chart-tone-bg--${seg.tone}`} />
            <span>{seg.label}</span>
            <strong>{total ? `${chartPercent(seg.value, total)}%` : '—'}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface GlowRingStatProps {
  title: string;
  value: string;
  share: number;
  hint: string;
  idPrefix: string;
}

export function GlowRingStat({ title, value, share, hint, idPrefix }: GlowRingStatProps) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, share));
  const dash = `${(clamped / 100) * c} ${c}`;

  return (
    <article className="admin-stats-card admin-stats-ring-card stats-chart-ring-card">
      <div className="admin-stats-ring-copy">
        <span className="admin-stats-card-label">{title}</span>
        <strong className="admin-stats-ring-value">{value}</strong>
        <span className="admin-stats-ring-hint muted">{hint}</span>
      </div>
      <svg className="stats-chart-ring" viewBox="0 0 76 76" aria-hidden="true">
        <ChartGlowDefs idPrefix={idPrefix} />
        <circle cx="38" cy="38" r={r} fill="none" className="stats-chart-donut-track" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          className="stats-chart-tone--accent"
          strokeWidth="7"
          strokeDasharray={dash}
          strokeLinecap="round"
          transform="rotate(-90 38 38)"
          filter={`url(#${idPrefix}-glow)`}
        />
        <text x="38" y="42" textAnchor="middle" className="stats-chart-ring-text">
          {clamped.toFixed(clamped % 1 ? 1 : 0)}%
        </text>
      </svg>
    </article>
  );
}

interface GlowBarRowsProps {
  rows: { label: string; value: number; max: number; suffix?: string }[];
}

export function GlowBarRows({ rows }: GlowBarRowsProps) {
  return (
    <ul className="stats-chart-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="stats-chart-bars-meta">
            <span>{row.label}</span>
            <strong>
              {formatChartInt(row.value)}
              {row.suffix ?? ''}
            </strong>
          </div>
          <div className="stats-chart-bars-track" aria-hidden="true">
            <div
              className="stats-chart-bars-fill"
              style={{ width: `${row.max > 0 ? Math.max(6, (row.value / row.max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface GlowGroupedBarsProps {
  columns: { key: string; label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  idPrefix: string;
}

export function GlowGroupedBars({ columns, aLabel, bLabel, idPrefix }: GlowGroupedBarsProps) {
  const max = Math.max(...columns.flatMap((c) => [c.a, c.b]), 1);
  return (
    <div className="stats-chart-grouped-wrap">
      <div className="stats-chart-grouped-legend muted">
        <span>
          <i className="stats-chart-legend-dot stats-chart-tone-bg--accent" /> {aLabel}
        </span>
        <span>
          <i className="stats-chart-legend-dot stats-chart-tone-bg--success" /> {bLabel}
        </span>
      </div>
      <div className="stats-chart-grouped">
        <svg width="0" height="0" aria-hidden="true">
          <ChartGlowDefs idPrefix={idPrefix} />
        </svg>
        {columns.map((col) => (
          <div key={col.key} className="stats-chart-grouped-col">
            <div className="stats-chart-grouped-bars" aria-hidden="true">
              <span
                className="stats-chart-grouped-bar stats-chart-grouped-bar--a"
                style={{ height: `${(col.a / max) * 100}%` }}
                title={`${aLabel}: ${col.a}`}
              />
              <span
                className="stats-chart-grouped-bar stats-chart-grouped-bar--b"
                style={{ height: `${(col.b / max) * 100}%` }}
                title={`${bLabel}: ${col.b}`}
              />
            </div>
            <span className="stats-chart-grouped-label">{col.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
