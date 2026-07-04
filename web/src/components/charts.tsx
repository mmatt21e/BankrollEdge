// SVG ports of the Android Canvas charts (CumulativeProfitChart, BarChart).
import { ProfitPoint } from '../domain/stats';
import { compactMoney } from '../domain/format';

const PROFIT = 'var(--profit)';
const LOSS = 'var(--loss)';

export function CumulativeProfitChart({
  points,
  currency,
}: {
  points: ProfitPoint[];
  currency: string;
}) {
  if (points.length < 2) {
    return <p className="muted">Log at least two sessions to see your profit graph.</p>;
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
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.3" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {minV <= 0 && maxV >= 0 && (
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--neutral)" strokeDasharray="6 5" />
        )}
        <path d={area} fill="url(#fill)" />
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
