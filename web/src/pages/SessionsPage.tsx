// Port of Android SessionsScreen: search, filter chips, dropdowns, list.
import { useAppState } from '../hooks/useAppState';
import {
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  GameType,
  profit,
} from '../models/types';
import { DATE_RANGE_LABELS, DateRange } from '../domain/filter';
import { hourlyRate } from '../domain/stats';
import { signedMoney, perHour } from '../domain/format';
import { SessionRow, profitClass } from '../components/common';

export default function SessionsPage() {
  const app = useAppState();
  const { filter } = app;
  const stats = app.filteredStats;
  const currency = app.settings.currency;

  return (
    <main className="page">
      <h1>Sessions</h1>
      <div className="row muted">
        <span>{stats.sessionCount} sessions</span>
        <span className={`money ${profitClass(stats.totalProfit)}`} style={{ fontWeight: 600 }}>
          {signedMoney(stats.totalProfit, currency)}
        </span>
        <span className="money">{perHour(hourlyRate(stats), currency)}</span>
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

      <div className="chips" role="group" aria-label="Session type filter">
        <button
          type="button"
          className="chip"
          aria-pressed={filter.type === null}
          onClick={() => app.setFilter({ ...filter, type: null })}
        >
          All types
        </button>
        {SESSION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className="chip"
            aria-pressed={filter.type === t}
            onClick={() => app.setFilter({ ...filter, type: filter.type === t ? null : t })}
          >
            {SESSION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

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

      <div className="row">
        <label className="field grow">
          <span>Game</span>
          <select
            value={filter.game ?? ''}
            onChange={(e) =>
              app.setFilter({ ...filter, game: (e.target.value || null) as GameType | null })
            }
          >
            <option value="">Any game</option>
            {GAME_TYPES.map((g) => (
              <option key={g} value={g}>{GAME_TYPE_LABELS[g]}</option>
            ))}
          </select>
        </label>
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

      {app.filteredSessions.length === 0 ? (
        <p className="empty">
          {app.sessions.length === 0
            ? 'No sessions yet. Tap + to add one.'
            : 'No sessions match these filters.'}
        </p>
      ) : (
        <div className="col">
          {app.filteredSessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
          <p className="muted small" style={{ textAlign: 'center' }}>
            Total: {signedMoney(app.filteredSessions.reduce((a, s) => a + profit(s), 0), currency)}
          </p>
        </div>
      )}
    </main>
  );
}
