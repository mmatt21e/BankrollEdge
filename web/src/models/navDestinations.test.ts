import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import {
  MAX_NAV_PINS,
  NAV_DESTINATIONS,
  navDestination,
  pinnedDestinations,
} from './navDestinations';

describe('nav destinations', () => {
  it('has unique keys and routes that start with /', () => {
    const keys = NAV_DESTINATIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of NAV_DESTINATIONS) expect(d.route.startsWith('/')).toBe(true);
  });

  it('resolves every default pin', () => {
    for (const key of DEFAULT_SETTINGS.navPins) {
      expect(navDestination(key), key).toBeDefined();
    }
    expect(pinnedDestinations(DEFAULT_SETTINGS)).toHaveLength(DEFAULT_SETTINGS.navPins.length);
  });

  it('ignores unknown keys and duplicates, and caps at the pin limit', () => {
    const pins = ['dashboard', 'dashboard', 'nope', 'poker', 'table', 'sports', 'settings', 'clock'];
    const out = pinnedDestinations({ ...DEFAULT_SETTINGS, navPins: pins });
    expect(out.map((d) => d.key)).toEqual(['dashboard', 'poker', 'table', 'sports', 'settings']);
    expect(out.length).toBeLessThanOrEqual(MAX_NAV_PINS);
  });

  it('drops destinations whose feature switch is off', () => {
    const out = pinnedDestinations({
      ...DEFAULT_SETTINGS,
      showPoker: false,
      navPins: ['dashboard', 'poker', 'clock', 'sports'],
    });
    expect(out.map((d) => d.key)).toEqual(['dashboard', 'sports']);
  });
});
