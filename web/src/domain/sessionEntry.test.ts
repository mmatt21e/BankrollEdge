import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SESSION_TYPES } from '../models/types';
import { EMPTY_FILTER } from './filter';
import { sessionEntryDefaults, sessionEntryUrl } from './sessionEntry';

const now = 1_800_000_000_000;
const paramsOf = (url: string) => new URL(url, 'https://test.invalid').searchParams;
describe('session entry context', () => {
  it('keeps the Table add action in table games despite a poker default and filter', () => {
    const params = paramsOf(sessionEntryUrl('table', { ...DEFAULT_SETTINGS, defaultSessionType: 'TOURNAMENT' },
      { ...EMPTY_FILTER, types: ['CASH'], games: ['PLO'], tableGames: ['CRAPS'] }));
    expect(sessionEntryDefaults(params, DEFAULT_SETTINGS, now)).toMatchObject({ sessionType: 'TABLE', tableGame: 'CRAPS', gameType: 'NLH' });
  });
  it('keeps the Poker add action in poker despite a table default/filter', () => {
    const params = paramsOf(sessionEntryUrl('poker', { ...DEFAULT_SETTINGS, defaultSessionType: 'TABLE' },
      { ...EMPTY_FILTER, types: ['TABLE'], games: ['PLO'] }));
    expect(sessionEntryDefaults(params, DEFAULT_SETTINGS, now)).toMatchObject({ sessionType: 'CASH', gameType: 'PLO' });
  });
  it('preserves one selected category, custom game, venue and online context', () => {
    const params = paramsOf(sessionEntryUrl('poker', DEFAULT_SETTINGS, { ...EMPTY_FILTER,
      types: ['SNG'], games: ['Custom & Mixed'], venueType: 'ONLINE', locations: ['Synthetic / table #1'], range: 'LAST_1Y' }));
    expect(sessionEntryDefaults(params, { ...DEFAULT_SETTINGS, currency: 'EUR' }, now)).toMatchObject({
      sessionType: 'SNG', gameType: 'Custom & Mixed', venueType: 'ONLINE', location: 'Synthetic / table #1', currency: 'EUR', startTime: now, durationMinutes: 0, travelMinutes: 0,
    });
    expect(params.has('start')).toBe(false);
  });
  it('does not arbitrarily choose between multiple filter values', () => {
    const params = paramsOf(sessionEntryUrl('dashboard', DEFAULT_SETTINGS, { ...EMPTY_FILTER,
      types: ['CASH','TOURNAMENT'], games: ['NLH','PLO'], locations: ['A','B'] }));
    expect(params.get('type')).toBe('CASH');expect(params.has('game')).toBe(false);expect(params.has('location')).toBe(false);
  });
  it('preserves the configured dashboard default and the table-only fallback', () => {
    expect(paramsOf(sessionEntryUrl('dashboard', { ...DEFAULT_SETTINGS, defaultSessionType: 'HOME' }, EMPTY_FILTER)).get('type')).toBe('HOME');
    expect(sessionEntryDefaults(new URLSearchParams(), { ...DEFAULT_SETTINGS, showPoker: false }, now).sessionType).toBe('TABLE');
  });
  it('infers table context from a dashboard table-game filter instead of a poker default', () => {
    const params = paramsOf(sessionEntryUrl('dashboard', { ...DEFAULT_SETTINGS, defaultSessionType: 'TOURNAMENT' }, { ...EMPTY_FILTER, tableGames: ['CRAPS'] }));
    expect(sessionEntryDefaults(params, DEFAULT_SETTINGS, now)).toMatchObject({ sessionType: 'TABLE', tableGame: 'CRAPS' });
  });
  it('infers poker context from a dashboard poker-game filter instead of a table default', () => {
    const params = paramsOf(sessionEntryUrl('dashboard', { ...DEFAULT_SETTINGS, defaultSessionType: 'TABLE' }, { ...EMPTY_FILTER, games: ['PLO'] }));
    expect(sessionEntryDefaults(params, DEFAULT_SETTINGS, now)).toMatchObject({ sessionType: 'CASH', gameType: 'PLO' });
  });
  it.each(SESSION_TYPES)('supports %s deep-link context for both creation choices', type => {
    const params = new URLSearchParams({ type, game: 'PLO5', tableGame: 'Custom table', venueType: 'ONLINE', location: 'Synthetic', start: '1799999999000', duration: '95' });
    expect(sessionEntryDefaults(params, DEFAULT_SETTINGS, now)).toMatchObject({ sessionType: type, gameType: 'PLO5', tableGame: 'Custom table', venueType: 'ONLINE', location: 'Synthetic', startTime: 1799999999000, durationMinutes: 95 });
  });
  it('falls back safely for malformed type, timestamp, duration and venue', () => {
    expect(sessionEntryDefaults(new URLSearchParams('type=bad&start=Infinity&duration=-1&venueType=bad'), DEFAULT_SETTINGS, now))
      .toMatchObject({ sessionType: 'CASH', startTime: now, durationMinutes: 0, venueType: 'LIVE' });
    expect(sessionEntryDefaults(new URLSearchParams('start=999999999999999999&duration=2.5'), DEFAULT_SETTINGS, now))
      .toMatchObject({ startTime: now, durationMinutes: 0 });
  });
  it('does not turn query parameters into automatic creation instructions', () => {
    const session = sessionEntryDefaults(new URLSearchParams('mode=live&step=previous&autoStart=true&travel=30'), DEFAULT_SETTINGS, now);
    expect(session.id).toBe(0);expect(session.travelMinutes).toBe(0);expect(session.sourceLiveStartedAt).toBeUndefined();
  });
});
