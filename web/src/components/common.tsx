// Shared UI: stat tiles, session rows, breakdown lists, confirm dialog,
// bottom navigation. Ports of the Android components/ package.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  Session,
  GAME_TYPE_LABELS,
  TABLE_GAME_LABELS,
  isTableSession,
  profit,
  stakesLabel,
  tableStakesLabel,
} from '../models/types';
import { GroupStat, groupHourlyRate } from '../domain/stats';
import { signedMoney, perHour, formatDate, duration } from '../domain/format';

export const profitClass = (v: number): string => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

export interface Tile {
  label: string;
  value: string;
  className?: string;
}

export function StatTileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="tile-grid">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="overline">{t.label}</div>
          <div className={`value money ${t.className ?? ''}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SessionRow({ session }: { session: Session }) {
  const navigate = useNavigate();
  const p = profit(session);
  let title: string;
  if (isTableSession(session)) {
    const range = tableStakesLabel(session);
    const game = TABLE_GAME_LABELS[session.tableGame];
    title = range ? `${game} ${range}` : game;
  } else {
    const stakes = stakesLabel(session);
    const game = GAME_TYPE_LABELS[session.gameType];
    title =
      session.sessionType === 'CASH'
        ? stakes ? `${stakes} ${game}` : game
        : `${game} Tournament`;
  }
  return (
    <button
      type="button"
      className="session-row"
      onClick={() => navigate(`/session/${session.id}`)}
    >
      <span className="grow col" style={{ gap: 2 }}>
        <span className="title">{title}</span>
        <span className="muted small">
          {formatDate(session.startTime)} • {session.location || '—'}
        </span>
      </span>
      <span className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
        <span className={`title money ${profitClass(p)}`}>
          {signedMoney(p, session.currency)}
        </span>
        {session.durationMinutes > 0 && (
          <span className="muted small">{duration(session.durationMinutes)}</span>
        )}
      </span>
    </button>
  );
}

export function BreakdownList({
  groups,
  currency,
  emptyMessage = 'No data yet.',
  countNoun = 'sessions',
  showRate = true,
}: {
  groups: GroupStat[];
  currency: string;
  emptyMessage?: string;
  /** What one entry is called, e.g. "sessions" or "bets". */
  countNoun?: string;
  /** Hide the $/hr figure for entries without hours (e.g. bets). */
  showRate?: boolean;
}) {
  if (groups.length === 0) return <p className="muted">{emptyMessage}</p>;
  const maxAbs = Math.max(...groups.map((g) => Math.abs(g.profit)), 1e-9);
  return (
    <div className="col" style={{ gap: 14 }}>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="row-between">
            <span style={{ fontWeight: 600 }}>{g.key}</span>
            <span className={`money ${profitClass(g.profit)}`} style={{ fontWeight: 600 }}>
              {signedMoney(g.profit, currency)}
            </span>
          </div>
          <div className="muted small">
            {g.sessionCount} {countNoun}
            {showRate && <> • {perHour(groupHourlyRate(g), currency)}</>}
          </div>
          <div className="bar-track" style={{ marginTop: 6 }} aria-hidden="true">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(2, (Math.abs(g.profit) / maxAbs) * 100)}%`,
                background: g.profit >= 0 ? 'var(--profit)' : 'var(--loss)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div role="alertdialog" aria-modal="true" aria-label={title} className="dialog">
        <h2>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>{message}</p>
        <div className="actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${danger ? 'btn-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card col">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function TopBar({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  return (
    <header className="topbar">
      <button type="button" className="back" onClick={onBack} aria-label="Back">
        ←
      </button>
      <h1 className="grow" style={{ fontSize: '1.25rem' }}>{title}</h1>
      {action}
    </header>
  );
}

/** Crisp stroke icons for the bottom nav (unicode glyphs render unevenly). */
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    play: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.8v6.4l5.4-3.2z" />
      </>
    ),
    home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
    sessions: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    ),
    bets: (
      <path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 2v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-2zM14 6v12" />
    ),
    stats: <path d="M5 20V12M10 20V6M15 20v-5M20 20V9" />,
    more: (
      <>
        <circle cx="6" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="18" cy="12" r="1.6" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Play', icon: 'play' },
  { to: '/sessions', label: 'Sessions', icon: 'sessions' },
  { to: '/bets', label: 'Sports', icon: 'bets' },
  { to: '/stats', label: 'Dashboard', icon: 'stats' },
  { to: '/tools', label: 'More', icon: 'more' },
];

export function NavBar() {
  const { settings } = useAppState();
  // Play and More always show; the middle tabs follow Settings → Display.
  const visible = NAV.filter((item) => {
    if (item.to === '/sessions') return settings.showSessionsTab;
    if (item.to === '/bets') return settings.showSports;
    if (item.to === '/stats') return settings.showDashboardTab;
    return true;
  });
  return (
    <nav className="navbar" aria-label="Main navigation">
      {visible.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <NavIcon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ---------- Month grouping (session & bet lists) ----------

export interface MonthGroup<T> {
  key: string;
  label: string;
  items: T[];
  total: number;
}

/** Group newest-first items into calendar months, keeping order. */
export function groupByMonth<T>(
  items: T[],
  time: (item: T) => number,
  value: (item: T) => number,
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const index = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const d = new Date(time(item));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = index.get(key);
    if (!g) {
      g = {
        key,
        label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        items: [],
        total: 0,
      };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(item);
    g.total += value(item);
  }
  return groups;
}

export function MonthHeader({
  label,
  total,
  currency,
}: {
  label: string;
  total: number;
  currency: string;
}) {
  return (
    <div className="month-header">
      <span>{label}</span>
      <span className={`money ${profitClass(total)}`}>{signedMoney(total, currency)}</span>
    </div>
  );
}

// ---------- Collapsible filter panel ----------

/** Search + primary chips stay visible; everything else folds in here so
 *  list screens aren't dominated by filter controls. */
export function FilterPanel({
  activeCount,
  onClear,
  children,
}: {
  /** Number of active filters inside the panel (shown as a badge). */
  activeCount: number;
  onClear?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row">
        <button
          type="button"
          className="chip"
          aria-expanded={open}
          aria-pressed={activeCount > 0}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▾' : '▸'} Filters
          {activeCount > 0 && <span className="chip-badge">{activeCount}</span>}
        </button>
        {activeCount > 0 && onClear && (
          <button type="button" className="chip" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {open && <div className="col filter-panel">{children}</div>}
    </div>
  );
}
