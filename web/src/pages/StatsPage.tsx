// The Dashboard tab: quick filter chips (wrapped — nothing to swipe), then
// the dashboard core (profit chart, tiles, daily heatmap), then detail tabs.
// A Sports quick filter flips the whole dashboard to sports-betting stats.
// Which cards appear is user-configurable in Settings → Display.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { DATE_RANGE_LABELS, DateRange, rangeStart } from '../domain/filter';
import {
  Statistics,
  hourlyRate,
  avgProfit,
  roi,
  winRate,
  itmRate,
  isLossSide,
} from '../domain/stats';
import { BetStats, betProfit, betRoi, computeBetStats, isSettled, recordLabel, toWin } from '../domain/bets';
import {
  money,
  signedMoney,
  perHour,
  percent,
  compactMoney,
  hourLabel,
  formatDate,
} from '../domain/format';
import { computeInsights } from '../domain/insights';
import { Session, SportsBet, SessionType, VenueType, profit, stakesLabel } from '../models/types';
import { BarChart, CumulativeProfitChart, DailyHeatmap } from '../components/charts';
import { StatTileGrid, BreakdownList, SectionCard, SessionRow, profitClass } from '../components/common';
import { ClvCard, SportsBreakdownCards, SportsMonthlyCard } from '../components/SportsStats';
import { LiveSessionCard } from '../components/LiveSessionCard';

type DetailTab = 'TRENDS' | 'BREAKDOWNS' | 'VARIANCE';
type Discipline = 'POKER' | 'SPORTS';

export default function StatsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const stats = app.filteredStats;
  const currency = app.settings.currency;
  const { filter, settings } = app;
  const [tab, setTab] = useState<DetailTab>('TRENDS');
  const canSession = settings.showPoker || settings.showTableGames;
  const [discipline, setDiscipline] = useState<Discipline>(canSession ? 'POKER' : 'SPORTS');
  // No session-capable features left = the dashboard is sports-only.
  const sports = discipline === 'SPORTS' || !canSession;

  // Hero bankroll (all-time, unaffected by the dashboard filters below).
  const allStats = app.allStats;
  const includeBets = settings.showSports && !settings.separateBankrolls;
  const allTime =
    (canSession ? allStats.totalProfit : 0) + (includeBets ? app.betStats.netProfit : 0);
  const showSportsRoll = settings.showSports && settings.separateBankrolls && canSession;

  const betsInRange = useMemo(() => {
    const from = rangeStart(filter.range, Date.now());
    return app.bets.filter((b) => from === null || b.placedAt >= from);
  }, [app.bets, filter.range]);
  const sportsStats = useMemo(() => computeBetStats(betsInRange), [betsInRange]);

  const quickTypes: [SessionType, string][] = [
    ...(settings.showPoker
      ? ([
          ['CASH', 'Cash'],
          ['TOURNAMENT', 'Tournaments'],
        ] as [SessionType, string][])
      : []),
    ...(settings.showTableGames ? ([['TABLE', 'Table games']] as [SessionType, string][]) : []),
  ];

  // Tapping any poker-side chip leaves sports mode and applies the filter.
  const toggleType = (t: SessionType) => {
    setDiscipline('POKER');
    const next = !sports && filter.type === t ? null : t;
    app.setFilter({
      ...filter,
      type: next,
      game: next === 'TABLE' ? null : filter.game,
      tableGame: next === 'TABLE' ? filter.tableGame : null,
    });
  };
  const toggleVenue = (v: VenueType) => {
    setDiscipline('POKER');
    app.setFilter({ ...filter, venueType: !sports && filter.venueType === v ? null : v });
  };

  // Until the database has loaded, render an empty page rather than zeroed
  // balances that flash to the real numbers (or read as "my data is gone").
  if (!app.ready) return <main className="page" />;

  return (
    <main className="page">
      <button
        type="button"
        onClick={() => navigate('/bankroll')}
        className="btn-plain"
        aria-label="Manage bankroll"
      >
        <div className="overline" style={{ color: 'var(--accent)' }}>
          {showSportsRoll ? 'Poker bankroll ›' : 'Current bankroll ›'}
        </div>
        <h1 className="money money-xl">
          {money(
            !canSession && settings.separateBankrolls ? app.sportsBankroll : app.bankroll,
            currency,
          )}
        </h1>
        <div className={`muted ${profitClass(canSession ? allTime : app.betStats.netProfit)}`}>
          {signedMoney(canSession ? allTime : app.betStats.netProfit, currency)} all-time
        </div>
        {showSportsRoll && (
          <div className="muted" style={{ marginTop: 4 }}>
            <span className="overline" style={{ color: 'var(--accent)' }}>Sports bankroll</span>{' '}
            <span className="money" style={{ fontWeight: 700 }}>
              {money(app.sportsBankroll, currency)}
            </span>
          </div>
        )}
      </button>

      {canSession && <LiveSessionCard />}

      {settings.showSports && <OpenBetsCard />}

      <div className="chips chips-wrap" role="group" aria-label="Date range">
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

      <div className="chips chips-wrap" role="group" aria-label="Quick filters">
        {canSession && (
          <button
            type="button"
            className="chip"
            aria-pressed={!sports && filter.type === null}
            onClick={() => {
              setDiscipline('POKER');
              app.setFilter({ ...filter, type: null, game: null, tableGame: null });
            }}
          >
            All games
          </button>
        )}
        {quickTypes.map(([t, label]) => (
          <button
            key={t}
            type="button"
            className="chip"
            aria-pressed={!sports && filter.type === t}
            onClick={() => toggleType(t)}
          >
            {label}
          </button>
        ))}
        {canSession &&
          (['LIVE', 'ONLINE'] as VenueType[]).map((v) => (
            <button
              key={v}
              type="button"
              className="chip"
              aria-pressed={!sports && filter.venueType === v}
              onClick={() => toggleVenue(v)}
            >
              {v === 'LIVE' ? 'Live' : 'Online'}
            </button>
          ))}
        {settings.showSports && canSession && (
          <button
            type="button"
            className="chip"
            aria-pressed={sports}
            onClick={() => {
              const next = sports ? 'POKER' : 'SPORTS';
              setDiscipline(next);
              // Sports mode has no Variance tab — land on Trends instead.
              if (next === 'SPORTS' && tab === 'VARIANCE') setTab('TRENDS');
            }}
          >
            Sports
          </button>
        )}
      </div>

      {settings.dashChart && (
        <section className="card col" style={{ gap: 8 }}>
          <div className="row-between">
            <div>
              <div className="overline">{sports ? 'Sports profit' : 'Profit'}</div>
              <div
                className={`money money-lg ${profitClass(sports ? sportsStats.netProfit : stats.totalProfit)}`}
              >
                {signedMoney(sports ? sportsStats.netProfit : stats.totalProfit, currency)}
              </div>
            </div>
            <span className="muted small">
              {sports ? `${betsInRange.length} bets` : `${stats.sessionCount} sessions`}
            </span>
          </div>
          <CumulativeProfitChart
            points={sports ? sportsStats.cumulative : stats.cumulative}
            currency={currency}
            emptyMessage={
              sports
                ? 'Settle at least two bets to see your profit graph.'
                : 'Log at least two sessions to see your profit graph.'
            }
          />
        </section>
      )}

      {settings.dashTiles &&
        (sports ? (
          <StatTileGrid
            tiles={[
              { label: 'Record (W-L-P)', value: recordLabel(sportsStats) },
              { label: 'ROI', value: percent(betRoi(sportsStats)), className: profitClass(betRoi(sportsStats)) },
              { label: 'At risk', value: money(sportsStats.pendingStake, currency) },
              { label: 'Avg odds', value: sportsStats.avgOdds > 1 ? sportsStats.avgOdds.toFixed(2) : '—' },
              { label: 'Biggest win', value: signedMoney(sportsStats.biggestWin, currency), className: profitClass(sportsStats.biggestWin) },
              { label: 'Biggest loss', value: signedMoney(sportsStats.biggestLoss, currency), className: profitClass(sportsStats.biggestLoss) },
            ]}
          />
        ) : (
          <StatTileGrid
            tiles={[
              { label: 'Per hour', value: perHour(hourlyRate(stats), currency), className: profitClass(hourlyRate(stats)) },
              { label: 'Win rate', value: percent(winRate(stats)) },
              { label: 'ROI', value: percent(roi(stats)), className: profitClass(roi(stats)) },
              { label: 'Avg / session', value: signedMoney(avgProfit(stats), currency), className: profitClass(avgProfit(stats)) },
              { label: 'Hours', value: stats.totalHours.toFixed(1) },
              { label: 'Sessions', value: String(stats.sessionCount) },
            ]}
          />
        ))}

      {settings.dashHeatmap && (
        <SectionCard title="Daily results">
          <p className="muted small" style={{ margin: 0 }}>
            Last 16 weeks — deeper color = bigger result.
          </p>
          <DailyHeatmap
            points={
              sports
                ? betsInRange.filter(isSettled).map((b) => ({ time: b.placedAt, value: betProfit(b) }))
                : app.filteredSessions.map((s) => ({ time: s.startTime, value: profit(s) }))
            }
            currency={currency}
          />
        </SectionCard>
      )}

      {canSession && <Insights />}

      {!sports && settings.showSports && settings.dashSports && <SportsSnapshot />}

      <div className="segmented" role="group" aria-label="Detailed statistics">
        {(
          [
            ['TRENDS', 'Trends'],
            ['BREAKDOWNS', 'Breakdowns'],
            ...(!sports ? [['VARIANCE', 'Variance'] as [DetailTab, string]] : []),
          ] as [DetailTab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {sports ? (
        tab === 'BREAKDOWNS' ? (
          <SportsBreakdownsView stats={sportsStats} currency={currency} />
        ) : (
          <SportsTrendsView stats={sportsStats} />
        )
      ) : (
        <>
          {tab === 'TRENDS' && (
            <TrendsView stats={stats} currency={currency} sessions={app.sessions} bankroll={app.bankroll} />
          )}
          {tab === 'BREAKDOWNS' && <BreakdownsView stats={stats} currency={currency} />}
          {tab === 'VARIANCE' && <VarianceCard stats={stats} currency={currency} />}
        </>
      )}

      <RecentActivity />
    </main>
  );
}

/** Recent sessions (or bets, when sports-only) with a link to the full list. */
function RecentActivity() {
  const app = useAppState();
  const navigate = useNavigate();
  const { settings } = app;
  const canSession = settings.showPoker || settings.showTableGames;

  if (canSession) {
    if (app.sessions.length === 0) return null;
    return (
      <>
        <div className="row-between">
          <h2>Recent sessions</h2>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate(settings.showPoker ? '/sessions' : '/tables')}
          >
            See all
          </button>
        </div>
        <div className="col">
          {app.sessions.slice(0, 5).map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      </>
    );
  }

  if (!settings.showSports || app.bets.length === 0) return null;
  return (
    <>
      <div className="row-between">
        <h2>Recent bets</h2>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/bets')}>
          See all
        </button>
      </div>
      <div className="col">
        {app.bets.slice(0, 5).map((b) => (
          <RecentBetRow key={b.id} bet={b} />
        ))}
      </div>
    </>
  );
}

/** Compact bet row for the sports-only dashboard. */
function RecentBetRow({ bet }: { bet: SportsBet }) {
  const navigate = useNavigate();
  const settled = isSettled(bet);
  const p = betProfit(bet);
  const title = bet.pick || bet.event || 'Bet';
  return (
    <button type="button" className="session-row" onClick={() => navigate(`/bet/${bet.id}`)}>
      <span className="grow col" style={{ gap: 2 }}>
        <span className="title">{title}</span>
        <span className="muted small">
          {[formatDate(bet.placedAt), bet.sportsbook].filter(Boolean).join(' • ')}
        </span>
      </span>
      <span className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
        {settled ? (
          <span className={`title money ${profitClass(p)}`}>{signedMoney(p, bet.currency)}</span>
        ) : (
          <>
            <span className="title money">{money(bet.stake, bet.currency)}</span>
            <span className="muted small money">to win {money(toWin(bet), bet.currency)}</span>
          </>
        )}
      </span>
    </button>
  );
}

/** Pending sports bets at a glance; hidden when nothing is open. */
function OpenBetsCard() {
  const app = useAppState();
  const navigate = useNavigate();
  const { pendingCount, pendingStake, pendingToWin } = app.betStats;
  if (pendingCount === 0) return null;
  const currency = app.settings.currency;
  return (
    <button
      type="button"
      className="card row-between"
      style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
      onClick={() => navigate('/bets')}
      aria-label={`${pendingCount} open bets`}
    >
      <div className="grow">
        <h2>
          {pendingCount} open bet{pendingCount === 1 ? '' : 's'} ›
        </h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {money(pendingStake, currency)} at risk • to win {money(pendingToWin, currency)}
        </p>
      </div>
    </button>
  );
}

/** Top auto-generated insights from recent sessions. */
function Insights() {
  const app = useAppState();
  const insights = computeInsights(app.sessions, app.settings.currency).slice(0, 3);
  if (insights.length === 0) return null;
  return (
    <section className="col" aria-label="Insights">
      <h2>Insights</h2>
      {insights.map((ins) => (
        <div key={ins.id} className={`insight ${ins.tone}`}>
          {ins.text}
        </div>
      ))}
    </section>
  );
}

/** Settled record + net from the Sports tab, at a glance; hidden with no bets. */
function SportsSnapshot() {
  const app = useAppState();
  const navigate = useNavigate();
  if (app.bets.length === 0) return null;
  const stats = app.betStats;
  const currency = app.settings.currency;
  return (
    <button
      type="button"
      className="card row-between"
      style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
      onClick={() => navigate('/bets')}
      aria-label="Sports betting results"
    >
      <div>
        <div className="overline">Sports ›</div>
        <div className="muted small" style={{ marginTop: 2 }}>
          {recordLabel(stats)} record
        </div>
      </div>
      <span className={`money stat-value ${profitClass(stats.netProfit)}`}>
        {signedMoney(stats.netProfit, currency)}
      </span>
    </button>
  );
}

function SportsTrendsView({ stats }: { stats: BetStats }) {
  return (
    <>
      <SportsMonthlyCard stats={stats} />
      <ClvCard stats={stats} />
    </>
  );
}

function SportsBreakdownsView({ stats, currency }: { stats: BetStats; currency: string }) {
  return <SportsBreakdownCards stats={stats} currency={currency} />;
}

function TrendsView({
  stats,
  currency,
  sessions,
  bankroll,
}: {
  stats: Statistics;
  currency: string;
  sessions: Session[];
  bankroll: number;
}) {
  return (
    <>
      <BankrollHealth bankroll={bankroll} sessions={sessions} currency={currency} />

      <SectionCard title="Profit by month">
        <BarChart
          ariaLabel="Monthly profit"
          entries={stats.byMonth.slice(-12).map((m) => ({ label: m.label, value: m.profit }))}
          topLabel={
            stats.byMonth.length
              ? compactMoney(Math.max(...stats.byMonth.slice(-12).map((m) => Math.abs(m.profit))), currency)
              : undefined
          }
        />
      </SectionCard>

      <SectionCard title="Profit by hour of day">
        <p className="muted" style={{ margin: 0 }}>
          When your sessions start vs. how they end up.
        </p>
        <BarChart
          ariaLabel="Profit by hour of day"
          height={130}
          entries={stats.hourlyProfit.map((profit, hour) => ({ label: hourLabel(hour), value: profit }))}
          emptyMessage="Log sessions to see your best playing hours."
        />
      </SectionCard>

      <SectionCard title={stats.tableCount > 0 ? 'Poker vs table games' : 'Cash vs tournaments'}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="overline">Cash games</div>
            <div className={`value money stat-value ${profitClass(stats.cashProfit)}`}>
              {signedMoney(stats.cashProfit, currency)}
            </div>
            <div className="muted small">{stats.cashCount} sessions</div>
          </div>
          <div className="grow">
            <div className="overline">Tournaments</div>
            <div className={`value money stat-value ${profitClass(stats.tournamentProfit)}`}>
              {signedMoney(stats.tournamentProfit, currency)}
            </div>
            <div className="muted small">
              {stats.tournamentCount} played • {percent(itmRate(stats))} ITM
            </div>
          </div>
          {stats.tableCount > 0 && (
            <div className="grow">
              <div className="overline">Table games</div>
              <div className={`value money stat-value ${profitClass(stats.tableProfit)}`}>
                {signedMoney(stats.tableProfit, currency)}
              </div>
              <div className="muted small">{stats.tableCount} sessions</div>
            </div>
          )}
        </div>
      </SectionCard>
    </>
  );
}

function BreakdownsView({ stats, currency }: { stats: Statistics; currency: string }) {
  return (
    <>
      <SectionCard title="By venue">
        <BreakdownList groups={stats.byLocation} currency={currency} />
      </SectionCard>
      <SectionCard title="By game type">
        <BreakdownList groups={stats.byGameType} currency={currency} />
      </SectionCard>
      <SectionCard title="By stakes (cash)">
        <BreakdownList
          groups={stats.byStakes}
          currency={currency}
          emptyMessage="No cash sessions with stakes yet."
        />
      </SectionCard>
      <SectionCard title="Live vs online">
        <BreakdownList groups={stats.byLiveOnline} currency={currency} />
      </SectionCard>
      <SectionCard title="By session type">
        <BreakdownList groups={stats.bySessionType} currency={currency} />
      </SectionCard>
      <SectionCard title="By day of week">
        <BreakdownList groups={stats.byWeekday} currency={currency} />
      </SectionCard>

      {(stats.byFocus.length > 0 ||
        stats.byGameQuality.length > 0 ||
        stats.bySessionLength.length > 0) && (
        <SectionCard title="Session quality analytics">
          {stats.byFocus.length > 0 && (
            <>
              <div className="overline">By focus rating</div>
              <BreakdownList groups={stats.byFocus} currency={currency} />
            </>
          )}
          {stats.byGameQuality.length > 0 && (
            <>
              <div className="overline" style={{ marginTop: 10 }}>By game quality</div>
              <BreakdownList groups={stats.byGameQuality} currency={currency} />
            </>
          )}
          {stats.bySessionLength.length > 0 && (
            <>
              <div className="overline" style={{ marginTop: 10 }}>By session length</div>
              <BreakdownList groups={stats.bySessionLength} currency={currency} />
            </>
          )}
          {stats.byRebuys.length > 1 && (
            <>
              <div className="overline" style={{ marginTop: 10 }}>Single bullet vs rebuys</div>
              <BreakdownList groups={stats.byRebuys} currency={currency} />
            </>
          )}
        </SectionCard>
      )}
    </>
  );
}

/** Buy-in count at the most-played cash stakes + BRM guidance
 *  (assumes a 100bb buy-in; 40+ healthy, 20–40 adequate, <20 at risk). */
function BankrollHealth({
  bankroll,
  sessions,
  currency,
}: {
  bankroll: number;
  sessions: Session[];
  currency: string;
}) {
  const cash = sessions.filter((s) => s.sessionType === 'CASH' && s.bigBlind > 0);
  if (cash.length === 0 || bankroll <= 0) return null;

  const byBB = new Map<number, Session[]>();
  for (const s of cash) {
    const list = byBB.get(s.bigBlind);
    if (list) list.push(s);
    else byBB.set(s.bigBlind, [s]);
  }
  const top = [...byBB.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const buyIn = top[0] * 100;
  const buyIns = bankroll / buyIn;
  const label = stakesLabel(top[1][0]);

  const [verdict, advice, cls] =
    buyIns >= 40
      ? ['Healthy', "You're comfortably rolled — you could consider taking shots at higher stakes.", 'pos']
      : buyIns >= 20
        ? ['Adequate', 'A standard roll for these stakes. Keep logging sessions.', '']
        : ['At risk', 'Under 20 buy-ins is thin for these stakes — consider moving down until the roll rebuilds.', 'neg'];

  return (
    <section className="card">
      <div className="overline">Bankroll health — {label}</div>
      <div className={`money stat-value ${cls}`}>
        {Math.round(buyIns)} buy-ins • {verdict}
      </div>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        {advice} (Assumes a {money(buyIn, currency)} / 100bb buy-in at your most-played stakes.)
      </p>
    </section>
  );
}

function VarianceCard({ stats, currency }: { stats: Statistics; currency: string }) {
  const streakLabel =
    stats.currentStreak > 0 ? `${stats.currentStreak} wins`
    : stats.currentStreak < 0 ? `${-stats.currentStreak} losses`
    : '—';
  return (
    <SectionCard title="Variance & records">
      <StatTileGrid
        tiles={[
          { label: 'Biggest win', value: signedMoney(stats.biggestWin, currency), className: profitClass(stats.biggestWin) },
          { label: 'Biggest loss', value: signedMoney(stats.biggestLoss, currency), className: profitClass(stats.biggestLoss) },
          { label: 'Streak', value: streakLabel, className: profitClass(stats.currentStreak) },
          { label: 'Best run', value: stats.bestWinStreak > 0 ? `${stats.bestWinStreak} wins` : '—' },
          { label: 'Std dev / session', value: money(stats.stdDevPerSession, currency) },
          {
            label: 'Max downswing',
            value: stats.maxDrawdown > 0 ? `-${money(stats.maxDrawdown, currency)}` : '—',
            className: stats.maxDrawdown > 0 ? 'neg' : '',
          },
        ]}
      />
      {stats.profitBuckets.length > 0 && (
        <>
          <div className="overline" style={{ marginTop: 8 }}>Session results distribution</div>
          <BarChart
            ariaLabel="Distribution of session results"
            height={100}
            emptyMessage=""
            entries={stats.profitBuckets.map((b) => ({
              label: compactMoney(isLossSide(b) ? b.lo : b.hi, currency),
              value: b.count,
              color: isLossSide(b) ? 'var(--loss)' : 'var(--profit)',
            }))}
          />
          <p className="muted small" style={{ margin: 0 }}>
            Bar height = number of sessions ending in that range.
          </p>
        </>
      )}
    </SectionCard>
  );
}
