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
import {
  ActiveSession,
  SportsBet,
  SessionType,
  GameType,
  TableGameType,
  VenueType,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  gameTypeLabel,
  tableGameLabel,
  pokerGameOptions,
  tableGameOptions,
} from '../models/types';
import { CumulativeProfitChart } from '../components/charts';
import { MoneyInput, StatTileGrid, SessionRow, profitClass } from '../components/common';

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
  const [setupOpen, setSetupOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const active = app.activeSession;
  const running = !!active;
  const now = useNow(running);

  // Idle: a slim one-line action, not a full card — the screen's space
  // belongs to results, not to a button. Tapping it captures the session
  // setup up front so the details are recorded from the moment you sit down.
  if (!running || !active) {
    return (
      <>
        <button type="button" className="live-start" onClick={() => setSetupOpen(true)}>
          <span aria-hidden="true">▶</span> Start live session
        </button>
        <StartSessionDialog
          open={setupOpen}
          onCancel={() => setSetupOpen(false)}
          onStart={(setup) => {
            app.startSession(setup);
            setSetupOpen(false);
          }}
        />
      </>
    );
  }

  const isTable = active.sessionType === 'TABLE';
  const isTournament = active.sessionType === 'TOURNAMENT' || active.sessionType === 'SNG';
  const gameLabel = isTable ? tableGameLabel(active.tableGame) : gameTypeLabel(active.gameType);
  const stakes =
    !isTable && !isTournament && (active.smallBlind > 0 || active.bigBlind > 0)
      ? `${money(active.smallBlind, active.currency)}/${money(active.bigBlind, active.currency)}`
      : '';
  const summary = [gameLabel, stakes, active.location].filter(Boolean).join(' · ');
  const bountyTotal = active.bountyPerBounty * active.bountyCount;

  const stopAndLog = () => {
    const minutes = Math.max(0, Math.floor((Date.now() - active.startedAt) / 60000));
    // The draft prefills the editor; it's cleared once the session is saved.
    navigate(`/session/new?live=1&duration=${minutes}`);
  };

  return (
    <section className="card col" style={{ background: 'var(--primary-container)' }}>
      <div className="overline">Live session</div>
      <div className="money" style={{ fontSize: '2rem', fontWeight: 700 }} role="timer">
        {elapsedClock(now - active.startedAt)}
      </div>
      {summary && <div style={{ fontWeight: 600 }}>{summary}</div>}
      <div className="muted">Started {formatDateTime(active.startedAt)}</div>
      {(active.buyIn > 0 || active.rebuys > 0) && (
        <div className="muted">
          Buy-in {money(active.buyIn, active.currency)}
          {active.rebuys > 0 && <> · Rebuys {money(active.rebuys, active.currency)}</>}
          {active.rebuys > 0 && (
            <> · In {money(active.buyIn + active.rebuys, active.currency)}</>
          )}
        </div>
      )}
      {isTournament && (
        <div className="row-between" style={{ alignItems: 'center' }}>
          <span>
            Bounties: <strong>{active.bountyCount}</strong>
            {bountyTotal > 0 && (
              <span className="muted"> · {money(bountyTotal, active.currency)}</span>
            )}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Remove a bounty"
              disabled={active.bountyCount === 0}
              onClick={() => app.adjustBounty(-1)}
            >
              −
            </button>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Add a bounty"
              onClick={() => app.adjustBounty(1)}
            >
              + Bounty
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setRebuyOpen(true)}
      >
        + Add rebuy
      </button>
      <div className="row">
        <button type="button" className="btn btn-outline grow" onClick={app.clearSession}>
          Discard
        </button>
        <button type="button" className="btn grow" onClick={stopAndLog}>
          ■ Stop &amp; log
        </button>
      </div>
      <RebuyDialog
        open={rebuyOpen}
        currency={active.currency}
        onCancel={() => setRebuyOpen(false)}
        onAdd={(amount) => {
          app.addRebuy(amount);
          setRebuyOpen(false);
        }}
      />
    </section>
  );
}

/** Prompts for a rebuy / re-entry amount to add to the running session. */
function RebuyDialog({
  open,
  currency,
  onCancel,
  onAdd,
}: {
  open: boolean;
  currency: string;
  onCancel: () => void;
  onAdd: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  if (!open) return null;
  const value = Number.parseFloat(amount);
  const valid = Number.isFinite(value) && value > 0;
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div role="dialog" aria-modal="true" aria-label="Add rebuy" className="dialog">
        <h2>Add rebuy</h2>
        <p className="muted" style={{ margin: 0 }}>
          Adds to this session's total buy-in. Log the cash-out when you stop.
        </p>
        <label className="field">
          <span>Rebuy amount</span>
          <MoneyInput currency={currency} value={amount} onChange={setAmount} />
        </label>
        <div className="actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!valid} onClick={() => onAdd(value)}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

interface SetupState {
  sessionType: SessionType;
  gameType: GameType;
  tableGame: TableGameType;
  venueType: VenueType;
  location: string;
  smallBlind: string;
  bigBlind: string;
  buyIn: string;
  bountyPerBounty: string;
}

/** Captures the session's setup the moment it starts, so game, venue, stakes
 *  and buy-in are recorded up front rather than reconstructed at stop time. */
function StartSessionDialog({
  open,
  onCancel,
  onStart,
}: {
  open: boolean;
  onCancel: () => void;
  onStart: (setup: Omit<ActiveSession, 'startedAt'>) => void;
}) {
  const app = useAppState();
  const { settings } = app;
  const [form, setForm] = useState<SetupState>(() => ({
    sessionType:
      settings.defaultSessionType !== 'ALL'
        ? settings.defaultSessionType
        : settings.showPoker
          ? 'CASH'
          : 'TABLE',
    gameType: 'NLH',
    tableGame: 'BLACKJACK',
    venueType: 'LIVE',
    location: '',
    smallBlind: '',
    bigBlind: '',
    buyIn: '',
    bountyPerBounty: '',
  }));

  if (!open) return null;

  const set = (patch: Partial<SetupState>) => setForm((prev) => ({ ...prev, ...patch }));
  const num = (v: string) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const isTable = form.sessionType === 'TABLE';
  const isTournament = form.sessionType === 'TOURNAMENT' || form.sessionType === 'SNG';
  const pokerGames = pokerGameOptions(settings, app.recordedPokerGames);
  const tableGames = tableGameOptions(settings, app.recordedTableGames);

  const start = () => {
    onStart({
      sessionType: form.sessionType,
      gameType: form.gameType,
      tableGame: form.tableGame,
      venueType: form.venueType,
      location: form.location.trim(),
      smallBlind: isTable || isTournament ? 0 : num(form.smallBlind),
      bigBlind: isTable || isTournament ? 0 : num(form.bigBlind),
      buyIn: num(form.buyIn),
      rebuys: 0,
      bountyPerBounty: isTournament ? num(form.bountyPerBounty) : 0,
      bountyCount: 0,
      currency: settings.currency,
    });
  };

  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div role="dialog" aria-modal="true" aria-label="Start live session" className="dialog">
        <h2>Start live session</h2>

        <label className="field">
          <span>Session type</span>
          <select
            value={form.sessionType}
            onChange={(e) => set({ sessionType: e.target.value as SessionType })}
          >
            {SESSION_TYPES.filter(
              (t) =>
                t === form.sessionType ||
                (t === 'TABLE' ? settings.showTableGames : settings.showPoker),
            ).map((t) => (
              <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>

        <div className="segmented" role="group" aria-label="Live or online">
          {(['LIVE', 'ONLINE'] as VenueType[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={form.venueType === v}
              onClick={() => set({ venueType: v })}
            >
              {v === 'LIVE' ? 'Live' : 'Online'}
            </button>
          ))}
        </div>

        {isTable ? (
          <label className="field">
            <span>Table game</span>
            <select
              value={form.tableGame}
              onChange={(e) => set({ tableGame: e.target.value as TableGameType })}
            >
              {tableGames.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Game</span>
            <select
              value={form.gameType}
              onChange={(e) => set({ gameType: e.target.value as GameType })}
            >
              {pokerGames.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Venue / location</span>
          <input
            type="text"
            list="live-venue-options"
            value={form.location}
            placeholder="e.g. Bellagio"
            onChange={(e) => set({ location: e.target.value })}
          />
          <datalist id="live-venue-options">
            {app.availableLocations.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </label>

        {!isTable && !isTournament && (
          <div className="row">
            <label className="field grow">
              <span>Small blind</span>
              <MoneyInput
                currency={settings.currency}
                value={form.smallBlind}
                onChange={(v) => set({ smallBlind: v })}
              />
            </label>
            <label className="field grow">
              <span>Big blind</span>
              <MoneyInput
                currency={settings.currency}
                value={form.bigBlind}
                onChange={(v) => set({ bigBlind: v })}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>Buy-in</span>
          <MoneyInput
            currency={settings.currency}
            value={form.buyIn}
            onChange={(v) => set({ buyIn: v })}
          />
        </label>

        {isTournament && (
          <label className="field">
            <span>Bounty per knockout (optional)</span>
            <MoneyInput
              currency={settings.currency}
              value={form.bountyPerBounty}
              onChange={(v) => set({ bountyPerBounty: v })}
            />
          </label>
        )}

        <div className="actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={start}>
            ▶ Start
          </button>
        </div>
      </div>
    </div>
  );
}
