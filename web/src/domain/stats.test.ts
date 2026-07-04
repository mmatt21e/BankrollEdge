// Port of Android StatsCalculatorTest + VarianceStatsTest — same expectations.
import { describe, it, expect } from 'vitest';
import { computeStats, hourlyRate, roi, winRate, itmRate, bankrollOf } from './stats';
import { Session, emptySession } from '../models/types';

const T0 = 1_700_000_000_000;
const HOUR = 3_600_000;

function cash(
  buyIn: number,
  cashOut: number,
  opts: Partial<Session> = {},
): Session {
  return {
    ...emptySession(T0),
    sessionType: 'CASH',
    buyIn,
    cashOut,
    durationMinutes: 60,
    smallBlind: 1,
    bigBlind: 2,
    ...opts,
  };
}

const tournament = (buyIn: number, prize: number, start = T0): Session => ({
  ...emptySession(start),
  sessionType: 'TOURNAMENT',
  buyIn,
  cashOut: prize,
  durationMinutes: 120,
});

describe('computeStats', () => {
  it('sums profit as cashouts minus investments and tips', () => {
    const stats = computeStats([
      cash(100, 250, { tips: 10 }), // +140
      cash(200, 50), // -150
    ]);
    expect(stats.totalProfit).toBeCloseTo(-10, 9);
    expect(stats.totalInvested).toBeCloseTo(300, 9);
    expect(stats.winningSessions).toBe(1);
    expect(stats.biggestWin).toBeCloseTo(140, 9);
    expect(stats.biggestLoss).toBeCloseTo(-150, 9);
  });

  it('hourly rate ignores profit from untimed sessions', () => {
    const stats = computeStats([
      cash(100, 200, { durationMinutes: 120 }), // +100 in 2h
      cash(100, 1100, { durationMinutes: 0 }), // +1000 untimed
    ]);
    expect(stats.totalHours).toBeCloseTo(2, 9);
    expect(hourlyRate(stats)).toBeCloseTo(50, 9);
    expect(stats.totalProfit).toBeCloseTo(1100, 9);
  });

  it('computes roi, win rate and ITM', () => {
    const stats = computeStats([tournament(100, 300), tournament(100, 0)]);
    expect(roi(stats)).toBeCloseTo(0.5, 9);
    expect(winRate(stats)).toBeCloseTo(0.5, 9);
    expect(itmRate(stats)).toBeCloseTo(0.5, 9);
    expect(stats.tournamentCount).toBe(2);
    expect(stats.tournamentsCashed).toBe(1);
  });

  it('tracks streaks chronologically', () => {
    const stats = computeStats([
      cash(100, 200, { startTime: T0 }),
      cash(100, 300, { startTime: T0 + HOUR }),
      cash(100, 400, { startTime: T0 + 2 * HOUR }),
      cash(100, 0, { startTime: T0 + 3 * HOUR }),
      cash(100, 0, { startTime: T0 + 4 * HOUR }),
    ]);
    expect(stats.bestWinStreak).toBe(3);
    expect(stats.currentStreak).toBe(-2);
  });

  it('builds the cumulative series chronologically regardless of input order', () => {
    const stats = computeStats([
      cash(100, 0, { startTime: T0 + 24 * HOUR }), // -100 second
      cash(100, 400, { startTime: T0 }), // +300 first
    ]);
    expect(stats.cumulative.map((p) => p.cumulative)).toEqual([300, 200]);
  });

  it('bankroll adds starting balance and transactions', () => {
    const stats = computeStats([cash(100, 250)]); // +150
    expect(bankrollOf(stats, 1000, 500)).toBeCloseTo(1650, 9);
  });

  it('yields zeroed stats for empty input', () => {
    const stats = computeStats([]);
    expect(stats.sessionCount).toBe(0);
    expect(hourlyRate(stats)).toBe(0);
    expect(roi(stats)).toBe(0);
    expect(stats.byMonth).toHaveLength(0);
  });
});

describe('variance stats', () => {
  it('std dev of symmetric results', () => {
    const stats = computeStats([
      cash(100, 200, { startTime: T0 }),
      cash(100, 0, { startTime: T0 + HOUR }),
    ]);
    expect(stats.stdDevPerSession).toBeCloseTo(100, 9);
  });

  it('max drawdown is the deepest peak-to-trough fall', () => {
    // Cumulative: 100 -> 300 -> 50 -> 150; deepest fall 300 -> 50 = 250.
    const stats = computeStats([
      cash(100, 200, { startTime: T0 }),
      cash(100, 300, { startTime: T0 + HOUR }),
      cash(300, 50, { startTime: T0 + 2 * HOUR }),
      cash(100, 200, { startTime: T0 + 3 * HOUR }),
    ]);
    expect(stats.maxDrawdown).toBeCloseTo(250, 9);
  });

  it('drawdown from losing straight away counts from zero', () => {
    const stats = computeStats([cash(100, 20)]);
    expect(stats.maxDrawdown).toBeCloseTo(80, 9);
  });

  it('tracks worst loss streak separately from current', () => {
    const stats = computeStats([
      cash(100, 90, { startTime: T0 }),
      cash(100, 90, { startTime: T0 + HOUR }),
      cash(100, 90, { startTime: T0 + 2 * HOUR }),
      cash(100, 150, { startTime: T0 + 3 * HOUR }),
      cash(100, 90, { startTime: T0 + 4 * HOUR }),
    ]);
    expect(stats.worstLossStreak).toBe(3);
    expect(stats.currentStreak).toBe(-1);
  });

  it('hourly profit lands in the start-hour bucket', () => {
    const eightPm = new Date(2026, 2, 10, 20, 15).getTime();
    const stats = computeStats([cash(100, 175, { startTime: eightPm })]);
    expect(stats.hourlyProfit[20]).toBeCloseTo(75, 9);
    expect(stats.hourlyProfit[19]).toBe(0);
  });

  it('profit buckets cover wins and losses with outliers clamped', () => {
    const stats = computeStats([
      cash(100, 10_100, { startTime: T0 }), // extreme win → top bucket
      cash(100, 150, { startTime: T0 + HOUR }),
      cash(100, 60, { startTime: T0 + 2 * HOUR }),
    ]);
    expect(stats.profitBuckets).toHaveLength(6);
    expect(stats.profitBuckets.reduce((a, b) => a + b.count, 0)).toBe(3);
    expect(stats.profitBuckets[5].count).toBeGreaterThanOrEqual(1);
  });
});
