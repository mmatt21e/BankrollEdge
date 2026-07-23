// Port of Android StatsCalculator (domain/Statistics.kt). Behavior must match
// the Kotlin implementation — the Vitest suite mirrors the Android JUnit tests.
import { DAY_NAMES, mondayIndex, monthLabel, monthSortKey } from './aggregate';
import {
  Session,
  profit,
  totalInvested,
  stakesLabel,
  cashed,
  isTournamentStyle,
  isTableSession,
  gameTypeLabel,
  tableGameLabel,
  SESSION_TYPE_LABELS,
  VENUE_TYPE_LABELS,
  GAME_QUALITY_LABELS,
} from '../models/types';

export interface ProfitPoint {
  time: number;
  cumulative: number;
}

export interface GroupStat {
  key: string;
  sessionCount: number;
  profit: number;
  hours: number;
}

export const groupHourlyRate = (g: GroupStat): number =>
  g.hours > 0 ? g.profit / g.hours : 0;

export interface MonthlyProfit {
  label: string;
  profit: number;
  sessionCount: number;
  sortKey: number;
}

/** Sessions ending with a result in [lo, hi). Loss buckets have hi <= 0. */
export interface ProfitBucket {
  lo: number;
  hi: number;
  count: number;
}

export const isLossSide = (b: ProfitBucket): boolean => b.hi <= 0;

export interface Statistics {
  sessionCount: number;
  totalProfit: number;
  totalInvested: number;
  totalHours: number;
  winningSessions: number;
  biggestWin: number;
  biggestLoss: number;
  cashCount: number;
  cashProfit: number;
  tournamentCount: number;
  tournamentProfit: number;
  tournamentsCashed: number;
  tableCount: number;
  tableProfit: number;
  /** Profit from sessions WITH a logged duration — keeps untimed sessions
   *  from inflating the hourly rate. */
  timedProfit: number;
  /** + = consecutive wins ending at latest session, − = consecutive losses. */
  currentStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  stdDevPerSession: number;
  /** Deepest peak-to-trough fall of the cumulative curve (positive number). */
  maxDrawdown: number;
  /** Profit by hour of day the session started (index 0–23). */
  hourlyProfit: number[];
  profitBuckets: ProfitBucket[];
  cumulative: ProfitPoint[];
  byGameType: GroupStat[];
  byLocation: GroupStat[];
  byStakes: GroupStat[];
  byMonth: MonthlyProfit[];
  byWeekday: GroupStat[];
  bySessionType: GroupStat[];
  byLiveOnline: GroupStat[];
  /** Quality analytics — only sessions that recorded the field. */
  byFocus: GroupStat[];
  byGameQuality: GroupStat[];
  bySessionLength: GroupStat[];
  byRebuys: GroupStat[];
}

export const hourlyRate = (s: Statistics): number =>
  s.totalHours > 0 ? s.timedProfit / s.totalHours : 0;
export const avgProfit = (s: Statistics): number =>
  s.sessionCount > 0 ? s.totalProfit / s.sessionCount : 0;
export const roi = (s: Statistics): number =>
  s.totalInvested > 0 ? s.totalProfit / s.totalInvested : 0;
export const winRate = (s: Statistics): number =>
  s.sessionCount > 0 ? s.winningSessions / s.sessionCount : 0;
export const itmRate = (s: Statistics): number =>
  s.tournamentCount > 0 ? s.tournamentsCashed / s.tournamentCount : 0;

/** Bankroll = starting balance + session profits + net deposits/withdrawals. */
export const bankrollOf = (
  s: Statistics,
  startingBankroll: number,
  transactionsNet = 0,
): number => startingBankroll + s.totalProfit + transactionsNet;

const EMPTY: Statistics = {
  sessionCount: 0,
  totalProfit: 0,
  totalInvested: 0,
  totalHours: 0,
  winningSessions: 0,
  biggestWin: 0,
  biggestLoss: 0,
  cashCount: 0,
  cashProfit: 0,
  tournamentCount: 0,
  tournamentProfit: 0,
  tournamentsCashed: 0,
  tableCount: 0,
  tableProfit: 0,
  timedProfit: 0,
  currentStreak: 0,
  bestWinStreak: 0,
  worstLossStreak: 0,
  stdDevPerSession: 0,
  maxDrawdown: 0,
  hourlyProfit: new Array(24).fill(0),
  profitBuckets: [],
  cumulative: [],
  byGameType: [],
  byLocation: [],
  byStakes: [],
  byMonth: [],
  byWeekday: [],
  bySessionType: [],
  byLiveOnline: [],
  byFocus: [],
  byGameQuality: [],
  bySessionLength: [],
  byRebuys: [],
};


export function computeStats(sessions: Session[]): Statistics {
  if (sessions.length === 0) return { ...EMPTY, hourlyProfit: new Array(24).fill(0) };

  let totalProfit = 0;
  let invested = 0;
  let totalMinutes = 0;
  let timedProfit = 0;
  let winning = 0;
  let biggestWin = -Infinity;
  let biggestLoss = Infinity;
  let cashCount = 0;
  let cashProfit = 0;
  let tournamentCount = 0;
  let tournamentProfit = 0;
  let tournamentsCashed = 0;
  let tableCount = 0;
  let tableProfit = 0;
  const hourly = new Array<number>(24).fill(0);

  for (const s of sessions) {
    const p = profit(s);
    totalProfit += p;
    invested += totalInvested(s);
    totalMinutes += s.durationMinutes;
    if (s.durationMinutes > 0) timedProfit += p;
    if (p > 0) winning++;
    if (p > biggestWin) biggestWin = p;
    if (p < biggestLoss) biggestLoss = p;
    if (isTournamentStyle(s)) {
      tournamentCount++;
      tournamentProfit += p;
      if (cashed(s)) tournamentsCashed++;
    } else if (isTableSession(s)) {
      tableCount++;
      tableProfit += p;
    } else {
      cashCount++;
      cashProfit += p;
    }
    hourly[new Date(s.startTime).getHours()] += p;
  }

  const chronological = [...sessions].sort((a, b) => a.startTime - b.startTime);
  let running = 0;
  const cumulative: ProfitPoint[] = chronological.map((s) => {
    running += profit(s);
    return { time: s.startTime, cumulative: running };
  });

  // Win/loss streaks (break-even ends a streak).
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  let runStreak = 0;
  for (const s of chronological) {
    const p = profit(s);
    runStreak = p > 0 ? (runStreak > 0 ? runStreak + 1 : 1)
      : p < 0 ? (runStreak < 0 ? runStreak - 1 : -1)
      : 0;
    if (runStreak > bestWinStreak) bestWinStreak = runStreak;
    if (-runStreak > worstLossStreak) worstLossStreak = -runStreak;
  }

  const mean = totalProfit / sessions.length;
  const stdDev =
    sessions.length >= 2
      ? Math.sqrt(
          sessions.reduce((acc, s) => acc + (profit(s) - mean) ** 2, 0) / sessions.length,
        )
      : 0;

  // Deepest fall from any peak of the cumulative curve (starts at 0).
  let peak = 0;
  let maxDrawdown = 0;
  for (const p of cumulative) {
    if (p.cumulative > peak) peak = p.cumulative;
    const dd = peak - p.cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    sessionCount: sessions.length,
    totalProfit,
    totalInvested: invested,
    totalHours: totalMinutes / 60,
    winningSessions: winning,
    biggestWin: biggestWin === -Infinity ? 0 : biggestWin,
    biggestLoss: biggestLoss === Infinity ? 0 : biggestLoss,
    cashCount,
    cashProfit,
    tournamentCount,
    tournamentProfit,
    tournamentsCashed,
    tableCount,
    tableProfit,
    timedProfit,
    currentStreak: runStreak,
    bestWinStreak,
    worstLossStreak,
    stdDevPerSession: stdDev,
    maxDrawdown,
    hourlyProfit: hourly,
    profitBuckets: profitBuckets(sessions),
    cumulative,
    byGameType: groupBy(sessions, (s) =>
      isTableSession(s) ? tableGameLabel(s.tableGame) : gameTypeLabel(s.gameType),
    ),
    byLocation: groupBy(sessions, (s) => s.location.trim() || 'Unspecified'),
    byStakes: groupBy(
      sessions.filter((s) => !isTournamentStyle(s) && s.bigBlind > 0),
      (s) => stakesLabel(s) || 'Other',
    ),
    byMonth: monthlyProfits(chronological),
    byWeekday: weekdayProfits(sessions),
    bySessionType: groupBy(sessions, (s) => SESSION_TYPE_LABELS[s.sessionType]),
    byLiveOnline: groupBy(sessions, (s) => VENUE_TYPE_LABELS[s.venueType ?? 'LIVE']),
    byFocus: groupBy(
      sessions.filter((s) => s.focus > 0),
      (s) => `Focus ${s.focus}/5`,
    ),
    byGameQuality: groupBy(
      sessions.filter((s) => s.gameQuality !== ''),
      (s) => GAME_QUALITY_LABELS[s.gameQuality as Exclude<Session['gameQuality'], ''>],
    ),
    bySessionLength: groupBy(
      sessions.filter((s) => s.durationMinutes > 0),
      (s) => lengthBucket(s.durationMinutes),
    ),
    byRebuys: groupBy(sessions, (s) =>
      s.rebuysAddons + s.addOns > 0 ? 'With rebuys / add-ons' : 'Single bullet',
    ),
  };
}

function lengthBucket(minutes: number): string {
  const h = minutes / 60;
  if (h < 2) return 'Under 2h';
  if (h < 4) return '2–4h';
  if (h < 6) return '4–6h';
  return '6h+';
}

function groupBy(sessions: Session[], key: (s: Session) => string): GroupStat[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = key(s);
    const list = map.get(k);
    if (list) list.push(s);
    else map.set(k, [s]);
  }
  return [...map.entries()]
    .map(([k, list]) => ({
      key: k,
      sessionCount: list.length,
      profit: list.reduce((a, s) => a + profit(s), 0),
      hours: list.reduce((a, s) => a + s.durationMinutes, 0) / 60,
    }))
    .sort((a, b) => b.profit - a.profit);
}

function monthlyProfits(chronological: Session[]): MonthlyProfit[] {
  const map = new Map<number, Session[]>();
  for (const s of chronological) {
    const d = new Date(s.startTime);
    const key = monthSortKey(d);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()]
    .map(([sortKey, list]) => {
      const d = new Date(list[0].startTime);
      return {
        label: monthLabel(d),
        profit: list.reduce((a, s) => a + profit(s), 0),
        sessionCount: list.length,
        sortKey,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);
}

function weekdayProfits(sessions: Session[]): GroupStat[] {
  // JS getDay(): 0=Sun..6=Sat → reorder to Mon..Sun like the Android app.
  const byDay = new Map<number, Session[]>();
  for (const s of sessions) {
    const mondayIndexed = mondayIndex(new Date(s.startTime));
    const list = byDay.get(mondayIndexed);
    if (list) list.push(s);
    else byDay.set(mondayIndexed, [s]);
  }
  const out: GroupStat[] = [];
  for (let day = 0; day < 7; day++) {
    const list = byDay.get(day);
    if (!list) continue;
    out.push({
      key: DAY_NAMES[day],
      sessionCount: list.length,
      profit: list.reduce((a, s) => a + profit(s), 0),
      hours: list.reduce((a, s) => a + s.durationMinutes, 0) / 60,
    });
  }
  return out;
}

/** 6-bin histogram (3 loss, 3 win) with a "nice" width; outliers clamp to edges. */
function profitBuckets(sessions: Session[]): ProfitBucket[] {
  if (sessions.length === 0) return [];
  const maxAbs = Math.max(...sessions.map((s) => Math.abs(profit(s))));
  if (maxAbs === 0) return [];
  const width = niceWidth(maxAbs / 3);

  const counts = new Array<number>(6).fill(0);
  for (const s of sessions) {
    const raw = Math.floor(profit(s) / width) + 3;
    counts[Math.min(5, Math.max(0, raw))]++;
  }
  return counts.map((count, i) => ({
    lo: (i - 3) * width,
    hi: (i - 2) * width,
    count,
  }));
}

/** Rounds up to a 1/2/5 × 10^k value so bucket bounds look sane. */
export function niceWidth(raw: number): number {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}
