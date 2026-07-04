import { describe, it, expect } from 'vitest';
import { computeInsights } from './insights';
import { Session, emptySession } from '../models/types';

const T0 = new Date(2026, 2, 10, 19, 0).getTime(); // 7pm start
const DAY = 86_400_000;

const cash = (i: number, profitAmt: number, patch: Partial<Session> = {}): Session => ({
  ...emptySession(T0 + i * DAY),
  buyIn: 100,
  cashOut: 100 + profitAmt,
  durationMinutes: 120,
  smallBlind: 1,
  bigBlind: 2,
  location: 'Casino',
  ...patch,
});

describe('computeInsights', () => {
  it('returns nothing with too few sessions', () => {
    expect(computeInsights([cash(0, 50)], 'USD')).toHaveLength(0);
  });

  it('finds the best hourly stake/location with enough volume', () => {
    const sessions = [cash(0, 100), cash(1, 200), cash(2, 150)];
    const insights = computeInsights(sessions, 'USD');
    const best = insights.find((i) => i.id === 'best-spot');
    expect(best).toBeDefined();
    expect(best!.text).toContain('1/2 at Casino');
  });

  it('reports tournament ROI direction', () => {
    const mtts = [0, 1, 2].map((i) => ({
      ...emptySession(T0 + i * DAY),
      sessionType: 'TOURNAMENT' as const,
      buyIn: 100,
      cashOut: i === 0 ? 600 : 0, // net +300 on 300 invested
      durationMinutes: 180,
    }));
    const insight = computeInsights(mtts, 'USD').find((i) => i.id === 'mtt-roi');
    expect(insight).toBeDefined();
    expect(insight!.text).toContain('positive');
    expect(insight!.text).toContain('100.0%');
  });

  it('flags after-midnight underperformance with enough samples both sides', () => {
    const midnight = new Date(2026, 2, 10, 1, 0).getTime();
    const sessions = [
      cash(0, 100), cash(1, 100), cash(2, 100),
      ...[3, 4, 5].map((i) => cash(i, -50, { startTime: midnight + i * DAY })),
    ];
    const insight = computeInsights(sessions, 'USD').find((i) => i.id === 'late-night');
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe('bad');
    expect(insight!.text).toContain('underperforming');
  });

  it('reports live vs online when both have samples', () => {
    const sessions = [
      cash(0, 100), cash(1, 100), cash(2, 100),
      ...[3, 4, 5].map((i) => cash(i, -20, { venueType: 'ONLINE' as const })),
    ];
    const insight = computeInsights(sessions, 'USD').find((i) => i.id === 'live-online');
    expect(insight).toBeDefined();
    expect(insight!.text).toContain('better in live games');
  });

  it('reports the longest losing streak when 3+', () => {
    const sessions = [cash(0, 100), cash(1, -10), cash(2, -10), cash(3, -10), cash(4, 50)];
    const insight = computeInsights(sessions, 'USD').find((i) => i.id === 'losing-streak');
    expect(insight).toBeDefined();
    expect(insight!.text).toContain('3 sessions');
  });
});
