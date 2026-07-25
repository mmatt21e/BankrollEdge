import { describe, it, expect } from 'vitest';
import { emptySession, straddleLabel } from './types';

describe('straddleLabel', () => {
  it('is empty when there is no straddling', () => {
    expect(straddleLabel(emptySession(1))).toBe('');
  });

  it('shows mode alone when no amount was recorded', () => {
    expect(straddleLabel({ ...emptySession(1), straddle: 'OPTIONAL' })).toBe('Optional straddle');
  });

  it('shows a single amount or a range', () => {
    expect(
      straddleLabel({ ...emptySession(1), straddle: 'MANDATORY', straddleMin: 10 }),
    ).toBe('Mandatory straddle 10');
    expect(
      straddleLabel({ ...emptySession(1), straddle: 'OPTIONAL', straddleMin: 10, straddleMax: 25 }),
    ).toBe('Optional straddle 10–25');
    // A max at or below the min collapses to a single amount.
    expect(
      straddleLabel({ ...emptySession(1), straddle: 'OPTIONAL', straddleMin: 10, straddleMax: 10 }),
    ).toBe('Optional straddle 10');
  });
});
