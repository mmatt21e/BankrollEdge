import { describe, it, expect } from 'vitest';
import { harvestCustomGames, harvestStakes, harvestVenues } from './importHarvest';
import { Session, StakePreset, Venue, emptySession } from '../models/types';

const T0 = 1_700_000_000_000;
const make = (opts: Partial<Session>): Session => ({ ...emptySession(T0), ...opts });

describe('harvestVenues', () => {
  it('returns distinct new venues not already saved (case-insensitive)', () => {
    const imported = [
      make({ location: 'Bellagio' }),
      make({ location: 'Aria' }),
      make({ location: 'bellagio' }), // dupe of first, different case
      make({ location: '' }), // blank ignored
    ];
    const existing: Venue[] = [{ id: 1, name: 'Aria' }];
    const out = harvestVenues(imported, existing);
    expect(out.map((v) => v.name)).toEqual(['Bellagio']);
    expect(out.every((v) => v.id === 0)).toBe(true);
  });
});

describe('harvestStakes', () => {
  it('collects poker blinds and table min/max, deduped by label', () => {
    const imported = [
      make({ sessionType: 'CASH', smallBlind: 1, bigBlind: 2 }),
      make({ sessionType: 'CASH', smallBlind: 1, bigBlind: 2 }), // dupe
      make({ sessionType: 'CASH', smallBlind: 2, bigBlind: 5 }),
      make({ sessionType: 'TABLE', tableMinBet: 25, tableMaxBet: 500 }),
      make({ sessionType: 'CASH', smallBlind: 0, bigBlind: 0 }), // no stakes
    ];
    const existing: StakePreset[] = [
      { id: 1, kind: 'POKER', smallBlind: 2, bigBlind: 5, minBet: 0, maxBet: 0 },
    ];
    const out = harvestStakes(imported, existing);
    // 1/2 (new) and the 25-500 table preset; 2/5 already exists.
    expect(out).toHaveLength(2);
    expect(out.some((p) => p.kind === 'POKER' && p.smallBlind === 1 && p.bigBlind === 2)).toBe(true);
    expect(out.some((p) => p.kind === 'TABLE' && p.minBet === 25 && p.maxBet === 500)).toBe(true);
  });
});

describe('harvestCustomGames', () => {
  it('adds non-built-in game names, split by poker vs table', () => {
    const imported = [
      make({ sessionType: 'CASH', gameType: 'NLH' }), // built-in, skip
      make({ sessionType: 'CASH', gameType: 'Big O' }), // custom poker
      make({ sessionType: 'CASH', gameType: 'Big O' }), // dupe
      make({ sessionType: 'TABLE', tableGame: 'Pai Gow Tiles' }), // custom table
      make({ sessionType: 'TABLE', tableGame: 'BLACKJACK' }), // built-in, skip
    ];
    const out = harvestCustomGames(imported, [], []);
    expect(out.poker).toEqual(['Big O']);
    expect(out.table).toEqual(['Pai Gow Tiles']);
  });

  it('skips names already present in the custom lists', () => {
    const imported = [make({ sessionType: 'CASH', gameType: 'Big O' })];
    const out = harvestCustomGames(imported, ['Big O'], []);
    expect(out.poker).toEqual([]);
  });
});
