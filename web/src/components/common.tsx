// Shared UI: stat tiles, session rows, breakdown lists, confirm dialog,
// bottom navigation. Ports of the Android components/ package.
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  Session,
  gameTypeLabel,
  tableGameLabel,
  isTableSession,
  profit,
  stakesLabel,
  tableStakesLabel,
} from '../models/types';
import { GroupStat, groupHourlyRate } from '../domain/stats';
import { signedMoney, signedUnits, signedUnitsOrMoney, perHour, formatDate, duration, currencySymbol } from '../domain/format';

export const profitClass = (v: number): string => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

/** Back handler for sub-pages: browser history when there is any, otherwise
 *  an explicit parent route — so a cold deep link never exits the app. */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  const isFirstEntry = location.key === 'default';
  return useCallback(() => {
    if (isFirstEntry) navigate(fallback, { replace: true });
    else navigate(-1);
  }, [navigate, fallback, isFirstEntry]);
}

/** Modal scaffold shared by every dialog: backdrop, Escape-to-close from
 *  anywhere, focus moved inside on open, kept inside (Tab wraps), and
 *  restored to the trigger on close. Render it only while open. */
export function Dialog({
  label,
  role = 'dialog',
  onClose,
  children,
}: {
  label: string;
  role?: 'dialog' | 'alertdialog';
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = (): HTMLElement[] =>
      dialog
        ? [...dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )]
        : [];
    // Move focus inside so Escape works immediately; a child may refocus a
    // specific control afterwards (its effect runs after this one).
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} role={role} aria-modal="true" aria-label={label} className="dialog">
        {children}
      </div>
    </div>
  );
}

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
  const { settings } = useAppState();
  const p = profit(session);
  // Table-game results show in units when the user turned that display on.
  const amountText = isTableSession(session)
    ? signedUnitsOrMoney(p, session.currency, settings.showTableUnits, settings.tableUnitValue)
    : signedMoney(p, session.currency);
  let title: string;
  if (isTableSession(session)) {
    const range = tableStakesLabel(session);
    const game = tableGameLabel(session.tableGame);
    title = range ? `${game} ${range}` : game;
  } else {
    const stakes = stakesLabel(session);
    const game = gameTypeLabel(session.gameType);
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
          {amountText}
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
    <Dialog role="alertdialog" label={title} onClose={onCancel}>
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
    </Dialog>
  );
}

/** Icon + title + blurb row linking into a hub destination — the shared row
 *  style of the Tools and Settings tabs. */
export function HubRow({ to, icon, name, blurb }: { to: string; icon: string; name: string; blurb: string }) {
  return (
    <Link to={to} className="session-row" style={{ textDecoration: 'none' }}>
      <span aria-hidden="true" className="icon-lg">{icon}</span>
      <span className="grow col" style={{ gap: 2 }}>
        <span className="title">{name}</span>
        <span className="muted small">{blurb}</span>
      </span>
      <span aria-hidden="true" className="muted">›</span>
    </Link>
  );
}

/** Gold-edged status banner for save/import/restore feedback. Renders
 *  nothing while the message is empty. */
export function MessageBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="card" role="status" style={{ borderLeft: '4px solid var(--gold-500)' }}>
      {children}
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
    poker: (
      <path d="M12 3c0 0-7 5.5-7 10a3.3 3.3 0 0 0 5.6 2.3c.1 1-.5 2.4-1.6 3.2h6c-1.1-.8-1.7-2.2-1.6-3.2A3.3 3.3 0 0 0 19 13c0-4.5-7-10-7-10z" />
    ),
    bets: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18" />
        <path d="M5.6 5.6C9 9 9 15 5.6 18.4" />
        <path d="M18.4 5.6C15 9 15 15 18.4 18.4" />
      </>
    ),
    stats: <path d="M5 20V12M10 20V6M15 20v-5M20 20V9" />,
    tables: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
    tools: (
      <path d="M20.7 6.4a5 5 0 0 1-6.3 6.3l-6.2 6.2a2 2 0 0 1-2.8-2.8l6.2-6.2a5 5 0 0 1 6.3-6.3l-3 3 .7 2.1 2.1.7z" />
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3.1" />
        <path d="M12 2.9v2.6M12 18.5v2.6M2.9 12h2.6M18.5 12h2.6M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
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
  { to: '/', label: 'Dashboard', icon: 'stats' },
  { to: '/sessions', label: 'Poker', icon: 'poker' },
  { to: '/tables', label: 'Table', icon: 'tables' },
  { to: '/bets', label: 'Sports', icon: 'bets' },
  { to: '/tools', label: 'Tools', icon: 'tools' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export function NavBar() {
  const { settings } = useAppState();
  // Dashboard and Settings always show; the rest follow the feature/tab
  // switches. Poker is poker-only; table games get their own Table tab.
  const visible = NAV.filter((item) => {
    if (item.to === '/sessions') return settings.showSessionsTab && settings.showPoker;
    if (item.to === '/tables') return settings.showSessionsTab && settings.showTableGames;
    if (item.to === '/bets') return settings.showSports;
    if (item.to === '/tools') return settings.showPoker;
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
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// ---------- Money input ----------

/** Decimal input with the currency symbol shown as a prefix, so the user
 *  never has to type it. Falls back to the app's default currency. */
export function MoneyInput({
  value,
  onChange,
  currency,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Overrides the app default (e.g. the session's own currency). */
  currency?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const { settings } = useAppState();
  const sym = currencySymbol(currency ?? settings.currency);
  return (
    <span className="money-input">
      <span className="money-prefix" aria-hidden="true">{sym}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={{ paddingLeft: `${18 + sym.length * 9}px` }}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
      />
    </span>
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
  unitValue,
}: {
  label: string;
  total: number;
  currency: string;
  /** When > 0, the subtotal shows in units instead of money. */
  unitValue?: number;
}) {
  return (
    <div className="month-header">
      <span>{label}</span>
      <span className={`money ${profitClass(total)}`}>
        {unitValue && unitValue > 0 ? signedUnits(total / unitValue) : signedMoney(total, currency)}
      </span>
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
