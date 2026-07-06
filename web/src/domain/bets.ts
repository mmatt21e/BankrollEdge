// Sports betting domain: odds conversion, settlement math, aggregate stats
// and CSV interchange. Decimal odds are the canonical stored form; American
// odds are a display/entry format.
import {
  SportsBet,
  BetStatus,
  Sport,
  BetType,
  OddsFormat,
  SPORT_LABELS,
  BET_TYPE_LABELS,
  SPORTS,
  BET_TYPES,
  BET_STATUSES,
  emptyBet,
  normalizeBet,
} from '../models/types';
import { GroupStat, MonthlyProfit, ProfitPoint } from './stats';
import { formatIso, parseIso, escape, tokenize } from './csv';

// --- Odds math ---------------------------------------------------------------

/** +150 → 2.5, -110 → 1.9091. 0/NaN → 0 (unset). */
export function americanToDecimal(american: number): number {
  if (!Number.isFinite(american) || american === 0) return 0;
  return american > 0 ? 1 + american / 100 : 1 + 100 / -american;
}

/** 2.5 → +150, 1.9091 → -110. Odds at/below 1.0 are unset → 0. */
export function decimalToAmerican(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) return 0;
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : -Math.round(100 / (decimal - 1));
}

/** "+150" / "-110" or "2.50" depending on the format. '' when unset. */
export function formatOdds(decimal: number, format: OddsFormat): string {
  if (decimal <= 1) return '';
  if (format === 'DECIMAL') return decimal.toFixed(2);
  const am = decimalToAmerican(decimal);
  return am > 0 ? `+${am}` : String(am);
}

/** Break-even win probability implied by the price (0 when unset). */
export const impliedProbability = (decimal: number): number =>
  decimal > 1 ? 1 / decimal : 0;

/** Combined decimal odds of a bet. With legs: the product of non-push leg
 *  prices (a pushed leg drops out, as books grade it). Without legs: the
 *  bet's own odds. */
export function effectiveOdds(bet: SportsBet): number {
  if (bet.legs.length === 0) return bet.odds;
  return bet.legs
    .filter((l) => l.result !== 'PUSH')
    .reduce((acc, l) => acc * (l.odds > 1 ? l.odds : 1), 1);
}

// --- Settlement --------------------------------------------------------------

export const isSettled = (bet: SportsBet): boolean => bet.status !== 'PENDING';

/** Profit the bet would pay if it won right now. */
export const toWin = (bet: SportsBet): number => {
  const odds = effectiveOdds(bet);
  return odds > 1 ? bet.stake * (odds - 1) : 0;
};

/** Money out of pocket while the bet is open (free bets risk nothing). */
export const atRisk = (bet: SportsBet): number =>
  bet.status === 'PENDING' && !bet.freeBet ? bet.stake : 0;

/** Net result of the bet given its status. Pending bets contribute 0 until
 *  settled. Free bets: a win pays the winnings only and a loss costs nothing. */
export function betProfit(bet: SportsBet): number {
  switch (bet.status) {
    case 'PENDING':
      return 0;
    case 'WON':
      return toWin(bet);
    case 'LOST':
      return bet.freeBet ? 0 : -bet.stake;
    case 'PUSH':
    case 'VOID':
      return 0;
    case 'CASHED_OUT':
      return bet.cashOutAmount - (bet.freeBet ? 0 : bet.stake);
  }
}

/** Closing line value in percent (positive = beat the close). null when the
 *  closing odds weren't recorded. */
export function clvPercent(bet: SportsBet): number | null {
  const odds = effectiveOdds(bet);
  if (bet.closingOdds <= 1 || odds <= 1) return null;
  return (odds / bet.closingOdds - 1) * 100;
}

// --- Aggregate stats ----------------------------------------------------------

export interface BetStats {
  betCount: number;
  settledCount: number;
  wonCount: number;
  lostCount: number;
  /** PUSH + VOID. */
  pushCount: number;
  cashedOutCount: number;
  pendingCount: number;
  pendingStake: number;
  pendingToWin: number;
  /** Money risked on settled bets (free-bet stakes excluded — nothing risked). */
  totalStaked: number;
  netProfit: number;
  avgStake: number;
  /** Average decimal odds across settled bets with a price. */
  avgOdds: number;
  biggestWin: number;
  biggestLoss: number;
  /** + = active win streak, − = active losing streak (pushes skipped). */
  currentStreak: number;
  bestStreak: number;
  worstStreak: number;
  cumulative: ProfitPoint[];
  byMonth: MonthlyProfit[];
  bySport: GroupStat[];
  byType: GroupStat[];
  byBook: GroupStat[];
  byOddsBand: GroupStat[];
  byWeekday: GroupStat[];
  byTag: GroupStat[];
  /** Average CLV% over bets with closing odds recorded. */
  avgClv: number;
  clvCount: number;
}

export const betRoi = (s: BetStats): number =>
  s.totalStaked > 0 ? s.netProfit / s.totalStaked : 0;

/** "12-8-1" — wins-losses-pushes (voids count as pushes; cash-outs excluded). */
export const recordLabel = (s: BetStats): string =>
  `${s.wonCount}-${s.lostCount}-${s.pushCount}`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function oddsBand(decimal: number): string {
  if (decimal <= 1) return 'No price';
  if (decimal < 1.5) return 'Big favorites (-200 and shorter)';
  if (decimal < 2) return 'Favorites (-200 to EVEN)';
  if (decimal < 3) return 'Underdogs (EVEN to +200)';
  return 'Longshots (+200 and up)';
}

function groupBy(bets: SportsBet[], key: (b: SportsBet) => string): GroupStat[] {
  const map = new Map<string, SportsBet[]>();
  for (const b of bets) {
    const k = key(b);
    const list = map.get(k);
    if (list) list.push(b);
    else map.set(k, [b]);
  }
  return [...map.entries()]
    .map(([k, list]) => ({
      key: k,
      sessionCount: list.length,
      profit: list.reduce((a, b) => a + betProfit(b), 0),
      hours: 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

const EMPTY_STATS: BetStats = {
  betCount: 0,
  settledCount: 0,
  wonCount: 0,
  lostCount: 0,
  pushCount: 0,
  cashedOutCount: 0,
  pendingCount: 0,
  pendingStake: 0,
  pendingToWin: 0,
  totalStaked: 0,
  netProfit: 0,
  avgStake: 0,
  avgOdds: 0,
  biggestWin: 0,
  biggestLoss: 0,
  currentStreak: 0,
  bestStreak: 0,
  worstStreak: 0,
  cumulative: [],
  byMonth: [],
  bySport: [],
  byType: [],
  byBook: [],
  byOddsBand: [],
  byWeekday: [],
  byTag: [],
  avgClv: 0,
  clvCount: 0,
};

export function computeBetStats(bets: SportsBet[]): BetStats {
  if (bets.length === 0) return { ...EMPTY_STATS };

  const settled = bets.filter(isSettled);
  const pending = bets.filter((b) => !isSettled(b));

  let netProfit = 0;
  let totalStaked = 0;
  let biggestWin = 0;
  let biggestLoss = 0;
  let oddsSum = 0;
  let oddsCount = 0;
  for (const b of settled) {
    const p = betProfit(b);
    netProfit += p;
    if (!b.freeBet) totalStaked += b.stake;
    if (p > biggestWin) biggestWin = p;
    if (p < biggestLoss) biggestLoss = p;
    const odds = effectiveOdds(b);
    if (odds > 1) {
      oddsSum += odds;
      oddsCount++;
    }
  }

  const chronological = [...settled].sort((a, b) => a.placedAt - b.placedAt);
  let running = 0;
  const cumulative: ProfitPoint[] = chronological.map((b) => {
    running += betProfit(b);
    return { time: b.placedAt, cumulative: running };
  });

  // Streaks over graded results; pushes/voids/zero-profit cash-outs skip.
  let runStreak = 0;
  let bestStreak = 0;
  let worstStreak = 0;
  for (const b of chronological) {
    const p = betProfit(b);
    if (p === 0) continue;
    runStreak = p > 0 ? (runStreak > 0 ? runStreak + 1 : 1) : runStreak < 0 ? runStreak - 1 : -1;
    if (runStreak > bestStreak) bestStreak = runStreak;
    if (-runStreak > worstStreak) worstStreak = -runStreak;
  }

  const byMonthMap = new Map<number, SportsBet[]>();
  for (const b of chronological) {
    const d = new Date(b.placedAt);
    const key = d.getFullYear() * 100 + d.getMonth() + 1;
    const list = byMonthMap.get(key);
    if (list) list.push(b);
    else byMonthMap.set(key, [b]);
  }
  const byMonth: MonthlyProfit[] = [...byMonthMap.entries()]
    .map(([sortKey, list]) => {
      const d = new Date(list[0].placedAt);
      return {
        label: `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear() % 100).padStart(2, '0')}`,
        profit: list.reduce((a, b) => a + betProfit(b), 0),
        sessionCount: list.length,
        sortKey,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  const byWeekday: GroupStat[] = [];
  const byDayMap = new Map<number, SportsBet[]>();
  for (const b of settled) {
    const mondayIndexed = (new Date(b.placedAt).getDay() + 6) % 7;
    const list = byDayMap.get(mondayIndexed);
    if (list) list.push(b);
    else byDayMap.set(mondayIndexed, [b]);
  }
  for (let day = 0; day < 7; day++) {
    const list = byDayMap.get(day);
    if (!list) continue;
    byWeekday.push({
      key: DAY_NAMES[day],
      sessionCount: list.length,
      profit: list.reduce((a, b) => a + betProfit(b), 0),
      hours: 0,
    });
  }

  const withClv = settled
    .map((b) => clvPercent(b))
    .filter((v): v is number => v !== null);

  return {
    betCount: bets.length,
    settledCount: settled.length,
    wonCount: settled.filter((b) => b.status === 'WON').length,
    lostCount: settled.filter((b) => b.status === 'LOST').length,
    pushCount: settled.filter((b) => b.status === 'PUSH' || b.status === 'VOID').length,
    cashedOutCount: settled.filter((b) => b.status === 'CASHED_OUT').length,
    pendingCount: pending.length,
    pendingStake: pending.reduce((a, b) => a + atRisk(b), 0),
    pendingToWin: pending.reduce((a, b) => a + toWin(b), 0),
    totalStaked,
    netProfit,
    avgStake: settled.length > 0 ? settled.reduce((a, b) => a + b.stake, 0) / settled.length : 0,
    avgOdds: oddsCount > 0 ? oddsSum / oddsCount : 0,
    biggestWin,
    biggestLoss,
    currentStreak: runStreak,
    bestStreak,
    worstStreak,
    cumulative,
    byMonth,
    bySport: groupBy(settled, (b) => SPORT_LABELS[b.sport]),
    byType: groupBy(settled, (b) => BET_TYPE_LABELS[b.betType]),
    byBook: groupBy(
      settled.filter((b) => b.sportsbook.trim() !== ''),
      (b) => b.sportsbook.trim(),
    ),
    byOddsBand: groupBy(settled, (b) => oddsBand(effectiveOdds(b))),
    byWeekday,
    byTag: groupBy(
      settled.filter((b) => b.tags.length > 0),
      (b) => `#${b.tags[0]}`,
    ),
    avgClv: withClv.length > 0 ? withClv.reduce((a, v) => a + v, 0) / withClv.length : 0,
    clvCount: withClv.length,
  };
}

// --- CSV interchange ----------------------------------------------------------

const BET_HEADER =
  'PlacedAt,Sport,Event,Pick,BetType,Status,OddsDecimal,OddsAmerican,Stake,Profit,' +
  'CashOutAmount,FreeBet,ClosingOddsDecimal,Sportsbook,EventStart,Tags,Notes,Currency,Legs';

export function buildBetsCsv(bets: SportsBet[]): string {
  const lines = [BET_HEADER];
  for (const b of [...bets].sort((a, z) => a.placedAt - z.placedAt)) {
    lines.push(
      [
        formatIso(b.placedAt),
        SPORT_LABELS[b.sport],
        escape(b.event),
        escape(b.pick),
        BET_TYPE_LABELS[b.betType],
        b.status,
        effectiveOdds(b) > 1 ? effectiveOdds(b).toFixed(4) : '',
        decimalToAmerican(effectiveOdds(b)) || '',
        b.stake,
        betProfit(b),
        b.cashOutAmount,
        b.freeBet ? 'Yes' : '',
        b.closingOdds > 1 ? b.closingOdds.toFixed(4) : '',
        escape(b.sportsbook),
        b.eventStart > 0 ? formatIso(b.eventStart) : '',
        escape(b.tags.join(';')),
        escape(b.notes),
        b.currency,
        escape(b.legs.length > 0 ? JSON.stringify(b.legs) : ''),
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

export interface BetImportResult {
  bets: SportsBet[];
  skippedRows: number;
}

/** Column matching by header name; bad rows are counted, not fatal.
 *  Throws if there is no PlacedAt column. */
export function parseBetsCsv(csv: string): BetImportResult {
  const records = tokenize(csv);
  if (records.length === 0) return { bets: [], skippedRows: 0 };

  const header = records[0].map((h) => h.trim().toLowerCase());
  const col = new Map(header.map((name, i) => [name, i]));
  if (!col.has('placedat')) {
    throw new Error("No 'PlacedAt' column found — is this a BankrollEdge bets export?");
  }
  const field = (row: string[], name: string): string => {
    const i = col.get(name);
    return i === undefined ? '' : (row[i] ?? '').trim();
  };
  const num = (row: string[], name: string): number => {
    const v = Number.parseFloat(field(row, name));
    return Number.isFinite(v) ? v : 0;
  };

  const bets: SportsBet[] = [];
  let skipped = 0;
  for (const row of records.slice(1)) {
    if (row.every((f) => f.trim() === '')) continue;
    const placedAt = parseIso(field(row, 'placedat'));
    if (placedAt === null) {
      skipped++;
      continue;
    }
    // Prefer decimal odds; fall back to converting the American column.
    const oddsDecimal = num(row, 'oddsdecimal');
    const odds = oddsDecimal > 1 ? oddsDecimal : americanToDecimal(num(row, 'oddsamerican'));

    let legs: SportsBet['legs'] = [];
    const rawLegs = field(row, 'legs');
    if (rawLegs) {
      try {
        const parsed = JSON.parse(rawLegs);
        if (Array.isArray(parsed)) legs = parsed;
      } catch {
        // malformed legs cell — keep the bet as a straight bet
      }
    }

    bets.push(
      normalizeBet({
        ...emptyBet(placedAt),
        placedAt,
        sport: parseSport(field(row, 'sport')),
        event: field(row, 'event'),
        pick: field(row, 'pick'),
        betType: parseBetType(field(row, 'bettype')),
        status: parseBetStatus(field(row, 'status')),
        odds,
        stake: num(row, 'stake'),
        cashOutAmount: num(row, 'cashoutamount'),
        freeBet: /yes|true|1/i.test(field(row, 'freebet')),
        closingOdds: num(row, 'closingoddsdecimal'),
        sportsbook: field(row, 'sportsbook'),
        eventStart: parseIso(field(row, 'eventstart')) ?? 0,
        tags: field(row, 'tags').split(';').map((t) => t.trim()).filter(Boolean),
        notes: field(row, 'notes'),
        currency: field(row, 'currency') || 'USD',
        legs,
      }),
    );
  }
  return { bets, skippedRows: skipped };
}

function parseSport(value: string): Sport {
  return (
    SPORTS.find(
      (s) =>
        s.toLowerCase() === value.toLowerCase() ||
        SPORT_LABELS[s].toLowerCase() === value.toLowerCase(),
    ) ?? 'OTHER'
  );
}

function parseBetType(value: string): BetType {
  return (
    BET_TYPES.find(
      (t) =>
        t.toLowerCase() === value.toLowerCase() ||
        BET_TYPE_LABELS[t].toLowerCase() === value.toLowerCase(),
    ) ?? 'OTHER'
  );
}

function parseBetStatus(value: string): BetStatus {
  return (
    BET_STATUSES.find(
      (s) =>
        s.toLowerCase() === value.toLowerCase() ||
        s.replace('_', ' ').toLowerCase() === value.toLowerCase(),
    ) ?? 'PENDING'
  );
}
