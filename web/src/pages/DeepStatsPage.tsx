// Detailed statistics: Pokerbase-style tile grids per discipline plus the
// "Statistics by …" drill-downs. Respects the same filter state as the
// dashboard (open the Filters sheet from here too).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { activeFilterCount } from '../domain/filter';
import {
  BREAKDOWN_DIMS,
  computeCashDeep,
  computeTournamentDeep,
} from '../domain/deepStats';
import { avgProfit, hourlyRate, winRate } from '../domain/stats';
import { money, percent, perHour, signedMoney } from '../domain/format';
import { StatTileGrid, TopBar, profitClass, useBack } from '../components/common';
import { FiltersSheet } from '../components/FiltersSheet';

type Scope = 'ALL' | 'CASH' | 'TOURNAMENT';

export default function DeepStatsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const back = useBack('/');
  const currency = app.settings.currency;
  const [scope, setScope] = useState<Scope>('ALL');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sessions = app.filteredSessions;
  const all = app.filteredStats;
  const cash = computeCashDeep(sessions);
  const tourney = computeTournamentDeep(sessions);
  const filterCount = activeFilterCount(app.filter);

  const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

  return (
    <>
      <TopBar
        title="Detailed statistics"
        onBack={back}
        action={
          <button
            type="button"
            className="chip chip-small"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            Filters
            {filterCount > 0 && <span className="chip-badge">{filterCount}</span>}
          </button>
        }
      />
      <main className="page page--with-topbar">
        <div className="segmented" role="group" aria-label="Discipline">
          {(
            [
              ['ALL', 'All'],
              ['CASH', 'Cash games'],
              ['TOURNAMENT', 'Tournaments'],
            ] as [Scope, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {scope === 'ALL' && (
          <StatTileGrid
            tiles={[
              { label: 'Total profit', value: signedMoney(all.totalProfit, currency), className: profitClass(all.totalProfit) },
              { label: 'Avg profit / hour', value: perHour(hourlyRate(all), currency) },
              { label: 'Avg profit / session', value: signedMoney(avgProfit(all), currency), className: profitClass(avgProfit(all)) },
              { label: 'Profitable ratio', value: percent(winRate(all)) },
              { label: 'Playing hours', value: all.totalHours.toFixed(1) },
              { label: 'Sessions', value: String(all.sessionCount) },
            ]}
          />
        )}

        {scope === 'CASH' && (
          <>
            <StatTileGrid
              tiles={[
                { label: 'Total profit', value: signedMoney(cash.totalProfit, currency), className: profitClass(cash.totalProfit) },
                { label: 'Sessions', value: String(cash.sessions) },
                { label: 'Playing hours', value: cash.hours.toFixed(1) },
                { label: 'Hands played', value: String(cash.hands) },
                { label: 'Avg profit / hour', value: perHour(cash.profitPerHour, currency) },
                { label: 'Avg profit / session', value: signedMoney(cash.avgProfitPerSession, currency), className: profitClass(cash.avgProfitPerSession) },
              ]}
            />
            <StatTileGrid
              tiles={[
                { label: 'BB / hour', value: num(cash.bbPerHour) },
                { label: 'BB / 100 hands', value: num(cash.bbPer100) },
                { label: 'BB / session', value: num(cash.bbPerSession) },
                { label: 'Profit / 100 hands', value: signedMoney(cash.profitPer100, currency) },
                { label: 'Profitable ratio', value: percent(cash.profitableRatio) },
                { label: '$/hr std dev', value: money(cash.stdDevPerHour, currency) },
                { label: 'Total buy-ins', value: money(cash.totalBuyins, currency) },
                { label: 'Total cash-outs', value: money(cash.totalCashouts, currency) },
              ]}
            />
            <p className="muted small" style={{ margin: 0 }}>
              Big-blind metrics use sessions with blinds recorded; per-100 metrics use sessions
              with hands recorded.
            </p>
          </>
        )}

        {scope === 'TOURNAMENT' && (
          <StatTileGrid
            tiles={[
              { label: 'Total profit', value: signedMoney(tourney.totalProfit, currency), className: profitClass(tourney.totalProfit) },
              { label: 'Tournaments', value: String(tourney.tournaments) },
              { label: 'Bullets', value: String(tourney.bullets) },
              { label: 'Playing hours', value: tourney.hours.toFixed(1) },
              { label: 'ITM ratio', value: percent(tourney.itmRatio) },
              { label: 'Total ROI', value: percent(tourney.totalRoi), className: profitClass(tourney.totalRoi) },
              { label: 'Avg ROI / tournament', value: percent(tourney.avgRoi), className: profitClass(tourney.avgRoi) },
              { label: 'Avg profit / bullet', value: signedMoney(tourney.avgProfitPerBullet, currency), className: profitClass(tourney.avgProfitPerBullet) },
              { label: 'Avg buy-in / bullet', value: money(tourney.avgBuyinPerBullet, currency) },
              { label: 'Total buy-ins', value: money(tourney.totalBuyins, currency) },
              { label: 'Total cash-outs', value: money(tourney.totalCashouts, currency) },
            ]}
          />
        )}

        <div className="col">
          {BREAKDOWN_DIMS.map((d) => (
            <button
              key={d.key}
              type="button"
              className="session-row"
              onClick={() => navigate(`/stats/by/${d.key}?scope=${scope.toLowerCase()}`)}
            >
              <span className="grow title">
                Statistics by <strong>{d.label}</strong>
              </span>
              <span aria-hidden="true" className="muted">›</span>
            </button>
          ))}
        </div>

        {filtersOpen && (
          <FiltersSheet
            sessions={app.sessions}
            filter={app.filter}
            onApply={(next) => {
              app.setFilter(next);
              setFiltersOpen(false);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        )}
      </main>
    </>
  );
}
