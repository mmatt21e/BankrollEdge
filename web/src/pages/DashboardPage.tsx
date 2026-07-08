// Play screen, portfolio-style: hero bankroll number, profit chart with a
// timeframe selector, three headline tiles, then recent activity. Depth
// (full stats, breakdowns) lives on the Dashboard tab — not here.
// With poker and table games both disabled the screen goes sports-only:
// no live-session timer, bet chart/tiles, and the + button adds a bet.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useNow } from '../hooks/useAppState';
import { ProfitPoint, hourlyRate, winRate } from '../domain/stats';
import { betProfit, betRoi, isSettled, recordLabel, toWin } from '../domain/bets';
import {
  money,
  signedMoney,
  perHour,
  percent,
  elapsedClock,
  formatDate,
  formatDateTime,
} from '../domain/format';
import { computeInsights } from '../domain/insights';
import { SportsBet } from '../models/types';
import { CumulativeProfitChart } from '../components/charts';
import { StatTileGrid, SessionRow, profitClass } from '../components/common';

export default function DashboardPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const stats = app.allStats;
  const { settings } = app;
  const currency = settings.currency;
  const canSession = settings.showPoker || settings.showTableGames;
  // Bets count toward the headline delta only when they share the bankroll.
  const includeBets = settings.showSports && !settings.separateBankrolls;
  const allTime =
    (canSession ? stats.totalProfit : 0) + (includeBets ? app.betStats.netProfit : 0);
  const showSportsRoll = settings.showSports && settings.separateBankrolls && canSession;

  return (
    <main className="page">
      <button
        type="button"
        onClick={() => navigate('/bankroll')}
        style={{ all: 'unset', cursor: 'pointer' }}
        aria-label="Manage bankroll"
      >
        <div className="overline" style={{ color: 'var(--gold-500)' }}>
          {showSportsRoll ? 'Poker bankroll ›' : 'Current bankroll ›'}
        </div>
        <h1 className="money" style={{ fontSize: '2.4rem' }}>
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
            <span className="overline" style={{ color: 'var(--gold-500)' }}>Sports bankroll</span>{' '}
            <span className="money" style={{ fontWeight: 700 }}>
              {money(app.sportsBankroll, currency)}
            </span>
          </div>
        )}
      </button>

      {canSession && <TimerCard />}

      {settings.showSports && <OpenBetsCard />}

      <ProfitChartCard
        points={canSession ? stats.cumulative : app.betStats.cumulative}
        emptyMessage={
          canSession
            ? 'Log at least two sessions to see your profit graph.'
            : 'Settle at least two bets to see your profit graph.'
        }
      />

      {canSession ? (
        <StatTileGrid
          tiles={[
            { label: 'Per hour', value: perHour(hourlyRate(stats), currency), className: profitClass(hourlyRate(stats)) },
            { label: 'Win rate', value: percent(winRate(stats)) },
            { label: 'Hours', value: stats.totalHours.toFixed(1) },
          ]}
        />
      ) : (
        <StatTileGrid
          tiles={[
            { label: 'Record (W-L-P)', value: recordLabel(app.betStats) },
            { label: 'ROI', value: percent(betRoi(app.betStats)), className: profitClass(betRoi(app.betStats)) },
            { label: 'At risk', value: money(app.betStats.pendingStake, currency) },
          ]}
        />
      )}

      {canSession && <Insights />}

      {canSession ? (
        app.sessions.length > 0 ? (
          <>
            <div className="row-between">
              <h2>Recent sessions</h2>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/sessions')}>
                See all
              </button>
            </div>
            <div className="col">
              {app.sessions.slice(0, 5).map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </>
        ) : (
          app.ready && (
            <div className="card empty">
              <h2>No sessions yet</h2>
              <p>Tap the + button to log your first poker session and start tracking your bankroll.</p>
            </div>
          )
        )
      ) : app.bets.length > 0 ? (
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
      ) : (
        app.ready && (
          <div className="card empty">
            <h2>No bets yet</h2>
            <p>Tap the + button to log your first sports bet and start tracking your bankroll.</p>
          </div>
        )
      )}
    </main>
  );
}

/** Compact bet row for the sports-only Play screen. */
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

const CHART_RANGES = [
  { key: '1M', label: '1M', months: 1 },
  { key: '3M', label: '3M', months: 3 },
  { key: '6M', label: '6M', months: 6 },
  { key: '1Y', label: '1Y', months: 12 },
  { key: 'ALL', label: 'All', months: 0 },
] as const;
type ChartRange = (typeof CHART_RANGES)[number]['key'];

/** Cumulative profit re-baselined to the selected window (stock-app style). */
function ProfitChartCard({
  points: allPoints,
  emptyMessage,
}: {
  points: ProfitPoint[];
  emptyMessage: string;
}) {
  const app = useAppState();
  const currency = app.settings.currency;
  const [range, setRange] = useState<ChartRange>('ALL');

  const { points, windowProfit } = useMemo(() => {
    const months = CHART_RANGES.find((r) => r.key === range)?.months ?? 0;
    if (months === 0 || allPoints.length === 0) {
      return {
        points: allPoints,
        windowProfit: allPoints.length ? allPoints[allPoints.length - 1].cumulative : 0,
      };
    }
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const from = start.getTime();
    let baseline = 0;
    for (const p of allPoints) {
      if (p.time >= from) break;
      baseline = p.cumulative;
    }
    const windowed = allPoints
      .filter((p) => p.time >= from)
      .map((p) => ({ time: p.time, cumulative: p.cumulative - baseline }));
    return {
      points: windowed,
      windowProfit: windowed.length ? windowed[windowed.length - 1].cumulative : 0,
    };
  }, [allPoints, range]);

  return (
    <section className="card col" style={{ gap: 10 }}>
      <div className="row-between">
        <div>
          <div className="overline">Profit</div>
          <div className={`money ${profitClass(windowProfit)}`} style={{ fontWeight: 700 }}>
            {signedMoney(windowProfit, currency)}
          </div>
        </div>
        <div className="chips" role="group" aria-label="Chart timeframe" style={{ paddingBottom: 0 }}>
          {CHART_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className="chip chip-small"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {points.length >= 2 ? (
        <CumulativeProfitChart points={points} currency={currency} />
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {allPoints.length < 2 ? emptyMessage : 'Not enough results in this timeframe.'}
        </p>
      )}
    </section>
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

function TimerCard() {
  const app = useAppState();
  const navigate = useNavigate();
  const running = app.timerStart > 0;
  const now = useNow(running);

  // Idle: a slim one-line action, not a full card — the screen's space
  // belongs to results, not to a button.
  if (!running) {
    return (
      <button type="button" className="live-start" onClick={app.startTimer}>
        <span aria-hidden="true">▶</span> Start live session
      </button>
    );
  }

  const stopAndLog = () => {
    const start = app.timerStart;
    const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
    app.clearTimer();
    navigate(`/session/new?start=${start}&duration=${minutes}`);
  };

  return (
    <section className="card col" style={{ background: 'var(--primary-container)' }}>
      <div className="overline">Live session</div>
      <div className="money" style={{ fontSize: '2rem', fontWeight: 700 }} role="timer">
        {elapsedClock(now - app.timerStart)}
      </div>
      <div className="muted">Started {formatDateTime(app.timerStart)}</div>
      <div className="row">
        <button type="button" className="btn btn-outline grow" onClick={app.clearTimer}>
          Discard
        </button>
        <button type="button" className="btn grow" onClick={stopAndLog}>
          ■ Stop &amp; log
        </button>
      </div>
    </section>
  );
}
