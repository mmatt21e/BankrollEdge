// Port of Android StatsScreen: range chips, stat tiles, bankroll health,
// monthly + hourly charts, variance card with histogram, breakdowns.
import { useAppState } from '../hooks/useAppState';
import { DATE_RANGE_LABELS, DateRange } from '../domain/filter';
import {
  Statistics,
  hourlyRate,
  avgProfit,
  roi,
  winRate,
  itmRate,
  isLossSide,
} from '../domain/stats';
import {
  money,
  signedMoney,
  perHour,
  percent,
  compactMoney,
  hourLabel,
} from '../domain/format';
import { Session, stakesLabel } from '../models/types';
import { BarChart } from '../components/charts';
import { StatTileGrid, BreakdownList, SectionCard, profitClass } from '../components/common';

export default function StatsPage() {
  const app = useAppState();
  const stats = app.filteredStats;
  const currency = app.settings.currency;
  const { filter } = app;

  const streakLabel =
    stats.currentStreak > 0 ? `${stats.currentStreak} wins`
    : stats.currentStreak < 0 ? `${-stats.currentStreak} losses`
    : '—';

  return (
    <main className="page">
      <h1>Statistics</h1>

      <div className="chips" role="group" aria-label="Date range">
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

      <StatTileGrid
        tiles={[
          { label: 'Profit', value: signedMoney(stats.totalProfit, currency), className: profitClass(stats.totalProfit) },
          { label: 'Per hour', value: perHour(hourlyRate(stats), currency), className: profitClass(hourlyRate(stats)) },
          { label: 'ROI', value: percent(roi(stats)), className: profitClass(roi(stats)) },
          { label: 'Win rate', value: percent(winRate(stats)) },
          { label: 'Avg / session', value: signedMoney(avgProfit(stats), currency), className: profitClass(avgProfit(stats)) },
          { label: 'Hours', value: stats.totalHours.toFixed(1) },
          { label: 'Biggest win', value: signedMoney(stats.biggestWin, currency), className: profitClass(stats.biggestWin) },
          { label: 'Biggest loss', value: signedMoney(stats.biggestLoss, currency), className: profitClass(stats.biggestLoss) },
          { label: 'Streak', value: streakLabel, className: profitClass(stats.currentStreak) },
          { label: 'Best streak', value: stats.bestWinStreak > 0 ? `${stats.bestWinStreak} wins` : '—' },
        ]}
      />

      <BankrollHealth bankroll={app.bankroll} sessions={app.sessions} currency={currency} />

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

      <VarianceCard stats={stats} currency={currency} />

      <SectionCard title="Cash vs tournaments">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="overline">Cash games</div>
            <div className={`value money ${profitClass(stats.cashProfit)}`} style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              {signedMoney(stats.cashProfit, currency)}
            </div>
            <div className="muted small">{stats.cashCount} sessions</div>
          </div>
          <div className="grow">
            <div className="overline">Tournaments</div>
            <div className={`value money ${profitClass(stats.tournamentProfit)}`} style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              {signedMoney(stats.tournamentProfit, currency)}
            </div>
            <div className="muted small">
              {stats.tournamentCount} played • {percent(itmRate(stats))} ITM
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Live vs online">
        <BreakdownList groups={stats.byLiveOnline} currency={currency} />
      </SectionCard>
      <SectionCard title="By session type">
        <BreakdownList groups={stats.bySessionType} currency={currency} />
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

      <SectionCard title="By game type">
        <BreakdownList groups={stats.byGameType} currency={currency} />
      </SectionCard>
      <SectionCard title="By venue">
        <BreakdownList groups={stats.byLocation} currency={currency} />
      </SectionCard>
      <SectionCard title="By stakes (cash)">
        <BreakdownList
          groups={stats.byStakes}
          currency={currency}
          emptyMessage="No cash sessions with stakes yet."
        />
      </SectionCard>
      <SectionCard title="By day of week">
        <BreakdownList groups={stats.byWeekday} currency={currency} />
      </SectionCard>
    </main>
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
      <div className={`money ${cls}`} style={{ fontSize: '1.2rem', fontWeight: 700 }}>
        {Math.round(buyIns)} buy-ins • {verdict}
      </div>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        {advice} (Assumes a {money(buyIn, currency)} / 100bb buy-in at your most-played stakes.)
      </p>
    </section>
  );
}

function VarianceCard({ stats, currency }: { stats: Statistics; currency: string }) {
  return (
    <SectionCard title="Variance">
      <StatTileGrid
        tiles={[
          { label: 'Std dev / session', value: money(stats.stdDevPerSession, currency) },
          {
            label: 'Max downswing',
            value: stats.maxDrawdown > 0 ? `-${money(stats.maxDrawdown, currency)}` : '—',
            className: stats.maxDrawdown > 0 ? 'neg' : '',
          },
          { label: 'Worst skid', value: stats.worstLossStreak > 0 ? `${stats.worstLossStreak} losses` : '—' },
          { label: 'Best run', value: stats.bestWinStreak > 0 ? `${stats.bestWinStreak} wins` : '—' },
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
