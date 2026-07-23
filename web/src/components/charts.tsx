// SVG ports of the Android Canvas charts (CumulativeProfitChart, BarChart)
// plus the daily-results calendar heatmap.
import { useId } from 'react';
import { ProfitPoint } from '../domain/stats';
import { compactMoney, signedMoney, formatDate } from '../domain/format';

const PROFIT = 'var(--profit)';
const LOSS = 'var(--loss)';

export function CumulativeProfitChart({
  points,
  currency,
  emptyMessage = 'Log at least two sessions to see your profit graph.',
}: {
  points: ProfitPoint[];
  currency: string;
  emptyMessage?: string;
}) {
  const gradientId = useId();
  if (points.length < 2) {
    return <p className="muted">{emptyMessage}</p>;
  }
  const W = 600;
  const H = 200;
  const values = points.map((p) => p.cumulative);
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const range = maxV - minV || 1;
  const last = values[values.length - 1];
  const color = last >= 0 ? PROFIT : LOSS;

  const x = (i: number) => (W * i) / (points.length - 1);
  const y = (v: number) => H * (1 - (v - minV) / range);
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div>
      <div className="row-between small muted money" aria-hidden="true">
        <span>{compactMoney(maxV, currency)}</span>
        <span>{compactMoney(minV, currency)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="180"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Cumulative profit chart ending at ${compactMoney(last, currency)}`}
      >
        <defs>
          {/* Unique per instance — a fixed id would collide (and pick the
              wrong color) if two profit charts ever render on one page. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.3" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {minV <= 0 && maxV >= 0 && (
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--neutral)" strokeDasharray="6 5" />
        )}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
        <circle cx={W} cy={y(last)} r={5} fill={color} />
      </svg>
    </div>
  );
}

export interface BarEntry {
  label: string;
  value: number;
  color?: string;
}

/** Zero baseline positioned proportionally to the +/− extents (all-positive
 *  data, e.g. a histogram, uses the full height). ~4 x-labels max. */
export function BarChart({
  entries,
  height = 150,
  topLabel,
  emptyMessage = 'No data yet.',
  ariaLabel,
}: {
  entries: BarEntry[];
  height?: number;
  topLabel?: string;
  emptyMessage?: string;
  ariaLabel: string;
}) {
  if (entries.length === 0 || entries.every((e) => e.value === 0)) {
    return emptyMessage ? <p className="muted">{emptyMessage}</p> : null;
  }
  const W = 600;
  const pad = 4;
  const maxPos = Math.max(0, ...entries.map((e) => e.value));
  const maxNeg = Math.max(0, ...entries.map((e) => -e.value));
  const span = maxPos + maxNeg || 1;
  const usable = height - 2 * pad;
  const zeroY = pad + (maxPos / span) * usable;
  const slot = W / entries.length;
  const barW = Math.min(slot * 0.62, 64);

  const labelStep = Math.max(1, Math.ceil(entries.length / 4));

  return (
    <div>
      {topLabel && (
        <div className="small muted money" aria-hidden="true">{topLabel}</div>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="var(--neutral)" strokeWidth={1.5} />
        {entries.map((e, i) => {
          if (e.value === 0) return null;
          const mag = (Math.abs(e.value) / span) * usable;
          const xPos = slot * i + (slot - barW) / 2;
          const yPos = e.value >= 0 ? zeroY - mag : zeroY;
          return (
            <rect
              key={i}
              x={xPos}
              y={yPos}
              width={barW}
              height={mag}
              rx={4}
              fill={e.color ?? (e.value >= 0 ? PROFIT : LOSS)}
            />
          );
        })}
      </svg>
      <div className="row" style={{ gap: 0 }} aria-hidden="true">
        {entries.map((e, i) => (
          <span
            key={i}
            className="small muted"
            style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}
          >
            {i % labelStep === 0 || i === entries.length - 1 ? e.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface HeatPoint {
  time: number;
  value: number;
}

/** GitHub-style calendar of daily results: deeper green/red = bigger day,
 *  grey = didn't play. Each cell carries a native title tooltip. */
export function DailyHeatmap({
  points,
  weeks = 16,
  currency,
}: {
  points: HeatPoint[];
  weeks?: number;
  currency: string;
}) {
  const byDay = new Map<number, number>();
  for (const p of points) {
    const d = new Date(p.time);
    d.setHours(0, 0, 0, 0);
    byDay.set(d.getTime(), (byDay.get(d.getTime()) ?? 0) + p.value);
  }

  const CELL = 14;
  const GAP = 3;
  const LABEL_W = 20;
  const LABEL_H = 13;
  const W = LABEL_W + weeks * (CELL + GAP) - GAP;
  const H = LABEL_H + 7 * (CELL + GAP) - GAP;

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);

  const heat = (v: number | undefined): string => {
    if (v === undefined) return 'var(--cell-empty)';
    if (v >= 0) {
      return v > 500 ? 'var(--heat-p4)' : v > 250 ? 'var(--heat-p3)' : v > 90 ? 'var(--heat-p2)' : 'var(--heat-p1)';
    }
    return v < -350 ? 'var(--heat-l3)' : v < -120 ? 'var(--heat-l2)' : 'var(--heat-l1)';
  };

  const cells = [];
  const monthLabels = [];
  let lastMonth = '';
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day.getTime() > end.getTime()) continue;
      const v = byDay.get(day.getTime());
      const x = LABEL_W + w * (CELL + GAP);
      const y = LABEL_H + d * (CELL + GAP);
      cells.push(
        <rect key={`${w}-${d}`} x={x} y={y} width={CELL} height={CELL} rx={3.5} fill={heat(v)}>
          <title>
            {v === undefined
              ? `${formatDate(day.getTime())} — no session`
              : `${formatDate(day.getTime())} — ${signedMoney(v, currency)}`}
          </title>
        </rect>,
      );
      const m = day.toLocaleDateString(undefined, { month: 'short' });
      if (d === 0 && m !== lastMonth && day.getDate() <= 7) {
        lastMonth = m;
        monthLabels.push(
          <text key={m + w} x={x} y={9} fontSize={10} fill="var(--on-surface-variant)">
            {m}
          </text>,
        );
      }
    }
  }

  const legendSteps = [
    'var(--heat-l3)', 'var(--heat-l2)', 'var(--heat-l1)', 'var(--cell-empty)',
    'var(--heat-p1)', 'var(--heat-p2)', 'var(--heat-p3)', 'var(--heat-p4)',
  ];

  return (
    <div>
      <div className="heat-scroll">
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`Daily results calendar, last ${weeks} weeks`}
        >
          {(['M', 'W', 'F'] as const).map((label, i) => (
            <text
              key={label}
              x={0}
              y={LABEL_H + (1 + i * 2) * (CELL + GAP) + CELL - 4}
              fontSize={10}
              fill="var(--on-surface-variant)"
            >
              {label}
            </text>
          ))}
          {monthLabels}
          {cells}
        </svg>
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>Loss</span>
        {legendSteps.map((c, i) => (
          <span key={i} className="sw" style={{ background: c }} />
        ))}
        <span>Win</span>
        <span style={{ marginLeft: 8 }}>· grey = didn't play</span>
      </div>
    </div>
  );
}
