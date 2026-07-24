// Full-screen Filters sheet: every session dimension as collapsible
// multi-select sections, a live "will show N/M sessions" count, time-range
// chips and Clear all. Draft state — nothing applies until ✓.
import { useMemo, useState } from 'react';
import {
  DATE_RANGE_LABELS,
  DateRange,
  EMPTY_FILTER,
  SessionFilter,
  applyFilter,
  sessionStakesLabel,
} from '../domain/filter';
import { DAY_NAMES } from '../domain/aggregate';
import {
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  Session,
  gameTypeLabel,
  isTableSession,
  tableGameLabel,
} from '../models/types';

/** One collapsible filter section with checkbox options. */
function FilterSection({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details className="card" open={count > 0}>
      <summary>
        <strong>{title}</strong>
        {count > 0 && <span className="chip-badge">{count}</span>}
      </summary>
      {hint && <p className="muted small" style={{ margin: '6px 0 0' }}>{hint}</p>}
      <div className="col" style={{ marginTop: 8, gap: 2 }}>{children}</div>
    </details>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row" style={{ minHeight: 40 }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** Render only while open. Applies on ✓, discards on ✕/Escape. */
export function FiltersSheet({
  sessions,
  filter,
  onApply,
  onClose,
}: {
  /** The sessions this screen filters (already scoped to its discipline). */
  sessions: Session[];
  filter: SessionFilter;
  onApply: (next: SessionFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SessionFilter>(filter);
  const set = (patch: Partial<SessionFilter>) => setDraft((prev) => ({ ...prev, ...patch }));

  // Options come from the data itself, so the sheet never offers a filter
  // that can't match anything.
  const options = useMemo(() => {
    const pokerGames = new Set<string>();
    const tableGames = new Set<string>();
    const stakes = new Set<string>();
    const currencies = new Set<string>();
    const tableSizes = new Set<number>();
    for (const s of sessions) {
      if (isTableSession(s)) tableGames.add(s.tableGame);
      else if (s.gameType) pokerGames.add(s.gameType);
      const st = sessionStakesLabel(s);
      if (st) stakes.add(st);
      if (s.currency) currencies.add(s.currency);
      if (s.tableSize > 0) tableSizes.add(s.tableSize);
    }
    const locations = [...new Set(sessions.map((s) => s.location).filter(Boolean))].sort();
    const tags = [...new Set(sessions.flatMap((s) => s.tags))].sort();
    const types = SESSION_TYPES.filter((t) => sessions.some((s) => s.sessionType === t));
    return {
      pokerGames: [...pokerGames].sort(),
      tableGames: [...tableGames].sort(),
      stakes: [...stakes].sort(),
      currencies: [...currencies].sort(),
      tableSizes: [...tableSizes].sort((a, b) => a - b),
      locations,
      tags,
      types,
    };
  }, [sessions]);

  const now = Date.now();
  const matching = useMemo(
    () => applyFilter(draft, sessions, now).length,
    [draft, sessions, now],
  );

  return (
    <div className="clock-screen" style={{ background: 'var(--bg)', color: 'var(--on-bg)', justifyContent: 'flex-start', overflowY: 'auto', textAlign: 'left' }}>
      <header className="topbar" style={{ width: '100%', maxWidth: 640 }}>
        <button type="button" className="back" aria-label="Discard filter changes" onClick={onClose}>
          ✕
        </button>
        <h1 className="grow" style={{ fontSize: '1.25rem', textAlign: 'center' }}>Filters</h1>
        <button type="button" className="back" aria-label="Apply filters" onClick={() => onApply(draft)}>
          ✓
        </button>
      </header>

      <div className="col" style={{ width: '100%', maxWidth: 640, padding: '0 var(--space) var(--space)', gap: 12 }}>
        <button
          type="button"
          className="btn btn-outline btn-block"
          onClick={() => setDraft({ ...EMPTY_FILTER, query: draft.query })}
        >
          Clear all filters
        </button>

        <p className="muted" style={{ margin: 0, textAlign: 'center' }} role="status">
          Chosen filters will show {matching}/{sessions.length} sessions
        </p>

        <div className="chips chips-wrap" role="group" aria-label="Date range">
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              className="chip"
              aria-pressed={draft.range === r}
              onClick={() => set({ range: draft.range === r ? 'ALL' : r })}
            >
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {options.types.length > 1 && (
          <FilterSection title="Categories" count={draft.types.length}>
            {options.types.map((t) => (
              <CheckRow
                key={t}
                label={SESSION_TYPE_LABELS[t]}
                checked={draft.types.includes(t)}
                onChange={() => set({ types: toggle(draft.types, t) })}
              />
            ))}
          </FilterSection>
        )}

        {options.pokerGames.length > 0 && (
          <FilterSection title="Games" count={draft.games.length}>
            {options.pokerGames.map((g) => (
              <CheckRow
                key={g}
                label={gameTypeLabel(g)}
                checked={draft.games.includes(g)}
                onChange={() => set({ games: toggle(draft.games, g) })}
              />
            ))}
          </FilterSection>
        )}

        {options.tableGames.length > 0 && (
          <FilterSection title="Table games" count={draft.tableGames.length}>
            {options.tableGames.map((g) => (
              <CheckRow
                key={g}
                label={tableGameLabel(g)}
                checked={draft.tableGames.includes(g)}
                onChange={() => set({ tableGames: toggle(draft.tableGames, g) })}
              />
            ))}
          </FilterSection>
        )}

        {options.locations.length > 0 && (
          <FilterSection title="Venues" count={draft.locations.length}>
            {options.locations.map((loc) => (
              <CheckRow
                key={loc}
                label={loc}
                checked={draft.locations.includes(loc)}
                onChange={() => set({ locations: toggle(draft.locations, loc) })}
              />
            ))}
          </FilterSection>
        )}

        <FilterSection title="Live / online" count={draft.venueType !== null ? 1 : 0}>
          {(['LIVE', 'ONLINE'] as const).map((v) => (
            <CheckRow
              key={v}
              label={v === 'LIVE' ? 'Live' : 'Online'}
              checked={draft.venueType === v}
              onChange={(on) => set({ venueType: on ? v : null })}
            />
          ))}
        </FilterSection>

        {options.stakes.length > 0 && (
          <FilterSection title="Stakes" count={draft.stakes.length}>
            {options.stakes.map((st) => (
              <CheckRow
                key={st}
                label={st}
                checked={draft.stakes.includes(st)}
                onChange={() => set({ stakes: toggle(draft.stakes, st) })}
              />
            ))}
          </FilterSection>
        )}

        {options.currencies.length > 1 && (
          <FilterSection title="Currencies" count={draft.currencies.length}>
            {options.currencies.map((c) => (
              <CheckRow
                key={c}
                label={c}
                checked={draft.currencies.includes(c)}
                onChange={() => set({ currencies: toggle(draft.currencies, c) })}
              />
            ))}
          </FilterSection>
        )}

        {options.tableSizes.length > 0 && (
          <FilterSection title="Table size" hint="Players at the table, when recorded." count={draft.tableSizes.length}>
            {options.tableSizes.map((n) => (
              <CheckRow
                key={n}
                label={`${n}-handed`}
                checked={draft.tableSizes.includes(n)}
                onChange={() => set({ tableSizes: toggle(draft.tableSizes, n) })}
              />
            ))}
          </FilterSection>
        )}

        {options.tags.length > 0 && (
          <FilterSection title="Tags" count={draft.tags.length}>
            {options.tags.map((t) => (
              <CheckRow
                key={t}
                label={t}
                checked={draft.tags.includes(t)}
                onChange={() => set({ tags: toggle(draft.tags, t) })}
              />
            ))}
          </FilterSection>
        )}

        <FilterSection title="Day of the week" hint="The day of the week the session started." count={draft.weekdays.length}>
          {DAY_NAMES.map((name, day) => (
            <CheckRow
              key={name}
              label={name}
              checked={draft.weekdays.includes(day)}
              onChange={() => set({ weekdays: toggle(draft.weekdays, day) })}
            />
          ))}
        </FilterSection>

        <button type="button" className="btn btn-block" onClick={() => onApply(draft)}>
          Show {matching} session{matching === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}
