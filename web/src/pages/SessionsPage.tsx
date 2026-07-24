// Sessions list, scoped to a discipline: the Poker tab shows non-table
// sessions, the Table tab shows table-game sessions. Search sits inline;
// every other dimension lives in the full-screen Filters sheet. Sessions are
// grouped by month with a net-profit subtotal.
import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { Session, profit } from '../models/types';
import { SessionFilter, activeFilterCount, applyFilter } from '../domain/filter';
import { computeStats, hourlyRate } from '../domain/stats';
import { signedMoney, signedUnits, perHour } from '../domain/format';
import { MonthHeader, SessionRow, groupByMonth, profitClass } from '../components/common';
import { FiltersSheet } from '../components/FiltersSheet';

export default function SessionsPage({ scope = 'POKER' }: { scope?: 'POKER' | 'TABLE' }) {
  const app = useAppState();
  const { filter } = app;
  const isTable = scope === 'TABLE';
  const currency = app.settings.currency;
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Restrict the list to this tab's discipline and neutralise filter fields
  // that belong to the other discipline, so poker/table filters never bleed.
  const inScope = (s: Session) => (isTable ? s.sessionType === 'TABLE' : s.sessionType !== 'TABLE');
  const scoped = app.sessions.filter(inScope);
  const effectiveFilter: SessionFilter = {
    ...filter,
    types: isTable ? [] : filter.types.filter((t) => t !== 'TABLE'),
    games: isTable ? [] : filter.games,
    tableGames: isTable ? filter.tableGames : [],
  };
  const list = applyFilter(effectiveFilter, scoped, Date.now());
  const stats = computeStats(list);

  // Badge counts everything except the query (the search box shows itself).
  const filterCount = activeFilterCount({ ...effectiveFilter, query: '' });

  // On the Table tab, results show in units when that display is turned on.
  const unitDisplay =
    isTable && app.settings.showTableUnits && app.settings.tableUnitValue > 0
      ? app.settings.tableUnitValue
      : 0;

  const months = groupByMonth(list, (s) => s.startTime, profit);

  return (
    <main className="page">
      <div className="row-between">
        <h1>{isTable ? 'Table Games' : 'Poker'}</h1>
        <div className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className={`money ${profitClass(stats.totalProfit)}`} style={{ fontWeight: 600 }}>
            {unitDisplay ? signedUnits(stats.totalProfit / unitDisplay) : signedMoney(stats.totalProfit, currency)}
          </span>
          <span className="muted small">
            {stats.sessionCount} sessions • {perHour(hourlyRate(stats), currency)}
          </span>
        </div>
      </div>

      <div className="row">
        <div className="field grow">
          <label>
            <span className="visually-hidden">Search sessions</span>
            <input
              type="search"
              placeholder="Search venue, notes, game…"
              value={filter.query}
              onChange={(e) => app.setFilter({ ...filter, query: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          className="chip"
          style={{ alignSelf: 'center' }}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
        >
          Filters
          {filterCount > 0 && <span className="chip-badge">{filterCount}</span>}
        </button>
      </div>

      {filtersOpen && (
        <FiltersSheet
          sessions={scoped}
          filter={effectiveFilter}
          onApply={(next) => {
            app.setFilter({ ...next, query: filter.query });
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {!app.ready ? null : list.length === 0 ? (
        <p className="empty">
          {scoped.length === 0
            ? isTable
              ? 'No table-game sessions yet. Tap + to add one.'
              : 'No poker sessions yet. Tap + to add one.'
            : 'No sessions match these filters.'}
        </p>
      ) : (
        <div className="col">
          {months.map((m) => (
            <div key={m.key} className="col">
              <MonthHeader label={m.label} total={m.total} currency={currency} unitValue={unitDisplay} />
              {m.items.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
