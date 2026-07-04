import { describe, it, expect } from 'vitest';
import { planChips } from './chips';

const STANDARD_SET = [
  { value: 25, available: 160 },
  { value: 100, available: 160 },
  { value: 500, available: 80 },
  { value: 1000, available: 60 },
];

describe('planChips', () => {
  it('hits the target stack exactly with a standard set', () => {
    const plan = planChips(8, 10_000, STANDARD_SET);
    expect(plan.exact).toBe(true);
    expect(plan.perPlayerValue).toBe(10_000);
    // Sanity: uses every denomination and favors small chips by count.
    const byValue = new Map(plan.allocations.map((a) => [a.value, a.perPlayer]));
    expect(byValue.get(25)!).toBeGreaterThan(0);
    expect(byValue.get(25)!).toBeGreaterThanOrEqual(byValue.get(1000)!);
  });

  it('respects inventory and warns when chips run short', () => {
    const plan = planChips(10, 10_000, [
      { value: 25, available: 20 }, // only 2 per player
      { value: 100, available: 40 },
      { value: 1000, available: 30 }, // 3 per player = 3000 — not enough total
    ]);
    expect(plan.exact).toBe(false);
    expect(plan.warnings.length).toBeGreaterThan(0);
    // Never allocates more than floor(available / players).
    for (const a of plan.allocations) {
      expect(a.perPlayer).toBeLessThanOrEqual(Math.floor(a.available / 10));
    }
  });

  it('handles a single denomination', () => {
    const plan = planChips(4, 5000, [{ value: 500, available: 100 }]);
    expect(plan.exact).toBe(true);
    expect(plan.allocations[0].perPlayer).toBe(10);
    expect(plan.allocations[0].totalUsed).toBe(40);
  });

  it('flags impossible remainders', () => {
    // Stack 1050 with only 500s can't be represented exactly.
    const plan = planChips(2, 1050, [{ value: 500, available: 100 }]);
    expect(plan.exact).toBe(false);
    expect(plan.warnings.some((w) => /Short/.test(w.message))).toBe(true);
  });

  it('rejects empty input with a helpful message', () => {
    const plan = planChips(0, 0, []);
    expect(plan.warnings).toHaveLength(1);
  });
});
