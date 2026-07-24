import { describe, it, expect } from 'vitest';
import {
  breakdownBy,
  bullets,
  computeCashDeep,
  computeTournamentDeep,
  isoWeek,
} from './deepStats';
import { Session, emptySession } from '../models/types';

const T0 = new Date(2026, 6, 20, 19, 0).getTime(); // Monday, July 20 2026

const cash = (over: Partial<Session>): Session => ({
  ...emptySession(T0),
  sessionType: 'CASH',
  ...over,
});
const mtt = (over: Partial<Session>): Session => ({
  ...emptySession(T0),
  sessionType: 'TOURNAMENT',
  ...over,
});

describe('computeCashDeep', () => {
  const sessions = [
    // 2 hours at 1/2, won $100 with 200 hands → 50 BB, 25 BB/hr, 25 BB/100.
    cash({ bigBlind: 2, durationMinutes: 120, buyIn: 200, cashOut: 300, handsPlayed: 200 }),
    // 1 hour at 1/2, lost $50, 100 hands → −25 BB.
    cash({ bigBlind: 2, durationMinutes: 60, buyIn: 200, cashOut: 150, handsPlayed: 100 }),
  ];
  const d = computeCashDeep(sessions);

  it('computes hands, hours and money totals', () => {
    expect(d.sessions).toBe(2);
    expect(d.hours).toBeCloseTo(3, 9);
    expect(d.hands).toBe(300);
    expect(d.totalProfit).toBeCloseTo(50, 9);
    expect(d.totalBuyins).toBe(400);
    expect(d.totalCashouts).toBe(450);
  });

  it('computes big-blind metrics', () => {
    expect(d.bbWon).toBeCloseTo(25, 9); // 50 − 25
    expect(d.bbPerHour).toBeCloseTo(25 / 3, 2);
    expect(d.bbPer100).toBeCloseTo(25 / 3, 2); // 25 BB over 300 hands
    expect(d.bbPerSession).toBeCloseTo(12.5, 9);
    expect(d.profitPer100).toBeCloseTo(50 / 3, 2);
  });

  it('computes ratios and spread', () => {
    expect(d.profitableRatio).toBeCloseTo(0.5, 9);
    // rates 50/hr and −50/hr → mean 0, std dev 50.
    expect(d.stdDevPerHour).toBeCloseTo(50, 9);
  });

  it('ignores sessions without blinds for BB metrics', () => {
    const withUnknown = [...sessions, cash({ bigBlind: 0, buyIn: 100, cashOut: 0 })];
    expect(computeCashDeep(withUnknown).bbWon).toBeCloseTo(25, 9);
  });
});

describe('computeTournamentDeep', () => {
  const sessions = [
    // $100 entry, one re-entry (2 bullets, $200 in), cashed $500 → +$300.
    mtt({ buyIn: 100, rebuysAddons: 100, reentries: 1, cashOut: 500, position: 3, fieldSize: 100 }),
    // $100 entry, busted.
    mtt({ buyIn: 100, cashOut: 0, position: 50, fieldSize: 100 }),
  ];
  const d = computeTournamentDeep(sessions);

  it('counts bullets from re-entries', () => {
    expect(bullets(sessions[0])).toBe(2);
    expect(d.bullets).toBe(3);
  });

  it('computes ROI and per-bullet averages', () => {
    expect(d.totalProfit).toBeCloseTo(200, 9);
    expect(d.totalBuyins).toBeCloseTo(300, 9);
    expect(d.totalRoi).toBeCloseTo(200 / 300, 9);
    expect(d.avgRoi).toBeCloseTo((1.5 - 1) / 2, 9); // (+150%, −100%) / 2
    expect(d.avgProfitPerBullet).toBeCloseTo(200 / 3, 2);
    expect(d.avgBuyinPerBullet).toBeCloseTo(100, 9);
  });

  it('computes ITM from cashes', () => {
    expect(d.itmRatio).toBeCloseTo(0.5, 9);
  });
});

describe('breakdownBy', () => {
  it('groups by ISO week chronologically', () => {
    const w = isoWeek(T0);
    expect(w.week).toBeGreaterThan(0);
    const later = { ...emptySession(T0 + 7 * 24 * 3_600_000), sessionType: 'CASH' as const };
    const groups = breakdownBy('week', [cash({ cashOut: 10 }), later]);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).not.toBe(groups[1].key);
  });

  it('groups by venue sorted by profit', () => {
    const groups = breakdownBy('venue', [
      cash({ location: 'A', buyIn: 0, cashOut: 10 }),
      cash({ location: 'B', buyIn: 0, cashOut: 50 }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['B', 'A']);
  });

  it('groups tournaments by buy-in ascending', () => {
    const groups = breakdownBy('buyin', [
      mtt({ buyIn: 250 }),
      mtt({ buyIn: 100 }),
      mtt({ buyIn: 100 }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['100', '250']);
    expect(groups[0].sessionCount).toBe(2);
  });

  it('groups by weekday with Monday first', () => {
    const groups = breakdownBy('weekday', [cash({})]); // T0 is a Monday
    expect(groups[0].key).toBe('Monday');
  });
});
