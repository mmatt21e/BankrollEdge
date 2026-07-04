// Tournament clock domain: blind structures + pure time math, kept out of the
// UI so level/rollover logic is unit-testable. The running clock stores only
// (levelIndex, levelStartedAt, pausedAt, pausedTotal) and derives the rest.
import { BlindLevel, BlindStructure } from '../models/types';

export interface ClockState {
  levelIndex: number;
  /** Epoch ms when the current level started (adjusted for pauses). */
  levelStartedAt: number;
  /** Epoch ms when paused, 0 = running. */
  pausedAt: number;
  running: boolean;
}

export const initialClock = (now: number): ClockState => ({
  levelIndex: 0,
  levelStartedAt: now,
  pausedAt: 0,
  running: true,
});

export function levelDurationMs(level: BlindLevel): number {
  return Math.max(1, level.durationMin) * 60_000;
}

/** Milliseconds left in the current level (>= 0). */
export function remainingMs(state: ClockState, level: BlindLevel, now: number): number {
  const effectiveNow = state.pausedAt > 0 ? state.pausedAt : now;
  const elapsed = effectiveNow - state.levelStartedAt;
  return Math.max(0, levelDurationMs(level) - elapsed);
}

/** True when the current level has run out and the clock should advance. */
export function shouldAdvance(state: ClockState, level: BlindLevel, now: number): boolean {
  return state.running && state.pausedAt === 0 && remainingMs(state, level, now) <= 0;
}

export function pause(state: ClockState, now: number): ClockState {
  if (state.pausedAt > 0) return state;
  return { ...state, pausedAt: now };
}

export function resume(state: ClockState, now: number): ClockState {
  if (state.pausedAt === 0) return state;
  // Shift the level start forward by the paused duration.
  return {
    ...state,
    levelStartedAt: state.levelStartedAt + (now - state.pausedAt),
    pausedAt: 0,
  };
}

export function goToLevel(state: ClockState, index: number, total: number, now: number): ClockState {
  const clamped = Math.max(0, Math.min(total - 1, index));
  return { ...state, levelIndex: clamped, levelStartedAt: now, pausedAt: state.pausedAt > 0 ? now : 0 };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** A sensible default home-game structure (20-min levels, break every 4). */
export function defaultStructure(): Omit<BlindStructure, 'id'> {
  const blinds: [number, number][] = [
    [25, 50], [50, 100], [75, 150], [100, 200],
    [150, 300], [200, 400], [300, 600], [400, 800],
    [500, 1000], [700, 1400], [1000, 2000], [1500, 3000],
  ];
  const levels: BlindLevel[] = [];
  blinds.forEach(([sb, bb], i) => {
    levels.push({ smallBlind: sb, bigBlind: bb, ante: 0, durationMin: 20, isBreak: false });
    if ((i + 1) % 4 === 0 && i < blinds.length - 1) {
      levels.push({ smallBlind: 0, bigBlind: 0, ante: 0, durationMin: 10, isBreak: true });
    }
  });
  return { name: 'Home game (20-min levels)', levels, lateRegEndLevel: 6 };
}

/** Label like "Level 4" counting only non-break levels up to `index`. */
export function playLevelNumber(levels: BlindLevel[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index && i < levels.length; i++) {
    if (!levels[i].isBreak) n++;
  }
  return n;
}
