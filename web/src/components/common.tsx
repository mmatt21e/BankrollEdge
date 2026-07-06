// Shared UI: stat tiles, session rows, breakdown lists, confirm dialog,
// bottom navigation. Ports of the Android components/ package.
import { ReactNode, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
}: {
  groups: GroupStat[];
  currency: string;
  emptyMessage?: string;
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
            {g.sessionCount} sessions • {perHour(groupHourlyRate(g), currency)}
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

const NAV = [
  { to: '/', label: 'Overview', icon: '◈' },
  { to: '/sessions', label: 'Sessions', icon: '☰' },
  { to: '/stats', label: 'Stats', icon: '▤' },
  { to: '/tools', label: 'Tools', icon: '⛭' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function NavBar() {
  return (
    <nav className="navbar" aria-label="Main navigation">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <span className="icon" aria-hidden="true">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
