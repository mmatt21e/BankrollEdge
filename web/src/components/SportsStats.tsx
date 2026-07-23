// Shared sports-betting stat cards, used by both the Dashboard's sports mode
// (StatsPage) and the Sports tab's Stats view (BetsPage) — one source so the
// two screens can't drift apart.
import { BetStats } from '../domain/bets';
import { BarChart } from './charts';
import { BreakdownList, SectionCard, profitClass } from './common';

export function SportsMonthlyCard({ stats }: { stats: BetStats }) {
  return (
    <SectionCard title="Profit by month">
      <BarChart
        ariaLabel="Monthly betting profit"
        entries={stats.byMonth.slice(-12).map((m) => ({ label: m.label, value: m.profit }))}
        emptyMessage="Settle bets to see monthly results."
      />
    </SectionCard>
  );
}

/** Average closing-line value; renders nothing until closing odds exist. */
export function ClvCard({ stats }: { stats: BetStats }) {
  if (stats.clvCount === 0) return null;
  return (
    <SectionCard title="Closing line value">
      <div className={`money stat-value ${profitClass(stats.avgClv)}`}>
        {stats.avgClv >= 0 ? '+' : ''}
        {stats.avgClv.toFixed(2)}%
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Average CLV across {stats.clvCount} bet{stats.clvCount === 1 ? '' : 's'} with closing
        odds recorded. Consistently beating the close is the strongest long-term edge signal.
      </p>
    </SectionCard>
  );
}

/** The six per-dimension breakdown cards (sport, type, odds, book, weekday, tag). */
export function SportsBreakdownCards({ stats, currency }: { stats: BetStats; currency: string }) {
  return (
    <>
      <SectionCard title="By sport">
        <BreakdownList groups={stats.bySport} currency={currency} countNoun="bets" showRate={false} />
      </SectionCard>
      <SectionCard title="By bet type">
        <BreakdownList groups={stats.byType} currency={currency} countNoun="bets" showRate={false} />
      </SectionCard>
      <SectionCard title="By odds range">
        <BreakdownList groups={stats.byOddsBand} currency={currency} countNoun="bets" showRate={false} />
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
