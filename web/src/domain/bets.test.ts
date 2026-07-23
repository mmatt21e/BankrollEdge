import { describe, it, expect } from 'vitest';
import {
  americanToDecimal,
  decimalToAmerican,
  formatOdds,
  impliedProbability,
  effectiveOdds,
  betProfit,
  toWin,
  atRisk,
  clvPercent,
  computeBetStats,
  betRoi,
  recordLabel,
  buildBetsCsv,
  parseBetsCsv,
} from './bets';
import { emptyBet, SportsBet } from '../models/types';

const T0 = 1_700_000_000_000;

const bet = (patch: Partial<SportsBet>): SportsBet => ({ ...emptyBet(T0), ...patch });

describe('odds math', () => {
  it('converts American to decimal', () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 9);
    expect(americanToDecimal(-110)).toBeCloseTo(1.9090909, 5);
    expect(americanToDecimal(100)).toBeCloseTo(2, 9);
    expect(americanToDecimal(0)).toBe(0);
  });

  it('converts decimal back to American', () => {
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(americanToDecimal(-110))).toBe(-110);
    expect(decimalToAmerican(2)).toBe(100);
    expect(decimalToAmerican(1)).toBe(0);
  });

  it('formats odds per display format', () => {
    expect(formatOdds(2.5, 'AMERICAN')).toBe('+150');
    expect(formatOdds(americanToDecimal(-110), 'AMERICAN')).toBe('-110');
    expect(formatOdds(2.5, 'DECIMAL')).toBe('2.50');
    expect(formatOdds(0, 'AMERICAN')).toBe('');
  });

  it('computes implied probability', () => {
    expect(impliedProbability(2)).toBeCloseTo(0.5, 9);
    expect(impliedProbability(americanToDecimal(-110))).toBeCloseTo(0.5238, 3);
  });

  it('multiplies parlay legs, dropping pushes', () => {
    const b = bet({
      betType: 'PARLAY',
      legs: [
        { pick: 'A', odds: 1.91, result: 'WON' },
        { pick: 'B', odds: 2.0, result: 'PUSH' },
        { pick: 'C', odds: 1.5, result: 'WON' },
      ],
    });
    expect(effectiveOdds(b)).toBeCloseTo(1.91 * 1.5, 9);
  });
});

describe('settlement', () => {
  it('grades a straight win at the price', () => {
    const b = bet({ stake: 110, odds: americanToDecimal(-110), status: 'WON' });
    expect(betProfit(b)).toBeCloseTo(100, 4);
  });

  it('loses the stake on a loss, nothing on a push/void', () => {
    expect(betProfit(bet({ stake: 50, odds: 2, status: 'LOST' }))).toBe(-50);
    expect(betProfit(bet({ stake: 50, odds: 2, status: 'PUSH' }))).toBe(0);
    expect(betProfit(bet({ stake: 50, odds: 2, status: 'VOID' }))).toBe(0);
  });

  it('cash-out profit is amount returned minus stake', () => {
    expect(betProfit(bet({ stake: 100, odds: 3, status: 'CASHED_OUT', cashOutAmount: 180 }))).toBe(80);
    expect(betProfit(bet({ stake: 100, odds: 3, status: 'CASHED_OUT', cashOutAmount: 60 }))).toBe(-40);
  });

  it('free bets risk nothing and pay winnings only', () => {
    const win = bet({ stake: 50, odds: 3, status: 'WON', freeBet: true });
    const loss = bet({ stake: 50, odds: 3, status: 'LOST', freeBet: true });
    const open = bet({ stake: 50, odds: 3, status: 'PENDING', freeBet: true });
    expect(betProfit(win)).toBeCloseTo(100, 9); // winnings only, no stake back
    expect(betProfit(loss)).toBe(0);
    expect(atRisk(open)).toBe(0);
  });

  it('pending bets contribute nothing yet but expose stake and to-win', () => {
    const b = bet({ stake: 25, odds: 2.5, status: 'PENDING' });
    expect(betProfit(b)).toBe(0);
    expect(atRisk(b)).toBe(25);
    expect(toWin(b)).toBeCloseTo(37.5, 9);
  });

  it('computes closing line value', () => {
    const beatClose = bet({ odds: 2.1, closingOdds: 2.0 });
    expect(clvPercent(beatClose)).toBeCloseTo(5, 5);
    expect(clvPercent(bet({ odds: 2.1, closingOdds: 0 }))).toBeNull();
  });
});

describe('computeBetStats', () => {
  const sample: SportsBet[] = [
    bet({ placedAt: T0, stake: 100, odds: 2, status: 'WON', sport: 'NFL', sportsbook: 'DK' }),
    bet({ placedAt: T0 + 1, stake: 100, odds: 2, status: 'WON', sport: 'NFL', sportsbook: 'DK' }),
    bet({ placedAt: T0 + 2, stake: 50, odds: 1.5, status: 'LOST', sport: 'NBA', sportsbook: 'FD' }),
    bet({ placedAt: T0 + 3, stake: 20, odds: 2, status: 'PUSH', sport: 'NBA' }),
    bet({ placedAt: T0 + 4, stake: 30, odds: 3, status: 'PENDING', sport: 'MLB' }),
  ];
  const stats = computeBetStats(sample);

  it('tracks the record and counts', () => {
    expect(recordLabel(stats)).toBe('2-1-1');
    expect(stats.pendingCount).toBe(1);
    expect(stats.settledCount).toBe(4);
  });

  it('sums profit, staked and pending exposure', () => {
    expect(stats.netProfit).toBeCloseTo(100 + 100 - 50 + 0, 9);
    expect(stats.totalStaked).toBeCloseTo(270, 9);
    expect(betRoi(stats)).toBeCloseTo(150 / 270, 9);
    expect(stats.pendingStake).toBe(30);
    expect(stats.pendingToWin).toBeCloseTo(60, 9);
  });

  it('tracks streaks skipping pushes', () => {
    expect(stats.bestStreak).toBe(2);
    expect(stats.currentStreak).toBe(-1);
  });

  it('groups by sport and book', () => {
    const nfl = stats.bySport.find((g) => g.key === 'NFL')!;
    expect(nfl.sessionCount).toBe(2);
    expect(nfl.profit).toBeCloseTo(200, 9);
    const dk = stats.byBook.find((g) => g.key === 'DK')!;
    expect(dk.profit).toBeCloseTo(200, 9);
  });

  it('handles empty input', () => {
    const empty = computeBetStats([]);
    expect(empty.betCount).toBe(0);
    expect(recordLabel(empty)).toBe('0-0-0');
  });

  it('excludes free bets from avgStake, matching totalStaked', () => {
    const s = computeBetStats([
      bet({ placedAt: T0, stake: 100, odds: 2, status: 'WON' }),
      bet({ placedAt: T0 + 1, stake: 50, odds: 3, status: 'LOST', freeBet: true }),
    ]);
    expect(s.totalStaked).toBe(100);
    expect(s.avgStake).toBe(100); // the free 50 doesn't drag the average down
  });
});

describe('bets CSV', () => {
  it('round-trips a straight bet and a parlay', () => {
    const bets = [
      bet({
        placedAt: T0,
        sport: 'NFL',
        event: 'Chiefs @ Bills',
        pick: 'Chiefs -3.5',
        betType: 'SPREAD',
        odds: americanToDecimal(-110),
        stake: 110,
        status: 'WON',
        sportsbook: 'DraftKings',
        closingOdds: americanToDecimal(-120),
        tags: ['primetime'],
        notes: 'line moved, "sharp" side',
      }),
      bet({
        placedAt: T0 + 60_000,
        sport: 'NBA',
        betType: 'PARLAY',
        pick: '2-leg parlay',
        legs: [
          { pick: 'Lakers ML', odds: 1.8, result: '' },
          { pick: 'Over 220.5', odds: 1.91, result: '' },
        ],
        stake: 20,
        status: 'PENDING',
      }),
    ];
    const result = parseBetsCsv(buildBetsCsv(bets));
    expect(result.skippedRows).toBe(0);
    expect(result.bets).toHaveLength(2);

    const straight = result.bets[0];
    expect(straight.sport).toBe('NFL');
    expect(straight.pick).toBe('Chiefs -3.5');
    expect(straight.status).toBe('WON');
    expect(decimalToAmerican(straight.odds)).toBe(-110);
    expect(decimalToAmerican(straight.closingOdds)).toBe(-120);
    expect(straight.tags).toEqual(['primetime']);
    expect(betProfit(straight)).toBeCloseTo(100, 2);

    const parlay = result.bets[1];
    expect(parlay.legs).toHaveLength(2);
    expect(parlay.legs[1].pick).toBe('Over 220.5');
    expect(effectiveOdds(parlay)).toBeCloseTo(1.8 * 1.91, 3);
    expect(parlay.status).toBe('PENDING');
  });

  it('skips unparseable rows and rejects foreign files', () => {
    const csv = 'PlacedAt,Sport,Stake\n2026-01-10 12:00,NFL,50\nnot-a-date,NBA,20\n';
    const result = parseBetsCsv(csv);
    expect(result.bets).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
    expect(() => parseBetsCsv('Foo,Bar\n1,2')).toThrow(/PlacedAt/);
  });
});
