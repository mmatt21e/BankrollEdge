import { describe, it, expect } from 'vitest';
import { computeInsights, selectInsightWindow, INSIGHT_TARGET_SESSIONS } from './insights';
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

describe('selectInsightWindow', () => {
  const now = T0 + 400 * DAY;

  it('picks the smallest recent time window with enough sessions', () => {
    // 25 sessions in the last 10 days plus old history: the 7-day window
    // already holds 21 of them (ages 0–7 inclusive), so it wins.
    const recent = Array.from({ length: 25 }, (_, i) =>
      cash(0, 50, { startTime: now - (i % 10) * DAY }),
    );
    const old = Array.from({ length: 30 }, (_, i) => cash(i, 20));
    const w = selectInsightWindow([...recent, ...old], now);
    expect(w.sessions).toHaveLength(21);
    expect(w.label).toBe('the last 7 days (21 sessions)');
  });

  it('widens the window until there is enough volume', () => {
    // 20 sessions spread over ~5 months: 6-month window is the first fit.
    const spread = Array.from({ length: INSIGHT_TARGET_SESSIONS }, (_, i) =>
      cash(0, 50, { startTime: now - i * 7 * DAY }),
    );
    const w = selectInsightWindow(spread, now);
    expect(w.sessions).toHaveLength(INSIGHT_TARGET_SESSIONS);
    expect(w.label).toContain('6 months');
  });

  it('falls back to the last N sessions when the last year is too thin', () => {
    // 30 sessions all older than a year: the newest 20 are used.
    const old = Array.from({ length: 30 }, (_, i) =>
      cash(0, 50, { startTime: now - (400 + i * 30) * DAY }),
    );
    const w = selectInsightWindow(old, now);
    expect(w.sessions).toHaveLength(INSIGHT_TARGET_SESSIONS);
    expect(w.label).toBe(`your last ${INSIGHT_TARGET_SESSIONS} sessions`);
    // Newest-first slice: every kept session is newer than every dropped one.
    const keptOldest = Math.min(...w.sessions.map((s) => s.startTime));
    expect(keptOldest).toBe(now - (400 + 19 * 30) * DAY);
  });

  it('uses everything when there are few sessions overall', () => {
    const few = [cash(0, 50), cash(1, 50, { startTime: now - 500 * DAY })];
    const w = selectInsightWindow(few, now);
    expect(w.sessions).toHaveLength(2);
    expect(w.label).toBe('all 2 sessions');
  });
});
