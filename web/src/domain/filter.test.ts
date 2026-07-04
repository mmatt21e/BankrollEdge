// Port of Android SessionFilterTest.
import { describe, it, expect } from 'vitest';
import { EMPTY_FILTER, applyFilter } from './filter';
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
  },
  {
    ...emptySession(NOW - 90 * 24 * 3_600_000),
    id: 2,
    sessionType: 'TOURNAMENT',
    gameType: 'PLO',
    location: 'Home game',
  },
];

describe('applyFilter', () => {
  it('passes everything with no criteria', () => {
    expect(applyFilter(EMPTY_FILTER, sessions, NOW)).toHaveLength(2);
  });

  it('filters by session type', () => {
    const out = applyFilter({ ...EMPTY_FILTER, type: 'CASH' }, sessions, NOW);
    expect(out.map((s) => s.id)).toEqual([1]);
  });

  it('filters by date range', () => {
    const out = applyFilter({ ...EMPTY_FILTER, range: 'LAST_30' }, sessions, NOW);
    expect(out.map((s) => s.id)).toEqual([1]);
  });

  it('matches query against venue, notes and game, case-insensitively', () => {
    expect(applyFilter({ ...EMPTY_FILTER, query: 'bellagio' }, sessions, NOW)[0].id).toBe(1);
    expect(applyFilter({ ...EMPTY_FILTER, query: 'GREAT' }, sessions, NOW)[0].id).toBe(1);
    expect(applyFilter({ ...EMPTY_FILTER, query: 'omaha' }, sessions, NOW)[0].id).toBe(2);
    expect(applyFilter({ ...EMPTY_FILTER, query: 'xyzzy' }, sessions, NOW)).toHaveLength(0);
  });

  it('applies combined criteria together', () => {
    const out = applyFilter(
      { ...EMPTY_FILTER, type: 'TOURNAMENT', query: 'home' },
      sessions,
      NOW,
    );
    expect(out.map((s) => s.id)).toEqual([2]);
  });
});
