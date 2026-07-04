import { describe, it, expect } from 'vitest';
import {
  icmEquity,
  chipChopShares,
  evenShares,
  computeDeal,
  DealPlayer,
} from './deal';

describe('icmEquity', () => {
  it('splits two players by the classic ICM equity', () => {
    // 60/40 chips, payouts 50/30. P1: .6*50 + .4*30 = 42; P2: .4*50 + .6*30 = 38.
    expect(icmEquity([60, 40], [50, 30])).toEqual([42, 38]);
  });

  it('gives equal stacks an equal share', () => {
    const eq = icmEquity([100, 100, 100], [50, 30, 20]);
    for (const e of eq) expect(e).toBeCloseTo(100 / 3, 6);
  });

  it('compresses the chip leader relative to their stack', () => {
    // 70/20/10 of a 100 pool. Leader has 70% of chips but far less of the money.
    const eq = icmEquity([70, 20, 10], [50, 30, 20]);
    expect(eq[0]).toBeCloseTo(43.53, 2);
    expect(eq[1]).toBeCloseTo(30.89, 2);
    expect(eq[2]).toBeCloseTo(25.58, 2);
    expect(eq[0] + eq[1] + eq[2]).toBeCloseTo(100, 6);
    expect(eq[0]).toBeLessThan(70); // less than a naive chip-share of the pool
  });

  it('preserves ordering: more chips never means less equity', () => {
    const eq = icmEquity([50, 30, 15, 5], [100, 60, 40, 20]);
    for (let i = 1; i < eq.length; i++) expect(eq[i]).toBeLessThanOrEqual(eq[i - 1]);
    expect(eq.reduce((a, b) => a + b, 0)).toBeCloseTo(220, 6);
  });
});

describe('chipChopShares', () => {
  it('guarantees the smallest payout then splits the rest by chips', () => {
    // floor = 20, reserved 60, split pool 40 by 70/20/10 → 48/28/24.
    expect(chipChopShares([70, 20, 10], [50, 30, 20])).toEqual([48, 28, 24]);
  });

  it('falls back to a pure proportional split with no guaranteed floor', () => {
    // 3 players, only 2 paid (bubble) → floor 0, pure proportional of the 80 pool.
    expect(chipChopShares([50, 30, 20], [50, 30])).toEqual([40, 24, 16]);
  });
});

describe('evenShares', () => {
  it('divides the pool equally regardless of chips', () => {
    expect(evenShares([90, 5, 5], [60, 30, 10])).toEqual([100 / 3, 100 / 3, 100 / 3]);
  });
});

describe('computeDeal', () => {
  const players: DealPlayer[] = [
    { name: 'A', chips: 70 },
    { name: 'B', chips: 20 },
    { name: 'C', chips: 10 },
  ];

  it('reports chip percentages and conserves the pool', () => {
    const r = computeDeal(players, [50, 30, 20], 'ICM');
    expect(r.prizePool).toBe(100);
    expect(r.totalChips).toBe(100);
    expect(r.shares.map((s) => s.chipPct)).toEqual([0.7, 0.2, 0.1]);
    expect(r.totalPaid).toBe(r.prizePool);
  });

  it('rounds to a step and hands the remainder to the chip leader', () => {
    const r = computeDeal(players, [50, 30, 20], 'ICM', 5);
    // Floored-to-5 shares under-pay the pool; the leftover lands on the leader (A).
    expect(r.totalPaid).toBe(100);
    for (const s of r.shares) expect(s.amount % 5).toBe(0);
    expect(r.shares[0].amount).toBeGreaterThanOrEqual(r.shares[1].amount);
  });

  it('sorts the payout ladder so input order does not matter', () => {
    const asc = computeDeal(players, [20, 30, 50], 'CHIP_CHOP');
    const desc = computeDeal(players, [50, 30, 20], 'CHIP_CHOP');
    expect(asc.shares.map((s) => s.amount)).toEqual(desc.shares.map((s) => s.amount));
    expect(desc.shares.map((s) => s.amount)).toEqual([48, 28, 24]);
  });

  it('handles a chip-less table by splitting evenly', () => {
    const r = computeDeal(
      [
        { name: 'A', chips: 0 },
        { name: 'B', chips: 0 },
      ],
      [60, 40],
      'CHIP_CHOP',
    );
    expect(r.totalPaid).toBe(100);
    expect(r.shares[0].amount).toBe(50);
    expect(r.shares[1].amount).toBe(50);
  });
});
