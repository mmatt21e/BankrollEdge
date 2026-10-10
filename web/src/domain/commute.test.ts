import { describe, expect, it } from 'vitest';
import { activeCommuteMinutes, mergeSessionEdits, parseCommuteMinutes } from './commute';
import { ActiveSession, DEFAULT_SETTINGS, emptySession, profit } from '../models/types';
import { analyzeCsv, applyMapping, guessMapping } from './importMap';
import { buildCsv, parseCsv } from './csv';
import { backupFromJson, backupToJson, Backup } from './backup';
import { computeStats, hourlyRate, withTravelTime } from './stats';

describe('manual commute', () => {
  it.each(['', ' ', '0', '00'])('accepts %j as no commute', value => {
    expect(parseCommuteMinutes(value)).toBe(0);
  });
  it.each(['-1', '1.5', '1e2', 'NaN', 'Infinity', '12 minutes', '+30', '9007199254740992'])('rejects %j without coercing it', value => {
    expect(parseCommuteMinutes(value)).toBeNull();
  });
  it('accepts total whole minutes without rounding or doubling', () => {
    expect(parseCommuteMinutes(' 035 ')).toBe(35);
    expect(activeCommuteMinutes({ travelOneWayMinutes: 30 } as ActiveSession)).toBe(30);
    expect(activeCommuteMinutes({ travelOneWayMinutes: 30, travelMinutes: 0 } as ActiveSession)).toBe(0);
    expect(activeCommuteMinutes({ travelOneWayMinutes: 30, travelMinutes: 45 } as ActiveSession)).toBe(45);
  });
  it('preserves every untouched property on a commute-only edit', () => {
    const original = { ...emptySession(1_800_000_023_456), id: 9, travelMinutes: 25,
      durationMinutes: 125, location: '  Synthetic venue  ', notes: '  preserve \n ',
      tags: [' x ', 'y'], sessionType: 'TABLE' as const, gameType: 'NLH', smallBlind: 1,
      futureField: 'preserved', buyIn: 100, cashOut: 190, tips: 5, expenses: 2 };
    const initial = { ...original, startTime: 1_800_000_000_000, location: 'Synthetic venue',
      notes: 'preserve', tags: ['x', 'y'], gameType: 'OTHER', smallBlind: 0 };
    expect(mergeSessionEdits(original, initial, { ...initial, travelMinutes: 60 }))
      .toEqual({ ...original, travelMinutes: 60 });
  });
  it('does not change play duration, profit or hourly rates unless travel inclusion is enabled', () => {
    const session = { ...emptySession(1_800_000_000_000), buyIn: 100, cashOut: 220,
      durationMinutes: 120, travelMinutes: 60 };
    expect(profit(session)).toBe(120);
    expect(hourlyRate(computeStats(withTravelTime([session], false)))).toBe(60);
    expect(hourlyRate(computeStats(withTravelTime([session], true)))).toBe(40);
    expect(session.durationMinutes).toBe(120);
    expect(session.travelMinutes).toBe(60);
    expect(computeStats(withTravelTime([session], true)).totalProfit).toBe(120);
  });
});

const options = { dateFormat: 'AUTO' as const, defaultCurrency: 'USD', defaultSessionType: 'CASH' as const };
const mapped = (csv: string) => {
  const parsed = analyzeCsv(csv);
  return applyMapping(parsed.rows, guessMapping(parsed.headers), options);
};
describe('commute import/export compatibility', () => {
  it('preserves total minutes through native CSV and the actual guided import mapper', () => {
    const csv = buildCsv([{ ...emptySession(1_800_000_000_000), travelMinutes: 55, durationMinutes: 120, buyIn: 100, cashOut: 160 }]);
    expect(parseCsv(csv).sessions[0].travelMinutes).toBe(55);
    const result = mapped(csv);
    expect(result.skipped).toBe(0);
    expect(result.sessions[0]).toMatchObject({ travelMinutes: 55, durationMinutes: 120, buyIn: 100, cashOut: 160 });
  });
  it('keeps legacy CSVs without commute compatible and maps the new label', () => {
    expect(mapped('Date,BuyIn,CashOut\n2026-10-10,100,150').sessions[0].travelMinutes).toBe(0);
    expect(mapped('Date,CommuteMinutes\n2026-10-10,35').sessions[0].travelMinutes).toBe(35);
  });
  it('skips invalid mapped commute rows rather than silently altering them', () => {
    const result = mapped('Date,TravelMinutes\n2026-10-10,-15\n2026-10-10,1.5\n2026-10-10,\n2026-10-10,0');
    expect(result.skipped).toBe(2);
    expect(result.sessions.map(s => s.travelMinutes)).toEqual([0, 0]);
  });
  it('round-trips session totals and recovered legacy travel through JSON', () => {
    const fixture: Backup = { settings: { ...DEFAULT_SETTINGS, travelInHourly: true, travelLog: [
      { id: 7, time: 1_800_000_000_000, location: 'Synthetic', minutes: 0, legacyDriveStartedAt: 1_800_000_000_000 },
      { id: 9, time: 1_800_000_060_000, location: 'Manual', minutes: 25 },
    ] }, sessions: [{ ...emptySession(1_800_000_000_000), travelMinutes: 35, durationMinutes: 120, sourceLiveStartedAt: 1_800_000_000_000 }],
      transactions: [], bets: [], handNotes: [], homeGames: [], structures: [], events: [], venues: [], stakes: [], wallets: [], playerNotes: [] };
    const restored = backupFromJson(backupToJson(fixture, 1_800_000_000_000));
    expect(restored.sessions[0]).toMatchObject({ travelMinutes: 35, durationMinutes: 120, sourceLiveStartedAt: 1_800_000_000_000 });
    expect(restored.settings.travelInHourly).toBe(true);
    expect(restored.settings.travelLog.map(({ id: _, ...row }) => row)).toEqual(fixture.settings.travelLog.map(({ id: _, ...row }) => row));
  });
});
