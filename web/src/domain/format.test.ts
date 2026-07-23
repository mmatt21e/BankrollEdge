import { describe, it, expect } from 'vitest';
import {
  compactMoney,
  currencySymbol,
  duration,
  elapsedClock,
  hourLabel,
  money,
  ordinal,
  signedUnitsOrMoney,
  toDateInput,
  toTimeInput,
} from './format';

describe('signedUnitsOrMoney', () => {
  it('shows money when unit display is off', () => {
    expect(signedUnitsOrMoney(150, 'USD', false, 25)).toBe('+$150.00');
  });

  it('shows units when enabled and a unit value is set', () => {
    expect(signedUnitsOrMoney(150, 'USD', true, 25)).toBe('+6u');
    expect(signedUnitsOrMoney(-50, 'USD', true, 25)).toBe('-2u');
  });

  it('falls back to money when the unit value is zero', () => {
    expect(signedUnitsOrMoney(150, 'USD', true, 0)).toBe('+$150.00');
  });
});

describe('money & compactMoney', () => {
  it('formats currency with two decimals and survives bad codes', () => {
    expect(money(1234.5, 'USD')).toBe('$1,234.50');
    expect(money(10, 'NOT_A_CODE')).toContain('10'); // falls back, never throws
  });

  it('compacts chart labels', () => {
    expect(compactMoney(850, 'USD')).toBe('$850');
    expect(compactMoney(1234, 'USD')).toBe('$1.2k');
    expect(compactMoney(-3_400_000, 'USD')).toBe('-$3.4M');
  });
});

describe('currencySymbol', () => {
  it('returns the symbol, defaulting to $ on bad codes', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('NOT_A_CODE')).toBe('$');
  });
});

describe('duration & clocks', () => {
  it('renders minutes as h/m', () => {
    expect(duration(45)).toBe('45m');
    expect(duration(120)).toBe('2h');
    expect(duration(200)).toBe('3h 20m');
  });

  it('renders the live timer as hh:mm:ss and clamps negatives', () => {
    expect(elapsedClock(3_723_000)).toBe('01:02:03');
    expect(elapsedClock(-5000)).toBe('00:00:00');
  });

  it('labels chart hours', () => {
    expect(hourLabel(0)).toBe('12a');
    expect(hourLabel(11)).toBe('11a');
    expect(hourLabel(12)).toBe('12p');
    expect(hourLabel(23)).toBe('11p');
  });
});

describe('ordinal', () => {
  it('handles the teens specially', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(103)).toBe('103rd');
  });
});

describe('date/time input values', () => {
  it('round-trips local dates into input formats', () => {
    const t = new Date(2026, 6, 4, 19, 5).getTime(); // local time on purpose
    expect(toDateInput(t)).toBe('2026-07-04');
    expect(toTimeInput(t)).toBe('19:05');
  });
});
