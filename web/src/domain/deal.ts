// Deal / chop calculator: split the remaining prize pool among the players
// still in when they agree to stop. Three models — ICM (chip-weighted equity),
// chip chop (proportional with a guaranteed floor), and an even split.

import { round2 } from './aggregate';

export type DealMethod = 'ICM' | 'CHIP_CHOP' | 'EVEN';

export const DEAL_METHOD_LABELS: Record<DealMethod, string> = {
  ICM: 'ICM',
  CHIP_CHOP: 'Chip chop',
  EVEN: 'Even split',
};

/**
 * ICM does an exact enumeration of the payout ladder, which is fine for real
 * deal-sized tables but blows up factorially beyond that. Deals never involve
 * more than a final table, so we cap ICM here; chip chop and even split are
 * linear and stay available at any size.
 */
export const ICM_MAX_PLAYERS = 10;

export interface DealPlayer {
  name: string;
  chips: number;
}

export interface DealShare {
  name: string;
  chips: number;
  /** chips / totalChips, 0..1. */
  chipPct: number;
  /** Payout under the chosen method, after pool-conserving rounding. */
  amount: number;
}

export interface DealResult {
  method: DealMethod;
  totalChips: number;
  /** Sum of the remaining payouts on the table. */
  prizePool: number;
  shares: DealShare[];
  /** Sum of share amounts — equals prizePool after rounding. */
  totalPaid: number;
}


const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

function indexOfMax(xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[best]) best = i;
  return best;
}

/**
 * Independent Chip Model (Malmuth–Harville). Each player's equity is the sum
 * over finishing positions of P(finish there) × payout, where the chance of
 * finishing first among the players still standing is proportional to chips.
 * Exact recursion over the payout ladder; final tables are small so the cost
 * is negligible. Assumes every stack is > 0 (enforced by the caller) so the
 * whole pool is always distributed.
 */
export function icmEquity(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const equities = new Array<number>(n).fill(0);
  const prizeCount = Math.min(payouts.length, n);
  const totalChips = sum(stacks);
  if (n === 0 || prizeCount === 0 || totalChips <= 0) return equities;

  const used = new Array<boolean>(n).fill(false);
  const recurse = (depth: number, prob: number, chipsLeft: number): void => {
    if (depth >= prizeCount || chipsLeft <= 0) return;
    const prize = payouts[depth];
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const stack = stacks[i];
      if (stack <= 0) continue;
      const branchProb = prob * (stack / chipsLeft);
      equities[i] += branchProb * prize;
      if (depth + 1 < prizeCount) {
        used[i] = true;
        recurse(depth + 1, branchProb, chipsLeft - stack);
        used[i] = false;
      }
    }
  };
  recurse(0, 1, totalChips);
  return equities;
}

/**
 * Chip chop: everyone first takes the smallest guaranteed payout, then the
 * pool above those floors is split in proportion to chips. When there are
 * fewer payouts than players (a bubble deal) nobody is guaranteed, so it
 * reduces to a pure proportional split.
 */
export function chipChopShares(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const pool = sum(payouts);
  const totalChips = sum(stacks);
  if (n === 0) return [];
  if (totalChips <= 0) return stacks.map(() => pool / n);
  const floor = payouts.length >= n ? Math.min(...payouts.slice(0, n)) : 0;
  const splitPool = pool - floor * n;
  return stacks.map((stack) => floor + (splitPool * stack) / totalChips);
}

/** Even split: the remaining pool divided equally, ignoring chips. */
export function evenShares(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  const each = sum(payouts) / n;
  return stacks.map(() => each);
}

function rawShares(method: DealMethod, stacks: number[], payouts: number[]): number[] {
  switch (method) {
    case 'ICM':
      return icmEquity(stacks, payouts);
    case 'CHIP_CHOP':
      return chipChopShares(stacks, payouts);
    case 'EVEN':
      return evenShares(stacks, payouts);
  }
}

/**
 * Compute a deal for the given players and remaining payout ladder. Payouts are
 * sorted high-to-low so ICM and the chip-chop floor behave regardless of input
 * order. Rounding conserves the pool: any leftover from `roundTo` is handed to
 * the chip leader, so the shares always sum to the pool exactly.
 */
export function computeDeal(
  players: DealPlayer[],
  payouts: number[],
  method: DealMethod,
  roundTo = 0,
): DealResult {
  const stacks = players.map((p) => Math.max(0, p.chips));
  const ladder = payouts.map((p) => Math.max(0, p)).sort((a, b) => b - a);
  const pool = round2(sum(ladder));
  const totalChips = sum(stacks);

  const raw = rawShares(method, stacks, ladder);
  const step = roundTo > 1 ? roundTo : 0;
  const amounts = raw.map((v) => (step > 0 ? Math.floor(v / step) * step : round2(v)));

  // Conserve the pool: give any rounding remainder to the biggest stack.
  const paidSoFar = round2(sum(amounts));
  const remainder = round2(pool - paidSoFar);
  if (amounts.length > 0 && remainder !== 0) {
    const leader = indexOfMax(stacks);
    amounts[leader] = round2(amounts[leader] + remainder);
  }

  const shares: DealShare[] = players.map((p, i) => ({
    name: p.name,
    chips: stacks[i],
    chipPct: totalChips > 0 ? stacks[i] / totalChips : 0,
    amount: amounts[i],
  }));

  return {
    method,
    totalChips,
    prizePool: pool,
    shares,
    totalPaid: round2(sum(amounts)),
  };
}
