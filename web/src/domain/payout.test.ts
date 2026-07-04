import { describe, it, expect } from 'vitest';
import { computePayouts, templatePercentages, geometricPercentages, PayoutInput } from './payout';

const base: PayoutInput = {
  entries: 10,
  rebuys: 0,
  addOns: 0,
  buyInAmount: 100,
  rebuyAmount: 0,
  addOnAmount: 0,
  fee: 0,
  prizePoolOverride: 0,
  paidPlaces: 3,
  percentages: [50, 30, 20],
  roundTo: 0,
};

describe('computePayouts', () => {
  it('computes the pool from entries, rebuys and add-ons minus the fee', () => {
    const r = computePayouts({
      ...base,
      rebuys: 4,
      rebuyAmount: 100,
      addOns: 5,
      addOnAmount: 50,
      fee: 150,
    });
    expect(r.totalCollected).toBe(10 * 100 + 4 * 100 + 5 * 50); // 1650
    expect(r.prizePool).toBe(1500);
  });

  it('splits by percentages and always conserves the pool', () => {
    const r = computePayouts(base); // pool 1000
    expect(r.places.map((p) => p.amount)).toEqual([500, 300, 200]);
    expect(r.totalPaid).toBe(r.prizePool);
  });

  it('rounds to a step and gives the remainder to first place', () => {
    const r = computePayouts({ ...base, entries: 7, roundTo: 25 }); // pool 700
    // 50/30/20 of 700 = 350/210/140 → floor to 25: 350/200/125, remainder 25 → 1st.
    expect(r.places.map((p) => p.amount)).toEqual([375, 200, 125]);
    expect(r.totalPaid).toBe(700);
  });

  it('respects a prize pool override', () => {
    const r = computePayouts({ ...base, prizePoolOverride: 555, percentages: [100], paidPlaces: 1 });
    expect(r.prizePool).toBe(555);
    expect(r.places[0].amount).toBe(555);
  });
});

describe('templates', () => {
  it('provides the standard structures', () => {
    expect(templatePercentages('WTA', 10)).toEqual([100]);
    expect(templatePercentages('TOP2', 10)).toEqual([65, 35]);
    expect(templatePercentages('TOP3', 10)).toEqual([50, 30, 20]);
  });

  it('10% of field pays round(entries/10) places', () => {
    expect(templatePercentages('TOP_10PCT', 47)).toHaveLength(5);
    expect(templatePercentages('TOP_10PCT', 8)).toHaveLength(1);
  });

  it('geometric percentages sum to 100 and decrease', () => {
    const pcts = geometricPercentages(5);
    expect(pcts.reduce((a, p) => a + p, 0)).toBeCloseTo(100, 6);
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeLessThan(pcts[i - 1]);
  });
});
