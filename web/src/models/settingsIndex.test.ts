import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { SETTINGS_INDEX, searchSettings } from './settingsIndex';

describe('settings search index', () => {
  it('every entry points at a settings-owned route and lowercase keywords', () => {
    for (const e of SETTINGS_INDEX) {
      expect(e.route.startsWith('/'), e.label).toBe(true);
      for (const k of e.keywords) expect(k, `${e.label}: ${k}`).toBe(k.toLowerCase());
    }
  });

  it('finds settings by label, ranking label matches first', () => {
    const hits = searchSettings('pin', DEFAULT_SETTINGS);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toBe('PIN lock');
  });

  it('finds settings by keyword (phone-search style)', () => {
    expect(searchSettings('dark', DEFAULT_SETTINGS).map((e) => e.label)).toContain('Theme');
    expect(searchSettings('blur', DEFAULT_SETTINGS).map((e) => e.label)).toContain('Hide balances');
    expect(searchSettings('pokerbase', DEFAULT_SETTINGS).map((e) => e.label)).toContain('CSV import');
  });

  it('requires every word to match', () => {
    const hits = searchSettings('odds format', DEFAULT_SETTINGS);
    expect(hits.map((e) => e.label)).toEqual(['Odds format']);
    expect(searchSettings('odds zebra', DEFAULT_SETTINGS)).toHaveLength(0);
  });

  it('hides feature-gated settings when the feature is off', () => {
    const noSports = { ...DEFAULT_SETTINGS, showSports: false };
    expect(searchSettings('odds format', noSports)).toHaveLength(0);
    const noPoker = { ...DEFAULT_SETTINGS, showPoker: false };
    expect(searchSettings('card deck', noPoker)).toHaveLength(0);
    // Session-gated venues survive as long as either session feature is on.
    expect(searchSettings('venues', noPoker).map((e) => e.label)).toContain('Saved venues');
  });

  it('returns nothing for an empty query', () => {
    expect(searchSettings('   ', DEFAULT_SETTINGS)).toHaveLength(0);
  });
});
