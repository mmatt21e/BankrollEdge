import { describe, it, expect } from 'vitest';
import {
  initialClock,
  remainingMs,
  shouldAdvance,
  pause,
  resume,
  goToLevel,
  formatClock,
  defaultStructure,
  playLevelNumber,
} from './clock';
import { BlindLevel } from '../models/types';

const level = (durationMin: number, isBreak = false): BlindLevel => ({
  smallBlind: 25,
  bigBlind: 50,
  ante: 0,
  durationMin,
  isBreak,
});

const T0 = 1_000_000;

describe('tournament clock math', () => {
  it('counts down the level duration', () => {
    const clock = initialClock(T0);
    expect(remainingMs(clock, level(20), T0)).toBe(20 * 60_000);
    expect(remainingMs(clock, level(20), T0 + 5 * 60_000)).toBe(15 * 60_000);
    expect(remainingMs(clock, level(20), T0 + 25 * 60_000)).toBe(0);
  });

  it('advances exactly when the level expires', () => {
    const clock = initialClock(T0);
    expect(shouldAdvance(clock, level(20), T0 + 19 * 60_000)).toBe(false);
    expect(shouldAdvance(clock, level(20), T0 + 20 * 60_000)).toBe(true);
  });

  it('pause freezes the remaining time; resume shifts the level start', () => {
    let clock = initialClock(T0);
    clock = pause(clock, T0 + 5 * 60_000);
    // 10 minutes pass while paused — remaining unchanged.
    expect(remainingMs(clock, level(20), T0 + 15 * 60_000)).toBe(15 * 60_000);
    expect(shouldAdvance(clock, level(20), T0 + 60 * 60_000)).toBe(false);
    clock = resume(clock, T0 + 15 * 60_000);
    expect(remainingMs(clock, level(20), T0 + 15 * 60_000)).toBe(15 * 60_000);
    expect(remainingMs(clock, level(20), T0 + 20 * 60_000)).toBe(10 * 60_000);
  });

  it('goToLevel clamps to the structure bounds and resets the level timer', () => {
    let clock = initialClock(T0);
    clock = goToLevel(clock, 5, 3, T0 + 1000);
    expect(clock.levelIndex).toBe(2);
    expect(remainingMs(clock, level(20), T0 + 1000)).toBe(20 * 60_000);
    clock = goToLevel(clock, -2, 3, T0 + 2000);
    expect(clock.levelIndex).toBe(0);
  });

  it('formats mm:ss with padding', () => {
    expect(formatClock(20 * 60_000)).toBe('20:00');
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(0)).toBe('00:00');
  });

  it('numbers play levels skipping breaks', () => {
    const levels = [level(20), level(20), level(10, true), level(20)];
    expect(playLevelNumber(levels, 0)).toBe(1);
    expect(playLevelNumber(levels, 1)).toBe(2);
    expect(playLevelNumber(levels, 3)).toBe(3); // break not counted
  });

  it('default structure has breaks and rising blinds', () => {
    const s = defaultStructure();
    expect(s.levels.some((l) => l.isBreak)).toBe(true);
    const plays = s.levels.filter((l) => !l.isBreak);
    for (let i = 1; i < plays.length; i++) {
      expect(plays[i].bigBlind).toBeGreaterThan(plays[i - 1].bigBlind);
    }
  });
});
