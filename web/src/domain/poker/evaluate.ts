// Hand evaluation. evaluate5 scores exactly five cards; the game-specific
// helpers pick the best legal combination (any 5 of 7 for Hold'em; exactly
// 2 hole + 3 board for Omaha). Higher score = better hand. Low hands
// (8-or-better, ace-to-five) return a value where LOWER = better, or null
// when no qualifying low exists.
import { Card, rankOf, suitOf } from './cards';

// Category weights leave room for five base-13 tiebreak digits.
const BASE = 13;
const B1 = BASE;
const B2 = BASE * BASE;
const B3 = B2 * BASE;
const B4 = B3 * BASE;
const CAT = B4 * BASE;

export const CATEGORY_NAMES = [
  'High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight',
  'Flush', 'Full house', 'Four of a kind', 'Straight flush',
];

export const categoryOf = (score: number): number => Math.floor(score / CAT);

/** Score five cards. Deterministic, allocation-light, fully ordered. */
export function evaluate5(c: readonly Card[]): number {
  const ranks = [rankOf(c[0]), rankOf(c[1]), rankOf(c[2]), rankOf(c[3]), rankOf(c[4])];
  const counts = new Array<number>(13).fill(0);
  for (const r of ranks) counts[r]++;
  const isFlush =
    suitOf(c[0]) === suitOf(c[1]) && suitOf(c[1]) === suitOf(c[2]) &&
    suitOf(c[2]) === suitOf(c[3]) && suitOf(c[3]) === suitOf(c[4]);

  // Straight detection over distinct ranks (wheel: A-2-3-4-5 plays as 5-high).
  let straightHigh = -1;
  {
    let run = 0;
    for (let r = 0; r <= 12; r++) {
      if (counts[r] > 0) {
        run++;
        if (run >= 5) straightHigh = r;
      } else run = 0;
    }
    // Wheel: A,2,3,4,5 → high card is the 5 (rank 3).
    if (straightHigh < 0 && counts[12] > 0 && counts[0] > 0 && counts[1] > 0 && counts[2] > 0 && counts[3] > 0) {
      straightHigh = 3;
    }
  }

  // Rank groups sorted by count desc, then rank desc.
  const groups: { rank: number; count: number }[] = [];
  for (let r = 12; r >= 0; r--) if (counts[r] > 0) groups.push({ rank: r, count: counts[r] });
  groups.sort((a, b) => b.count - a.count || b.rank - a.rank);

  const kick = (n: number): number => {
    // n tiebreak digits from the groups, flattened (paired ranks first).
    const digits: number[] = [];
    for (const g of groups) for (let i = 0; i < g.count && digits.length < n; i++) digits.push(g.rank);
    let v = 0;
    for (let i = 0; i < n; i++) v = v * BASE + (digits[i] ?? 0);
    return v;
  };

  if (isFlush && straightHigh >= 0 && groups.length === 5) return 8 * CAT + straightHigh;
  if (groups[0].count === 4) return 7 * CAT + groups[0].rank * B1 + groups[1].rank;
  if (groups[0].count === 3 && groups[1].count === 2) return 6 * CAT + groups[0].rank * B1 + groups[1].rank;
  if (isFlush) return 5 * CAT + kick(5);
  if (straightHigh >= 0 && groups.length === 5) return 4 * CAT + straightHigh;
  if (groups[0].count === 3) return 3 * CAT + groups[0].rank * B2 + groups[1].rank * B1 + groups[2].rank;
  if (groups[0].count === 2 && groups[1].count === 2) {
    return 2 * CAT + groups[0].rank * B2 + groups[1].rank * B1 + groups[2].rank;
  }
  if (groups[0].count === 2) {
    return 1 * CAT + groups[0].rank * B3 + groups[1].rank * B2 + groups[2].rank * B1 + groups[3].rank;
  }
  return kick(5);
}

// Precomputed 5-of-7 index combinations for Hold'em.
const CHOOSE_5_OF_7: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();

/** Best Hold'em hand from 2 hole + 5 board (any five of the seven). */
export function bestHoldem(hole: readonly Card[], board: readonly Card[]): number {
  const seven = [...hole, ...board];
  let best = -1;
  const five: Card[] = new Array(5);
  for (const idx of CHOOSE_5_OF_7) {
    for (let i = 0; i < 5; i++) five[i] = seven[idx[i]];
    const v = evaluate5(five);
    if (v > best) best = v;
  }
  return best;
}

function pairs(n: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}
const TRIPLES_OF_5 = (() => {
  const out: number[][] = [];
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++)
      for (let k = j + 1; k < 5; k++) out.push([i, j, k]);
  return out;
})();
const PAIRS_OF_4 = pairs(4);
const PAIRS_OF_5 = pairs(5);

/** Best Omaha high: EXACTLY two hole cards and three board cards. */
export function bestOmaha(hole: readonly Card[], board: readonly Card[]): number {
  const holePairs = hole.length === 4 ? PAIRS_OF_4 : hole.length === 5 ? PAIRS_OF_5 : pairs(hole.length);
  let best = -1;
  const five: Card[] = new Array(5);
  for (const [h1, h2] of holePairs) {
    five[0] = hole[h1];
    five[1] = hole[h2];
    for (const [b1, b2, b3] of TRIPLES_OF_5) {
      five[2] = board[b1];
      five[3] = board[b2];
      five[4] = board[b3];
      const v = evaluate5(five);
      if (v > best) best = v;
    }
  }
  return best;
}

/** Ace-to-five low rank of a card: A=1, 2=2 … 8=8; 9+ can't play low. */
const lowRank = (c: Card): number => {
  const r = rankOf(c);
  if (r === 12) return 1; // ace
  return r + 2; // deuce (rank 0) = 2 … eight (rank 6) = 8; 9+ → >8
};

function lowValue5(five: readonly Card[]): number | null {
  const ranks = five.map(lowRank);
  if (ranks.some((r) => r > 8)) return null;
  const distinct = new Set(ranks);
  if (distinct.size !== 5) return null;
  const sorted = [...distinct].sort((a, b) => b - a); // highest first
  let v = 0;
  for (const r of sorted) v = v * 9 + r;
  return v; // lower = better (8-high lows encode bigger than 5-high lows)
}

/** Best qualifying Omaha low (2 hole + 3 board, 8-or-better) or null. */
export function bestOmahaLow(hole: readonly Card[], board: readonly Card[]): number | null {
  const holePairs = hole.length === 4 ? PAIRS_OF_4 : hole.length === 5 ? PAIRS_OF_5 : pairs(hole.length);
  let best: number | null = null;
  const five: Card[] = new Array(5);
  for (const [h1, h2] of holePairs) {
    five[0] = hole[h1];
    five[1] = hole[h2];
    for (const [b1, b2, b3] of TRIPLES_OF_5) {
      five[2] = board[b1];
      five[3] = board[b2];
      five[4] = board[b3];
      const v = lowValue5(five);
      if (v !== null && (best === null || v < best)) best = v;
    }
  }
  return best;
}
