// Monte-Carlo equity for Hold'em and Omaha (4/5 cards, Hi and Hi/Lo).
// Deterministic given a seed. Unknown cards (empty hole slots, unknown board
// cards, random opponents) are dealt uniformly from the remaining deck each
// trial; hi/lo splits the pot half to the best high, half to the best
// qualifying low (scooped when nobody makes a low).
import { Card, FULL_DECK, rng } from './cards';
import { bestHoldem, bestOmaha, bestOmahaLow } from './evaluate';
import { cellOfPair, pairMatchesCells } from './ranges';

export type GameVariant = 'NLH' | 'PLO4' | 'PLO5' | 'PLO4_HILO' | 'PLO5_HILO';

export const VARIANT_LABELS: Record<GameVariant, string> = {
  NLH: "Hold'em",
  PLO4: 'Omaha',
  PLO5: '5-Card Omaha',
  PLO4_HILO: 'Omaha Hi/Lo',
  PLO5_HILO: '5-Card Omaha Hi/Lo',
};

export const holeSize = (v: GameVariant): number =>
  v === 'NLH' ? 2 : v === 'PLO4' || v === 'PLO4_HILO' ? 4 : 5;

export const isHiLo = (v: GameVariant): boolean => v === 'PLO4_HILO' || v === 'PLO5_HILO';

export interface EquityPlayer {
  /** Known hole cards (may be partial or empty = fully random). */
  cards: Card[];
  /** NLH only: restrict the random fill to a 13×13 range (see ranges.ts). */
  range?: RangeSpec | null;
}

/** A Hold'em starting-hand range as a set of grid cells "AKs"/"77"/"T9o". */
export interface RangeSpec {
  cells: string[];
}

export interface EquityResult {
  /** Per player: share of the pot won (splits counted fractionally), 0..1. */
  equity: number[];
  /** Per player: fraction of trials winning (or tying) the high outright. */
  winHigh: number[];
  tieHigh: number[];
  /** Hi/lo only: fraction of trials taking (a share of) the low half. */
  winLow: number[] | null;
  trials: number;
}

export function computeEquity(
  variant: GameVariant,
  players: EquityPlayer[],
  board: Card[],
  trials: number,
  seed = 42,
): EquityResult {
  const n = players.length;
  const need = holeSize(variant);
  const random = rng(seed);
  const hilo = isHiLo(variant);

  const known = new Set<Card>();
  for (const p of players) for (const c of p.cards) known.add(c);
  for (const c of board) known.add(c);
  const basePool = FULL_DECK.filter((c) => !known.has(c));

  const equity = new Array<number>(n).fill(0);
  const winHigh = new Array<number>(n).fill(0);
  const tieHigh = new Array<number>(n).fill(0);
  const winLow = new Array<number>(n).fill(0);

  const evalHigh = variant === 'NLH' ? bestHoldem : bestOmaha;

  for (let t = 0; t < trials; t++) {
    // Fisher–Yates shuffle of the unknown pool.
    const pool = [...basePool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let deal = 0;

    // Complete every player's hand, honoring NLH ranges via rejection of the
    // random fill (bounded retries; falls back to any cards).
    const hands: Card[][] = [];
    let ok = true;
    for (const p of players) {
      const hand = [...p.cards];
      if (variant === 'NLH' && p.range && p.range.cells.length > 0 && p.cards.length === 0) {
        // Find the first pair in the (shuffled) pool matching the range and
        // move it to the deal window; the shuffle makes this ~uniform over
        // the range's live combos. Falls back to random cards if the range
        // has no live combo left this trial.
        let found = false;
        outer: for (let i = deal; i < pool.length - 1; i++) {
          for (let j = i + 1; j < pool.length; j++) {
            if (pairMatchesCells(pool[i], pool[j], p.range.cells)) {
              [pool[deal], pool[i]] = [pool[i], pool[deal]];
              [pool[deal + 1], pool[j === deal ? i : j]] = [pool[j === deal ? i : j], pool[deal + 1]];
              found = true;
              break outer;
            }
          }
        }
        void found;
        hand.push(pool[deal++], pool[deal++]);
      } else {
        while (hand.length < need) hand.push(pool[deal++]);
      }
      if (hand.some((c) => c === undefined)) ok = false;
      hands.push(hand);
    }
    if (!ok) continue;
    const fullBoard = [...board];
    while (fullBoard.length < 5) fullBoard.push(pool[deal++]);

    // High half (or whole pot).
    const highs = hands.map((h) => evalHigh(h, fullBoard));
    const bestHigh = Math.max(...highs);
    const highWinners: number[] = [];
    for (let i = 0; i < n; i++) if (highs[i] === bestHigh) highWinners.push(i);

    let lowWinners: number[] = [];
    if (hilo) {
      const lows = hands.map((h) => bestOmahaLow(h, fullBoard));
      let bestLow: number | null = null;
      for (const v of lows) if (v !== null && (bestLow === null || v < bestLow)) bestLow = v;
      if (bestLow !== null) {
        for (let i = 0; i < n; i++) if (lows[i] === bestLow) lowWinners.push(i);
      }
    }

    const highShare = (hilo && lowWinners.length > 0 ? 0.5 : 1) / highWinners.length;
    for (const i of highWinners) {
      equity[i] += highShare;
      if (highWinners.length === 1) winHigh[i]++;
      else tieHigh[i]++;
    }
    if (lowWinners.length > 0) {
      const lowShare = 0.5 / lowWinners.length;
      for (const i of lowWinners) {
        equity[i] += lowShare;
        winLow[i]++;
      }
    }
  }

  return {
    equity: equity.map((v) => v / trials),
    winHigh: winHigh.map((v) => v / trials),
    tieHigh: tieHigh.map((v) => v / trials),
    winLow: hilo ? winLow.map((v) => v / trials) : null,
    trials,
  };
}

export { cellOfPair };
