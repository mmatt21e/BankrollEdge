import { describe, it, expect } from 'vitest';
import { computeSettlement, drawSeats } from './settlement';
import { HomeGamePlayer } from '../models/types';

const player = (
  id: number,
  name: string,
  buyIn: number,
  cashOut: number,
  rebuys = 0,
  addOns = 0,
): HomeGamePlayer => ({
  id,
  name,
  buyIn,
  rebuys,
  addOns,
  cashOut,
  paid: false,
  paymentMethod: '',
  seat: 0,
  notes: '',
});

describe('computeSettlement', () => {
  it('balances a clean night: money in equals money out', () => {
    const s = computeSettlement([
      player(1, 'Amy', 100, 250),
      player(2, 'Ben', 100, 50, 100), // 200 in
      player(3, 'Cal', 100, 100),
    ]);
    expect(s.totalIn).toBe(400);
    expect(s.totalCashOuts).toBe(400);
    expect(s.unresolved).toBe(0);
    // Net conservation: nets sum to zero on a balanced night.
    expect(s.nets.reduce((a, n) => a + n.net, 0)).toBeCloseTo(0, 9);
  });

  it('reports the unresolved balance when entries do not balance', () => {
    const s = computeSettlement([
      player(1, 'Amy', 100, 180),
      player(2, 'Ben', 100, 0),
    ]);
    expect(s.totalIn).toBe(200);
    expect(s.totalCashOuts).toBe(180);
    expect(s.unresolved).toBe(20); // chips still on the table or a typo
  });

  it('breaks out buy-ins, rebuys and add-ons', () => {
    const s = computeSettlement([
      player(1, 'Amy', 100, 0, 50, 25),
      player(2, 'Ben', 100, 275),
    ]);
    expect(s.totalBuyIns).toBe(200);
    expect(s.totalRebuys).toBe(50);
    expect(s.totalAddOns).toBe(25);
    expect(s.totalIn).toBe(275);
  });

  it('suggests transfers that fully settle winners from losers', () => {
    const s = computeSettlement([
      player(1, 'Winner', 100, 300), // +200
      player(2, 'LoserA', 100, 0), // -100
      player(3, 'LoserB', 100, 0), // -100
    ]);
    expect(s.transfers).toHaveLength(2);
    const totalToWinner = s.transfers
      .filter((t) => t.to === 'Winner')
      .reduce((a, t) => a + t.amount, 0);
    expect(totalToWinner).toBe(200);
    // Every debtor pays out exactly their loss.
    expect(s.transfers.find((t) => t.from === 'LoserA')?.amount).toBe(100);
  });

  it('handles decimal cents without drift', () => {
    const s = computeSettlement([
      player(1, 'A', 33.33, 50),
      player(2, 'B', 33.33, 25),
      player(3, 'C', 33.34, 25),
    ]);
    expect(s.totalIn).toBeCloseTo(100, 2);
    expect(s.unresolved).toBeCloseTo(0, 2);
  });
});

describe('drawSeats', () => {
  it('assigns each player a unique seat 1..n', () => {
    const seats = drawSeats([10, 20, 30, 40], () => 0.5);
    expect([...seats.values()].sort()).toEqual([1, 2, 3, 4]);
    expect(seats.size).toBe(4);
  });
});
