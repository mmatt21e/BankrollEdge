// Grew out of the Android SessionFilterTest port; now covers the
// multi-select filter model behind the Filters sheet.
import { describe, it, expect } from 'vitest';
import { EMPTY_FILTER, activeFilterCount, applyFilter, rangeStart } from './filter';
import { Session, emptySession } from '../models/types';

const NOW = 1_700_000_000_000;

const sessions: Session[] = [
  {
    ...emptySession(NOW - 1_000_000),
    id: 1,
    sessionType: 'CASH',
    gameType: 'NLH',
    location: 'Bellagio',
    notes: 'great table',
    smallBlind: 1,
    bigBlind: 3,
    currency: 'USD',
    tableSize: 9,
    tags: ['deep'],
  },
  {
    ...emptySession(NOW - 90 * 24 * 3_600_000),
    id: 2,
    sessionType: 'TOURNAMENT',
    gameType: 'PLO',
    location: 'Home game',
    currency: 'EUR',
  },
  {
    ...emptySession(NOW - 2_000_000),
    id: 3,
    sessionType: 'TABLE',
    tableGame: 'BLACKJACK',
    location: 'Bellagio',
    currency: 'USD',
  },
];

describe('applyFilter', () => {
  it('passes everything with no criteria', () => {
    expect(applyFilter(EMPTY_FILTER, sessions, NOW)).toHaveLength(3);
  });

  it('filters by session categories (multi)', () => {
    const out = applyFilter({ ...EMPTY_FILTER, types: ['CASH', 'TABLE'] }, sessions, NOW);
    expect(out.map((s) => s.id)).toEqual([1, 3]);
  });

  it('filters by poker game and by table game, together as an OR', () => {
    expect(applyFilter({ ...EMPTY_FILTER, games: ['NLH'] }, sessions, NOW).map((s) => s.id)).toEqual([1]);
    expect(applyFilter({ ...EMPTY_FILTER, tableGames: ['BLACKJACK'] }, sessions, NOW).map((s) => s.id)).toEqual([3]);
    expect(
      applyFilter({ ...EMPTY_FILTER, games: ['NLH'], tableGames: ['BLACKJACK'] }, sessions, NOW).map((s) => s.id),
    ).toEqual([1, 3]);
  });

  it('filters by date range', () => {
    const out = applyFilter({ ...EMPTY_FILTER, range: 'LAST_30' }, sessions, NOW);
    expect(out.map((s) => s.id)).toEqual([1, 3]);
  });

  it('filters by venues, currencies, stakes, table size and tags', () => {
    expect(applyFilter({ ...EMPTY_FILTER, locations: ['Bellagio'] }, sessions, NOW)).toHaveLength(2);
    expect(applyFilter({ ...EMPTY_FILTER, currencies: ['EUR'] }, sessions, NOW).map((s) => s.id)).toEqual([2]);
    expect(applyFilter({ ...EMPTY_FILTER, stakes: ['1/3'] }, sessions, NOW).map((s) => s.id)).toEqual([1]);
    expect(applyFilter({ ...EMPTY_FILTER, tableSizes: [9] }, sessions, NOW).map((s) => s.id)).toEqual([1]);
    expect(applyFilter({ ...EMPTY_FILTER, tags: ['deep'] }, sessions, NOW).map((s) => s.id)).toEqual([1]);
  });

  it('filters by the weekday the session started', () => {
    const monday = new Date(2026, 6, 20, 19, 0).getTime(); // a Monday
    const list = [{ ...emptySession(monday), id: 9 }];
    expect(applyFilter({ ...EMPTY_FILTER, weekdays: [0] }, list, monday)).toHaveLength(1);
    expect(applyFilter({ ...EMPTY_FILTER, weekdays: [3] }, list, monday)).toHaveLength(0);
  });

  it('matches query against venue, notes and game, case-insensitively', () => {
    expect(applyFilter({ ...EMPTY_FILTER, query: 'bellagio' }, sessions, NOW)).toHaveLength(2);
    expect(applyFilter({ ...EMPTY_FILTER, query: 'GREAT' }, sessions, NOW)[0].id).toBe(1);
    expect(applyFilter({ ...EMPTY_FILTER, query: 'omaha' }, sessions, NOW)[0].id).toBe(2);
    expect(applyFilter({ ...EMPTY_FILTER, query: 'xyzzy' }, sessions, NOW)).toHaveLength(0);
  });

  it('applies combined criteria together', () => {
    const out = applyFilter(
      { ...EMPTY_FILTER, types: ['TOURNAMENT'], query: 'home' },
      sessions,
      NOW,
    );
    expect(out.map((s) => s.id)).toEqual([2]);
  });
});

describe('ranges and counting', () => {
  it('computes range starts', () => {
    expect(rangeStart('ALL', NOW)).toBeNull();
    expect(rangeStart('LAST_30', NOW)).toBe(NOW - 30 * 24 * 3_600_000);
    const ytd = new Date(rangeStart('YTD', NOW)!);
    expect([ytd.getMonth(), ytd.getDate()]).toEqual([0, 1]);
  });

  it('counts active dimensions for the badge', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(
      activeFilterCount({ ...EMPTY_FILTER, types: ['CASH'], range: 'YTD', tags: ['a', 'b'] }),
    ).toBe(3);
  });
});
