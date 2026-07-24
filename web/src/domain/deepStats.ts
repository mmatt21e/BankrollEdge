// Deep statistics beyond the shared dashboard aggregates: big-blind and
// per-100-hands cash metrics, bullet-based tournament metrics, and the
// grouping behind the "Statistics by …" drill-down pages.
import {
  Session,
  isTableSession,
  isTournamentStyle,
  profit,
  totalInvested,
  gameTypeLabel,
  tableGameLabel,
} from '../models/types';
import { DAY_NAMES, mondayIndex, monthLabel, monthSortKey, round2 } from './aggregate';
import { GroupStat } from './stats';
import { sessionStakesLabel } from './filter';

/** Bullets a tournament-style session fired (first entry + re-entries). */
export const bullets = (s: Session): number => 1 + Math.max(0, s.reentries);

export interface CashDeepStats {
  sessions: number;
  hours: number;
  hands: number;
  totalProfit: number;
  totalBuyins: number;
  totalCashouts: number;
  profitPerHour: number;
  avgProfitPerSession: number;
  /** Share of sessions that ended positive. */
  profitableRatio: number;
  /** Winnings expressed in big blinds (sessions with blinds recorded). */
  bbWon: number;
  bbPerHour: number;
  bbPer100: number;
  bbPerSession: number;
  profitPer100: number;
  /** Std dev of per-session $/hour across timed sessions. */
  stdDevPerHour: number;
}

export function computeCashDeep(all: Session[]): CashDeepStats {
  const cash = all.filter((s) => s.sessionType === 'CASH');
  const hours = cash.reduce((a, s) => a + s.durationMinutes, 0) / 60;
  const totalProfit = cash.reduce((a, s) => a + profit(s), 0);
  const timed = cash.filter((s) => s.durationMinutes > 0);
  const timedHours = timed.reduce((a, s) => a + s.durationMinutes, 0) / 60;
  const timedProfit = timed.reduce((a, s) => a + profit(s), 0);

  // BB metrics only use sessions where the big blind is known.
  const withBb = cash.filter((s) => s.bigBlind > 0);
  const bbWon = withBb.reduce((a, s) => a + profit(s) / s.bigBlind, 0);
  const bbTimed = withBb.filter((s) => s.durationMinutes > 0);
  const bbTimedHours = bbTimed.reduce((a, s) => a + s.durationMinutes, 0) / 60;
  const bbTimedWon = bbTimed.reduce((a, s) => a + profit(s) / s.bigBlind, 0);
  const bbHands = withBb.reduce((a, s) => a + s.handsPlayed, 0);
  const bbHandsWon = withBb
    .filter((s) => s.handsPlayed > 0)
    .reduce((a, s) => a + profit(s) / s.bigBlind, 0);

  const hands = cash.reduce((a, s) => a + s.handsPlayed, 0);
  const handsProfit = cash.filter((s) => s.handsPlayed > 0).reduce((a, s) => a + profit(s), 0);

  // Spread of per-session hourly results (population std dev).
  const rates = timed.map((s) => profit(s) / (s.durationMinutes / 60));
  const meanRate = rates.length > 0 ? rates.reduce((a, r) => a + r, 0) / rates.length : 0;
  const variance =
    rates.length > 0
      ? rates.reduce((a, r) => a + (r - meanRate) ** 2, 0) / rates.length
      : 0;

  return {
    sessions: cash.length,
    hours: round2(hours),
    hands,
    totalProfit: round2(totalProfit),
    totalBuyins: round2(cash.reduce((a, s) => a + totalInvested(s), 0)),
    totalCashouts: round2(cash.reduce((a, s) => a + s.cashOut, 0)),
    profitPerHour: timedHours > 0 ? round2(timedProfit / timedHours) : 0,
    avgProfitPerSession: cash.length > 0 ? round2(totalProfit / cash.length) : 0,
    profitableRatio: cash.length > 0 ? cash.filter((s) => profit(s) > 0).length / cash.length : 0,
    bbWon: round2(bbWon),
    bbPerHour: bbTimedHours > 0 ? round2(bbTimedWon / bbTimedHours) : 0,
    bbPer100: bbHands > 0 ? round2(bbHandsWon / (bbHands / 100)) : 0,
    bbPerSession: withBb.length > 0 ? round2(bbWon / withBb.length) : 0,
    profitPer100: hands > 0 ? round2(handsProfit / (hands / 100)) : 0,
    stdDevPerHour: round2(Math.sqrt(variance)),
  };
}

export interface TournamentDeepStats {
  tournaments: number;
  bullets: number;
  hours: number;
  totalProfit: number;
  totalBuyins: number;
  totalCashouts: number;
  /** Share of tournaments with a recorded in-the-money finish. */
  itmRatio: number;
  /** Total profit over total invested. */
  totalRoi: number;
  /** Unweighted mean of each tournament's own ROI. */
  avgRoi: number;
  avgProfitPerBullet: number;
  avgBuyinPerBullet: number;
}

export function computeTournamentDeep(all: Session[]): TournamentDeepStats {
  const t = all.filter(isTournamentStyle);
  const totalProfit = t.reduce((a, s) => a + profit(s), 0);
  const invested = t.reduce((a, s) => a + totalInvested(s), 0);
  const totalBullets = t.reduce((a, s) => a + bullets(s), 0);
  const withStake = t.filter((s) => totalInvested(s) > 0);
  const roiSum = withStake.reduce((a, s) => a + profit(s) / totalInvested(s), 0);
  // ITM = cashed for money (or a recorded finish inside the paid places).
  const itm = t.filter((s) => s.cashOut > 0 || (s.position > 0 && s.position <= Math.ceil(s.fieldSize * 0.15) && s.fieldSize > 0));
  return {
    tournaments: t.length,
    bullets: totalBullets,
    hours: round2(t.reduce((a, s) => a + s.durationMinutes, 0) / 60),
    totalProfit: round2(totalProfit),
    totalBuyins: round2(invested),
    totalCashouts: round2(t.reduce((a, s) => a + s.cashOut, 0)),
    itmRatio: t.length > 0 ? itm.length / t.length : 0,
    totalRoi: invested > 0 ? totalProfit / invested : 0,
    avgRoi: withStake.length > 0 ? roiSum / withStake.length : 0,
    avgProfitPerBullet: totalBullets > 0 ? round2(totalProfit / totalBullets) : 0,
    avgBuyinPerBullet: totalBullets > 0 ? round2(invested / totalBullets) : 0,
  };
}

// --- "Statistics by …" groupings -------------------------------------------

export type BreakdownDim = 'week' | 'month' | 'game' | 'stake' | 'buyin' | 'venue' | 'weekday';

export const BREAKDOWN_DIMS: { key: BreakdownDim; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'game', label: 'Game' },
  { key: 'stake', label: 'Stake' },
  { key: 'buyin', label: 'Buy-in' },
  { key: 'venue', label: 'Venue' },
  { key: 'weekday', label: 'Weekday' },
];

/** ISO-8601 week number (what tournament series and Pokerbase use). */
export function isoWeek(time: number): { year: number; week: number } {
  const d = new Date(time);
  // Thursday of the current week decides the ISO year.
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d) + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const week = 1 + Math.round(((thursday.getTime() - jan1.getTime()) / 86_400_000 - 3 + mondayIndex(jan1)) / 7);
  return { year: thursday.getFullYear(), week };
}

interface Keyed {
  key: string;
  sortKey: number;
}

function dimKey(dim: BreakdownDim, s: Session): Keyed {
  const d = new Date(s.startTime);
  switch (dim) {
    case 'week': {
      const { year, week } = isoWeek(s.startTime);
      return { key: `Wk ${week} '${String(year % 100).padStart(2, '0')}`, sortKey: year * 100 + week };
    }
    case 'month':
      return { key: monthLabel(d), sortKey: monthSortKey(d) };
    case 'game':
      return {
        key: isTableSession(s) ? tableGameLabel(s.tableGame) : gameTypeLabel(s.gameType),
        sortKey: 0,
      };
    case 'stake': {
      const label = sessionStakesLabel(s);
      return { key: label || 'No stakes', sortKey: 0 };
    }
    case 'buyin':
      return { key: s.buyIn > 0 ? String(s.buyIn) : 'Unknown', sortKey: s.buyIn };
    case 'venue':
      return { key: s.location || 'No venue', sortKey: 0 };
    case 'weekday': {
      const day = mondayIndex(d);
      return { key: DAY_NAMES[day], sortKey: day };
    }
  }
}

/** Group sessions along a dimension. Time-like dims sort chronologically;
 *  the rest sort by profit (best first). */
export function breakdownBy(dim: BreakdownDim, sessions: Session[]): GroupStat[] {
  const map = new Map<string, { sortKey: number; items: Session[] }>();
  for (const s of sessions) {
    const { key, sortKey } = dimKey(dim, s);
    const entry = map.get(key);
    if (entry) entry.items.push(s);
    else map.set(key, { sortKey, items: [s] });
  }
  const groups = [...map.entries()].map(([key, { sortKey, items }]) => ({
    key,
    sortKey,
    sessionCount: items.length,
    profit: round2(items.reduce((a, s) => a + profit(s), 0)),
    hours: round2(items.reduce((a, s) => a + s.durationMinutes, 0) / 60),
  }));
  const timeLike = dim === 'week' || dim === 'month' || dim === 'weekday' || dim === 'buyin';
  groups.sort((a, b) => (timeLike ? a.sortKey - b.sortKey : b.profit - a.profit));
  return groups.map(({ sortKey: _s, ...g }) => g);
}
