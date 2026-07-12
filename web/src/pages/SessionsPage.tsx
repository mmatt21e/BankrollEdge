// Sessions list, scoped to a discipline: the Sessions tab shows poker
// (non-table) sessions, the Table Games tab shows table-game sessions. Search
// and the advanced filters are shared; the primary chips and game options
// follow the scope. Sessions are grouped by month with a net-profit subtotal.
import { useAppState } from '../hooks/useAppState';
import {
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  Session,
  GameType,
  TableGameType,
  pokerGameOptions,
  tableGameOptions,
  profit,
} from '../models/types';
import { DATE_RANGE_LABELS, DateRange, SessionFilter, applyFilter } from '../domain/filter';
import { computeStats, hourlyRate } from '../domain/stats';
import { signedMoney, perHour } from '../domain/format';
import {
  FilterPanel,
  MonthHeader,
  SessionRow,
  groupByMonth,
  profitClass,
} from '../components/common';

export default function SessionsPage({ scope = 'POKER' }: { scope?: 'POKER' | 'TABLE' }) {
  const app = useAppState();
  const { filter } = app;
  const isTable = scope === 'TABLE';
  const currency = app.settings.currency;

  // Restrict the list to this tab's discipline and neutralise filter fields
  // that belong to the other discipline, so poker/table filters never bleed.
  const inScope = (s: Session) => (isTable ? s.sessionType === 'TABLE' : s.sessionType !== 'TABLE');
  const effectiveFilter: SessionFilter = {
    ...filter,
    type: isTable ? null : filter.type === 'TABLE' ? null : filter.type,
    game: isTable ? null : filter.game,
    tableGame: isTable ? filter.tableGame : null,
  };
  const list = applyFilter(effectiveFilter, app.sessions, Date.now()).filter(inScope);
  const stats = computeStats(list);
  const scopeTotal = app.sessions.filter(inScope).length;

  // Poker gets session-type chips (Cash / Tournament / …); table games have no
  // sub-types, so the chips pick a table game (Blackjack / Craps / …) instead.
  const pokerTypes = SESSION_TYPES.filter((t) => t !== 'TABLE');
  const tableGames = tableGameOptions(app.settings, app.recordedTableGames);

  const advancedCount =
    (filter.venueType !== null ? 1 : 0) +
    (filter.tag !== null ? 1 : 0) +
    (filter.range !== 'ALL' ? 1 : 0) +
    (!isTable && filter.game !== null ? 1 : 0) +
    (filter.location !== null ? 1 : 0);

  const clearAdvanced = () =>
    app.setFilter({
      ...filter,
      venueType: null,
      tag: null,
      range: 'ALL',
      game: null,
      location: null,
    });

  const months = groupByMonth(list, (s) => s.startTime, profit);

  return (
    <main className="page">
      <div className="row-between">
        <h1>{isTable ? 'Table Games' : 'Poker'}</h1>
        <div className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className={`money ${profitClass(stats.totalProfit)}`} style={{ fontWeight: 600 }}>
            {signedMoney(stats.totalProfit, currency)}
          </span>
          <span className="muted small">
            {stats.sessionCount} sessions • {perHour(hourlyRate(stats), currency)}
          </span>
        </div>
      </div>

      <div className="field">
        <label>
          <span className="visually-hidden" style={{ display: 'none' }}>Search sessions</span>
          <input
            type="search"
            placeholder="Search venue, notes, game…"
            value={filter.query}
            onChange={(e) => app.setFilter({ ...filter, query: e.target.value })}
          />
        </label>
      </div>

      {isTable ? (
        <div className="chips" role="group" aria-label="Table game filter">
          <button
            type="button"
            className="chip"
            aria-pressed={filter.tableGame === null}
            onClick={() => app.setFilter({ ...filter, tableGame: null })}
          >
            All games
          </button>
          {tableGames.map((g) => (
            <button
              key={g.value}
              type="button"
              className="chip"
              aria-pressed={filter.tableGame === g.value}
              onClick={() =>
                app.setFilter({
                  ...filter,
                  tableGame: (filter.tableGame === g.value ? null : g.value) as TableGameType | null,
                })
              }
            >
              {g.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="chips" role="group" aria-label="Session type filter">
          {/* A TABLE default type doesn't apply here, so treat it as "All". */}
          {(() => {
            const activeType = filter.type === 'TABLE' ? null : filter.type;
            return (
              <>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={activeType === null}
                  onClick={() => app.setFilter({ ...filter, type: null })}
                >
                  All types
                </button>
                {pokerTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    aria-pressed={activeType === t}
                    onClick={() =>
                      app.setFilter({ ...filter, type: activeType === t ? null : t })
                    }
                  >
                    {SESSION_TYPE_LABELS[t]}
                  </button>
                ))}
              </>
            );
          })()}
        </div>
      )}

      <FilterPanel activeCount={advancedCount} onClear={clearAdvanced}>
        <div className="chips" role="group" aria-label="Date range filter">
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              className="chip"
              aria-pressed={filter.range === r}
              onClick={() => app.setFilter({ ...filter, range: r })}
            >
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="chips" role="group" aria-label="Live or online filter">
          {(['LIVE', 'ONLINE'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className="chip"
              aria-pressed={filter.venueType === v}
              onClick={() =>
                app.setFilter({ ...filter, venueType: filter.venueType === v ? null : v })
              }
            >
              {v === 'LIVE' ? 'Live' : 'Online'}
            </button>
          ))}
          {app.availableTags.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={filter.tag === t}
              onClick={() => app.setFilter({ ...filter, tag: filter.tag === t ? null : t })}
            >
              #{t}
            </button>
          ))}
        </div>

        <div className="row">
          {!isTable && (
            <label className="field grow">
              <span>Game</span>
              <select
                value={filter.game ?? ''}
                onChange={(e) =>
                  app.setFilter({ ...filter, game: (e.target.value || null) as GameType | null })
                }
              >
                <option value="">Any game</option>
                {pokerGameOptions(app.settings, app.recordedPokerGames).map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field grow">
            <span>Venue</span>
            <select
              value={filter.location ?? ''}
              onChange={(e) => app.setFilter({ ...filter, location: e.target.value || null })}
            >
              <option value="">Any venue</option>
              {app.availableLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </label>
        </div>
      </FilterPanel>

      {list.length === 0 ? (
        <p className="empty">
          {scopeTotal === 0
            ? isTable
              ? 'No table-game sessions yet. Tap + to add one.'
              : 'No poker sessions yet. Tap + to add one.'
            : 'No sessions match these filters.'}
        </p>
      ) : (
        <div className="col">
          {months.map((m) => (
            <div key={m.key} className="col">
              <MonthHeader label={m.label} total={m.total} currency={currency} />
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
