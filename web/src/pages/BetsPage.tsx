// Sports bets: open-bet tracker with one-tap settling, searchable history,
// and a full stats view (record, ROI, CLV, breakdowns). The FAB adds a bet;
// CSV export/import lives in Settings with the rest of the data tools.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  SportsBet,
  Sport,
  BetType,
  BetStatus,
  SPORTS,
  SPORT_LABELS,
  BET_TYPES,
  BET_TYPE_LABELS,
  BET_STATUS_LABELS,
} from '../models/types';
import {
  betProfit,
  betRoi,
  computeBetStats,
  effectiveOdds,
  formatOdds,
  isSettled,
  recordLabel,
  toWin,
} from '../domain/bets';
import { money, signedMoney, signedUnits, percent, formatDate } from '../domain/format';
import { CumulativeProfitChart, BarChart } from '../components/charts';
import {
  BreakdownList,
  FilterPanel,
  MonthHeader,
  SectionCard,
  StatTileGrid,
  groupByMonth,
  profitClass,
} from '../components/common';

type StatusFilter = 'ALL' | 'OPEN' | 'SETTLED';

export default function BetsPage() {
  const app = useAppState();
  const currency = app.settings.currency;
  const stats = app.betStats;
  const unitValue = app.settings.betUnitValue;

  const [view, setView] = useState<'BETS' | 'STATS'>('BETS');
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<Sport | ''>('');
  const [betType, setBetType] = useState<BetType | ''>('');
  const [book, setBook] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return app.bets.filter(
      (b) =>
        (sport === '' || b.sport === sport) &&
        (betType === '' || b.betType === betType) &&
        (book === '' || b.sportsbook === book) &&
        (statusFilter === 'ALL' ||
          (statusFilter === 'OPEN' ? !isSettled(b) : isSettled(b))) &&
        (q === '' ||
          b.event.toLowerCase().includes(q) ||
          b.pick.toLowerCase().includes(q) ||
          b.sportsbook.toLowerCase().includes(q) ||
          b.notes.toLowerCase().includes(q) ||
          SPORT_LABELS[b.sport].toLowerCase().includes(q) ||
          b.legs.some((l) => l.pick.toLowerCase().includes(q)) ||
          b.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [app.bets, query, sport, betType, book, statusFilter]);

  const filterActive =
    query.trim() !== '' || sport !== '' || betType !== '' || book !== '' || statusFilter !== 'ALL';
  const filteredStats = useMemo(
    () => (filterActive ? computeBetStats(filtered) : stats),
    [filterActive, filtered, stats],
  );

  const openBets = filtered.filter((b) => !isSettled(b));
  const settledBets = filtered.filter(isSettled);

  return (
    <main className="page">
      <h1>Sports Bets</h1>

      <div className="segmented" role="group" aria-label="Bets or stats view">
        {(['BETS', 'STATS'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {v === 'BETS' ? 'Bets' : 'Stats'}
          </button>
        ))}
      </div>

      <StatTileGrid
        tiles={[
          { label: 'Record (W-L-P)', value: recordLabel(filteredStats) },
          {
            label: 'Profit',
            value: signedMoney(filteredStats.netProfit, currency),
            className: profitClass(filteredStats.netProfit),
          },
          {
            label: 'ROI',
            value: percent(betRoi(filteredStats)),
            className: profitClass(betRoi(filteredStats)),
          },
          unitValue > 0
            ? {
                label: 'Units',
                value: signedUnits(filteredStats.netProfit / unitValue),
                className: profitClass(filteredStats.netProfit),
              }
            : {
                label: 'At risk',
                value: money(filteredStats.pendingStake, currency),
              },
        ]}
      />

      {view === 'STATS' ? (
        <BetStatsView stats={filteredStats} currency={currency} unitValue={unitValue} />
      ) : (
        <>
          {openBets.length > 0 && (
            <SectionCard title={`Open bets (${openBets.length})`}>
              <p className="muted small" style={{ margin: 0 }}>
                {money(filteredStats.pendingStake, currency)} at risk • to win{' '}
                {money(filteredStats.pendingToWin, currency)}
              </p>
              <div className="col">
                {openBets.map((b) => (
                  <OpenBetRow key={b.id} bet={b} onSettle={app.settleBet} />
                ))}
              </div>
            </SectionCard>
          )}

          <div className="field">
            <label>
              <span className="visually-hidden">Search bets</span>
              <input
                type="search"
                placeholder="Search event, pick, book, tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          <div className="chips" role="group" aria-label="Bet status filter">
            {(['ALL', 'OPEN', 'SETTLED'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ALL' ? 'All' : s === 'OPEN' ? 'Open' : 'Settled'}
              </button>
            ))}
          </div>

          <FilterPanel
            activeCount={(sport !== '' ? 1 : 0) + (betType !== '' ? 1 : 0) + (book !== '' ? 1 : 0)}
            onClear={() => {
              setSport('');
              setBetType('');
              setBook('');
            }}
          >
            <div className="row">
              <label className="field grow">
                <span>Sport</span>
                <select value={sport} onChange={(e) => setSport(e.target.value as Sport | '')}>
                  <option value="">Any sport</option>
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>{SPORT_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label className="field grow">
                <span>Bet type</span>
                <select value={betType} onChange={(e) => setBetType(e.target.value as BetType | '')}>
                  <option value="">Any type</option>
                  {BET_TYPES.map((t) => (
                    <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
            </div>

            {app.availableSportsbooks.length > 0 && (
              <label className="field">
                <span>Sportsbook</span>
                <select value={book} onChange={(e) => setBook(e.target.value)}>
                  <option value="">Any book</option>
                  {app.availableSportsbooks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </label>
            )}
          </FilterPanel>

          {!app.ready ? null : settledBets.length === 0 && openBets.length === 0 ? (
            <p className="empty">
              {app.bets.length === 0
                ? 'No bets yet. Tap + to log your first sports bet.'
                : 'No bets match these filters.'}
            </p>
          ) : (
            settledBets.length > 0 && (
              <>
                <h2>Settled</h2>
                <div className="col">
                  {groupByMonth(settledBets, (b) => b.placedAt, betProfit).map((m) => (
                    <div key={m.key} className="col">
                      <MonthHeader label={m.label} total={m.total} currency={currency} />
                      {m.items.map((b) => (
                        <BetRow key={b.id} bet={b} />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </>
      )}
    </main>
  );
}

function betTitle(b: SportsBet): string {
  if (b.legs.length > 0) return b.pick || `${b.legs.length}-leg ${BET_TYPE_LABELS[b.betType]}`;
  return b.pick || b.event || BET_TYPE_LABELS[b.betType];
}

function OpenBetRow({
  bet,
  onSettle,
}: {
  bet: SportsBet;
  onSettle: (id: number, status: BetStatus) => Promise<void>;
}) {
  const navigate = useNavigate();
  const app = useAppState();
  const oddsLabel = formatOdds(effectiveOdds(bet), app.settings.oddsFormat);
  // Two-tap settle: the first tap arms the choice ("Won?"), the second within
  // a few seconds commits it — three adjacent one-tap buttons on a touch row
  // would otherwise write wrong results with no undo.
  const [armed, setArmed] = useState<BetStatus | null>(null);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  const tap = (status: BetStatus) => {
    if (armed === status) {
      setArmed(null);
      void onSettle(bet.id, status);
    } else {
      setArmed(status);
    }
  };
  const label = (status: BetStatus, text: string) =>
    armed === status ? `${text}? Tap again` : text;
  return (
    <div className="card col" style={{ gap: 8, padding: '10px 12px' }}>
      <button
        type="button"
        className="session-row"
        style={{ padding: 0, border: 'none', background: 'transparent' }}
        onClick={() => navigate(`/bet/${bet.id}`)}
      >
        <span className="grow col" style={{ gap: 2 }}>
          <span className="title">{betTitle(bet)}</span>
          <span className="muted small">
            {[SPORT_LABELS[bet.sport], bet.event, bet.sportsbook].filter(Boolean).join(' • ')}
          </span>
        </span>
        <span className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
          <span className="title money">{oddsLabel || '—'}</span>
          <span className="muted small money">
            {money(bet.stake, bet.currency)} → {signedMoney(toWin(bet), bet.currency)}
            {bet.freeBet ? ' • free bet' : ''}
          </span>
        </span>
      </button>
      <div className="row" role="group" aria-label={`Settle ${betTitle(bet)}`}>
        <button type="button" className="btn grow" aria-pressed={armed === 'WON'} onClick={() => tap('WON')}>
          {label('WON', 'Won')}
        </button>
        <button
          type="button"
          className="btn btn-outline grow"
          aria-pressed={armed === 'LOST'}
          onClick={() => tap('LOST')}
        >
          {label('LOST', 'Lost')}
        </button>
        <button
          type="button"
          className="btn btn-outline grow"
          aria-pressed={armed === 'PUSH'}
          onClick={() => tap('PUSH')}
        >
          {label('PUSH', 'Push')}
        </button>
      </div>
    </div>
  );
}

function BetRow({ bet }: { bet: SportsBet }) {
  const navigate = useNavigate();
  const app = useAppState();
  const p = betProfit(bet);
  const oddsLabel = formatOdds(effectiveOdds(bet), app.settings.oddsFormat);
  const statusNote =
    bet.status === 'WON' || bet.status === 'LOST' ? '' : ` • ${BET_STATUS_LABELS[bet.status]}`;
  return (
    <button type="button" className="session-row" onClick={() => navigate(`/bet/${bet.id}`)}>
      <span className="grow col" style={{ gap: 2 }}>
        <span className="title">{betTitle(bet)}</span>
        <span className="muted small">
          {[formatDate(bet.placedAt), SPORT_LABELS[bet.sport], bet.sportsbook]
            .filter(Boolean)
            .join(' • ')}
          {statusNote}
        </span>
      </span>
      <span className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
        <span className={`title money ${profitClass(p)}`}>{signedMoney(p, bet.currency)}</span>
        <span className="muted small money">
          {oddsLabel ? `${oddsLabel} • ` : ''}
          {money(bet.stake, bet.currency)}
        </span>
      </span>
    </button>
  );
}

function BetStatsView({
  stats,
  currency,
  unitValue,
}: {
  stats: ReturnType<typeof computeBetStats>;
  currency: string;
  unitValue: number;
}) {
  return (
    <>
      <section className="card">
        <div className="overline">Cumulative betting profit</div>
        <CumulativeProfitChart points={stats.cumulative} currency={currency} />
      </section>

      <StatTileGrid
        tiles={[
          {
            label: 'Avg stake',
            value: money(stats.avgStake, currency),
          },
          { label: 'Avg odds', value: stats.avgOdds > 1 ? stats.avgOdds.toFixed(2) : '—' },
          {
            label: 'Biggest win',
            value: signedMoney(stats.biggestWin, currency),
            className: profitClass(stats.biggestWin),
          },
          {
            label: 'Biggest loss',
            value: signedMoney(stats.biggestLoss, currency),
            className: profitClass(stats.biggestLoss),
          },
          {
            label: 'Streak',
            value:
              stats.currentStreak > 0
                ? `${stats.currentStreak} wins`
                : stats.currentStreak < 0
                  ? `${-stats.currentStreak} losses`
                  : '—',
            className: profitClass(stats.currentStreak),
          },
          {
            label: 'At risk',
            value: money(stats.pendingStake, currency),
          },
        ]}
      />

      {unitValue > 0 && (
        <p className="muted small" style={{ margin: 0 }}>
          1 unit = {money(unitValue, currency)} • net{' '}
          {signedUnits(stats.netProfit / unitValue)} units
        </p>
      )}

      <SectionCard title="Profit by month">
        <BarChart
          ariaLabel="Monthly betting profit"
          entries={stats.byMonth.slice(-12).map((m) => ({ label: m.label, value: m.profit }))}
          emptyMessage="Settle bets to see monthly results."
        />
      </SectionCard>

      {stats.clvCount > 0 && (
        <SectionCard title="Closing line value">
          <div className={`money ${profitClass(stats.avgClv)}`} style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {stats.avgClv >= 0 ? '+' : ''}
            {stats.avgClv.toFixed(2)}%
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Average CLV across {stats.clvCount} bet{stats.clvCount === 1 ? '' : 's'} with closing
            odds recorded. Consistently beating the close is the strongest long-term edge signal.
          </p>
        </SectionCard>
      )}

      <SectionCard title="By odds range">
        <BreakdownList groups={stats.byOddsBand} currency={currency} countNoun="bets" showRate={false} />
      </SectionCard>
      <SectionCard title="By sport">
        <BreakdownList groups={stats.bySport} currency={currency} countNoun="bets" showRate={false} />
      </SectionCard>
      <SectionCard title="By bet type">
        <BreakdownList groups={stats.byType} currency={currency} countNoun="bets" showRate={false} />
      </SectionCard>
      <SectionCard title="By sportsbook">
        <BreakdownList
          groups={stats.byBook}
          currency={currency}
          countNoun="bets"
          showRate={false}
          emptyMessage="Record which book each bet was placed at to compare them."
        />
      </SectionCard>
      <SectionCard title="By day of week">
        <BreakdownList groups={stats.byWeekday} currency={currency} countNoun="bets" showRate={false} />
      </SectionCard>
      {stats.byTag.length > 0 && (
        <SectionCard title="By tag">
          <BreakdownList groups={stats.byTag} currency={currency} countNoun="bets" showRate={false} />
        </SectionCard>
      )}
    </>
  );
}

