import { describe, it, expect } from 'vitest';
import { signedUnitsOrMoney } from './format';

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
