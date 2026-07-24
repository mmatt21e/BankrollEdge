import { describe, it, expect } from 'vitest';
import { parseCard, cardText } from './cards';
import {
  CATEGORY_NAMES,
  bestHoldem,
  bestOmaha,
  bestOmahaLow,
  categoryOf,
  evaluate5,
} from './evaluate';
import { computeEquity } from './equity';
import { cellOfPair, gridCells, rangePercent } from './ranges';

const cards = (text: string) => text.split(' ').map((t) => parseCard(t)!);
const cat = (text: string) => CATEGORY_NAMES[categoryOf(evaluate5(cards(text)))];

describe('cards', () => {
  it('parses and round-trips', () => {
    expect(cardText(parseCard('Ah')!)).toBe('Ah');
    expect(cardText(parseCard('2c')!)).toBe('2c');
    expect(parseCard('Xx')).toBeNull();
    expect(parseCard('A')).toBeNull();
  });
});

describe('evaluate5 categories', () => {
  it('recognizes every category', () => {
    expect(cat('Ah Kh Qh Jh Th')).toBe('Straight flush');
    expect(cat('9c 9d 9h 9s 2c')).toBe('Four of a kind');
    expect(cat('9c 9d 9h 2s 2c')).toBe('Full house');
    expect(cat('Ah 9h 7h 5h 2h')).toBe('Flush');
    expect(cat('9c 8d 7h 6s 5c')).toBe('Straight');
    expect(cat('Ah 2c 3d 4s 5c')).toBe('Straight'); // wheel
    expect(cat('9c 9d 9h Ks 2c')).toBe('Three of a kind');
    expect(cat('9c 9d Kh Ks 2c')).toBe('Two pair');
    expect(cat('9c 9d Kh Qs 2c')).toBe('Pair');
    expect(cat('Ac 9d Kh Qs 2c')).toBe('High card');
  });

  it('orders hands correctly', () => {
    const score = (t: string) => evaluate5(cards(t));
    expect(score('Ah Kh Qh Jh Th')).toBeGreaterThan(score('9h 8h 7h 6h 5h'));
    expect(score('9c 8d 7h 6s 5c')).toBeGreaterThan(score('Ah 2c 3d 4s 5c')); // wheel is lowest straight
    expect(score('Ac Ad Kh Ks 2c')).toBeGreaterThan(score('Kc Kd Qh Qs Ac')); // aces up > kings up
    expect(score('Ah 9h 7h 5h 2h')).toBeGreaterThan(score('Kh Qh Jh 9h 8h')); // ace-high flush
    expect(score('Ac Ad 7h 5s 2c')).toBeGreaterThan(score('Kc Kd Ah Qs Jc')); // any aces > kings
    expect(score('Ac Kd Qh Js 9c')).toBeGreaterThan(score('Ac Kd Qh Js 8c')); // kicker
  });
});

describe('bestHoldem', () => {
  it('uses the best five of seven', () => {
    // Board plays: broadway straight on board beats one pair in hand.
    const v = bestHoldem(cards('2c 2d'), cards('Ah Kh Qs Jd Tc'));
    expect(CATEGORY_NAMES[categoryOf(v)]).toBe('Straight');
  });
});

describe('bestOmaha (exactly two hole cards)', () => {
  it('cannot play four board cards', () => {
    // Board has four spades; hole has only one spade → no flush in Omaha.
    const v = bestOmaha(cards('As 2c 3d 4h'), cards('Ks Qs Js 9s 2d'));
    expect(CATEGORY_NAMES[categoryOf(v)]).not.toBe('Flush');
  });

  it('makes the flush with two suited hole cards', () => {
    const v = bestOmaha(cards('As 2s 3d 4h'), cards('Ks Qs Js 9c 2d'));
    expect(CATEGORY_NAMES[categoryOf(v)]).toBe('Flush');
  });
});

describe('bestOmahaLow', () => {
  it('finds the nut low and rejects non-qualifiers', () => {
    // A2xx on a 3-4-5 board → 5-4-3-2-A wheel low.
    const low = bestOmahaLow(cards('Ac 2d Kh Ks'), cards('3c 4d 5h 9s Qc'));
    expect(low).not.toBeNull();
    // Board too high for any low.
    expect(bestOmahaLow(cards('Ac 2d Kh Ks'), cards('9c Td Jh Qs Kc'))).toBeNull();
    // Counterfeited: only two low board cards.
    expect(bestOmahaLow(cards('Ac 2d Kh Ks'), cards('3c 9d Th Qs Kc'))).toBeNull();
  });

  it('ranks lows correctly (wheel beats 8-low)', () => {
    const wheel = bestOmahaLow(cards('Ac 2d Kh Ks'), cards('3c 4d 5h Ts Qc'))!;
    const eight = bestOmahaLow(cards('8c 7d Kh Ks'), cards('3c 4d 5h Ts Qc'))!;
    expect(wheel).toBeLessThan(eight);
  });
});

describe('computeEquity (seeded Monte Carlo)', () => {
  const T = 8000;

  it('AA vs KK preflop is ~81/19', () => {
    const r = computeEquity('NLH', [{ cards: cards('Ah As') }, { cards: cards('Kh Ks') }], [], T);
    expect(r.equity[0]).toBeGreaterThan(0.78);
    expect(r.equity[0]).toBeLessThan(0.85);
    expect(r.equity[0] + r.equity[1]).toBeCloseTo(1, 2);
  });

  it('drawing dead is 0%', () => {
    // Quads vs a hand with no outs on a locked board.
    const r = computeEquity(
      'NLH',
      [{ cards: cards('9c 9d') }, { cards: cards('2c 3d') }],
      cards('9h 9s Kc Kd Kh'),
      500,
    );
    expect(r.equity[0]).toBe(1);
    expect(r.equity[1]).toBe(0);
  });

  it('handles a random opponent', () => {
    const r = computeEquity('NLH', [{ cards: cards('Ah As') }, { cards: [] }], [], T);
    expect(r.equity[0]).toBeGreaterThan(0.8); // AA vs random ≈ 85%
  });

  it('splits hi/lo pots', () => {
    // A2 nut low vs KK high-only on a made low board: player 2 has top set,
    // player 1 takes (at least) the low half.
    const r = computeEquity(
      'PLO4_HILO',
      [{ cards: cards('Ac 2d 7h 8s') }, { cards: cards('Kc Kd Qh Js') }],
      cards('3c 4d Kh 6s 9c'),
      500,
    );
    expect(r.winLow).not.toBeNull();
    expect(r.equity[0]).toBeGreaterThan(0.45); // low half + straight chances
    expect(r.equity[0] + r.equity[1]).toBeCloseTo(1, 2);
  });

  it('respects an NLH range', () => {
    // Opponent restricted to AA only → our KK is a big dog.
    const r = computeEquity(
      'NLH',
      [{ cards: cards('Kh Ks') }, { cards: [], range: { cells: ['AA'] } }],
      [],
      4000,
    );
    expect(r.equity[0]).toBeLessThan(0.3);
  });

  it('is deterministic for a fixed seed', () => {
    const a = computeEquity('PLO5', [{ cards: cards('Ah Kh Qc Jd 9s') }, { cards: [] }], [], 1000, 7);
    const b = computeEquity('PLO5', [{ cards: cards('Ah Kh Qc Jd 9s') }, { cards: [] }], [], 1000, 7);
    expect(a.equity).toEqual(b.equity);
  });
});

describe('ranges', () => {
  it('builds the 13×13 grid with pairs on the diagonal', () => {
    const grid = gridCells();
    expect(grid[0][0]).toBe('AA');
    expect(grid[0][1]).toBe('AKs');
    expect(grid[1][0]).toBe('AKo');
    expect(grid[12][12]).toBe('22');
  });

  it('classifies combos into cells', () => {
    expect(cellOfPair(parseCard('Ah')!, parseCard('Kh')!)).toBe('AKs');
    expect(cellOfPair(parseCard('Ah')!, parseCard('Kd')!)).toBe('AKo');
    expect(cellOfPair(parseCard('7h')!, parseCard('7d')!)).toBe('77');
  });

  it('computes range percentages', () => {
    expect(rangePercent(['AA'])).toBeCloseTo(6 / 1326, 9);
    const all = gridCells().flat();
    expect(rangePercent(all)).toBeCloseTo(1, 9);
  });
});
