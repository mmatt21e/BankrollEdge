import { describe, it, expect } from 'vitest';
import { valueStack, StackValueInput } from './stackValue';

const base: StackValueInput = {
  stack: 100,
  players: 4,
  totalChips: 400,
  bigBlind: 0,
  payouts: [40, 30, 20, 10],
};

describe('valueStack', () => {
  it('values an exactly-average stack at the even share under every model', () => {
    const r = valueStack(base); // pool 100, 4 players, all stacks equal
    expect(r.chipShare).toBeCloseTo(0.25, 6);
    expect(r.averageStack).toBe(100);
    expect(r.stacksVsAverage).toBeCloseTo(1, 6);
    expect(r.position).toBe('Average');
    expect(r.evenValue).toBe(25);
    expect(r.chipChopValue).toBe(25);
    expect(r.icmValue).toBe(25);
  });

  it('matches the classic two-player ICM equity', () => {
    // 60 of 100 chips, payouts 50/30 → ICM 42, chip chop 42.
    const r = valueStack({
      stack: 60,
      players: 2,
      totalChips: 100,
      bigBlind: 0,
      payouts: [50, 30],
    });
    expect(r.icmValue).toBe(42);
    expect(r.chipChopValue).toBe(42);
    expect(r.chipShare).toBeCloseTo(0.6, 6);
  });

  it('reports chip position and big blinds for a big stack', () => {
    const r = valueStack({
      stack: 320000,
      players: 6,
      totalChips: 1200000,
      bigBlind: 8000,
      payouts: [500, 300, 200],
    });
    expect(r.chipShare).toBeCloseTo(0.2667, 3);
    expect(r.averageStack).toBe(200000);
    expect(r.stacksVsAverage).toBeCloseTo(1.6, 6);
    expect(r.position).toBe('Big stack');
    expect(r.bigBlinds).toBe(40);
  });

  it('classifies a short stack and omits big blinds when none given', () => {
    const r = valueStack({ ...base, stack: 50000, totalChips: 1200000, players: 6 });
    expect(r.position).toBe('Short stack');
    expect(r.bigBlinds).toBeNull();
  });

  it('skips ICM above the player cap but still gives chip-chop and position', () => {
    const r = valueStack({
      stack: 250000,
      players: 12,
      totalChips: 1200000,
      bigBlind: 5000,
      payouts: [500, 300, 200, 150, 120, 100],
    });
    expect(r.icmSupported).toBe(false);
    expect(r.icmValue).toBeNull();
    expect(r.chipChopValue).toBeGreaterThan(0);
    expect(r.position).toBe('Big stack'); // 250k vs 100k avg = 2.5x
    // Per-BB still works off the models that are available.
    expect(r.perBigBlind).not.toBeNull();
    expect(r.perBigBlind!.icm).toBeNull();
    expect(r.perBigBlind!.chipChop).toBeGreaterThan(0);
  });

  it('values one big blind as the stack value divided by big blinds', () => {
    // Equal stacks → every model = 25; stack is 10 big blinds → 2.5 per BB.
    const r = valueStack({ ...base, bigBlind: 10 });
    expect(r.bigBlinds).toBe(10);
    expect(r.perBigBlind).toEqual({ icm: 2.5, chipChop: 2.5, even: 2.5 });
  });

  it('omits per-big-blind values when no big blind is given', () => {
    const r = valueStack(base); // bigBlind 0
    expect(r.bigBlinds).toBeNull();
    expect(r.perBigBlind).toBeNull();
  });

  it('gives the chip leader less than a naive proportional slice (ICM pressure)', () => {
    const r = valueStack({
      stack: 700,
      players: 3,
      totalChips: 1000,
      bigBlind: 0,
      payouts: [50, 30, 20],
    });
    const naive = r.chipShare * r.prizePool; // 0.7 * 100 = 70
    expect(r.icmValue).not.toBeNull();
    expect(r.icmValue!).toBeLessThan(naive);
    // Opponents share the rest evenly → stacks [700, 150, 150], ICM = 43.47.
    expect(r.icmValue!).toBeCloseTo(43.47, 2);
  });

  it('handles a chip-less / empty pool safely', () => {
    const r = valueStack({ stack: 0, players: 5, totalChips: 0, bigBlind: 0, payouts: [] });
    expect(r.chipShare).toBe(0);
    expect(r.prizePool).toBe(0);
    expect(r.icmValue).toBeNull();
    expect(r.chipChopValue).toBe(0);
  });
});
