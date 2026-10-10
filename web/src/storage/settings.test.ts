import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadActiveSessions, loadSettings, saveActiveSessions } from './settings';
import { ActiveSession, DEFAULT_SETTINGS } from '../models/types';

const DRIVE = 'bankrolledge_pending_drive';
const SETTINGS = 'bankrolledge_settings';
const ACTIVE = 'bankrolledge_active_sessions';
const T = 1_800_000_000_000;
let data: Map<string, string>;
let failSet = '', failRemove = '';
beforeEach(() => {
  data = new Map(); failSet = ''; failRemove = '';
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (key === failSet) throw new Error('Simulated quota'); data.set(key, value); },
    removeItem: (key: string) => { if (key === failRemove) throw new Error('Simulated denial'); data.delete(key); },
  });
  vi.spyOn(Date, 'now').mockReturnValue(T + 30 * 60000);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const seedDrive = (arrivedAt = 0) => data.set(DRIVE, JSON.stringify({ startedAt: T, arrivedAt, location: 'Synthetic venue' }));

describe('legacy drive recovery', () => {
  it('freezes a running drive once and preserves unrelated settings, history and drafts', () => {
    seedDrive();
    data.set(SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, currency: 'EUR', travelInHourly: true,
      travelLog: [{ id: 4, time: T - 10000, minutes: 15, location: 'Existing synthetic drive' }] }));
    data.set(ACTIVE, '[{"startedAt":1,"travelOneWayMinutes":12}]');
    const activeBefore = data.get(ACTIVE);
    const settings = loadSettings();
    expect(settings.currency).toBe('EUR');
    expect(settings.travelInHourly).toBe(true);
    expect(settings.travelLog).toHaveLength(2);
    expect(settings.travelLog[1]).toEqual({ id: 5, time: T, minutes: 30, location: 'Synthetic venue', legacyDriveStartedAt: T });
    expect(data.get(ACTIVE)).toBe(activeBefore);
    expect(data.has(DRIVE)).toBe(false);
    vi.mocked(Date.now).mockReturnValue(T + 60 * 60000);
    expect(loadSettings()).toEqual(settings);
  });
  it('preserves the recorded arrival instead of using time elapsed since then', () => {
    seedDrive(T + 12 * 60000);
    expect(loadSettings().travelLog[0].minutes).toBe(12);
  });
  it('retains a sub-minute drive even when rounded to zero', () => {
    seedDrive(T + 10000);
    expect(loadSettings().travelLog[0].minutes).toBe(0);
  });
  it('keeps the original timer if freezing fails', () => {
    seedDrive(); failSet = DRIVE;
    const original = data.get(DRIVE);
    expect(loadSettings().travelLog).toEqual([]);
    expect(data.get(DRIVE)).toBe(original);
  });
  it('keeps the frozen timer on archive failure, then retries without inflating time', () => {
    seedDrive(); failSet = SETTINGS;
    expect(loadSettings().travelLog).toEqual([]);
    expect(JSON.parse(data.get(DRIVE)!).arrivedAt).toBe(T + 30 * 60000);
    failSet = ''; vi.mocked(Date.now).mockReturnValue(T + 90 * 60000);
    expect(loadSettings().travelLog[0].minutes).toBe(30);
    expect(data.has(DRIVE)).toBe(false);
  });
  it('does not duplicate recovered history when removing the old key fails', () => {
    seedDrive(); failRemove = DRIVE;
    expect(loadSettings().travelLog).toHaveLength(1);
    expect(loadSettings().travelLog).toHaveLength(1);
    failRemove = '';
    expect(loadSettings().travelLog).toHaveLength(1);
    expect(data.has(DRIVE)).toBe(false);
  });
  it('leaves malformed timers untouched', () => {
    data.set(DRIVE, '{broken');
    expect(loadSettings().travelLog).toEqual([]);
    expect(data.get(DRIVE)).toBe('{broken');
  });
});
describe('active session commute persistence', () => {
  it.each([0, 35])('persists %i total commute minutes across reload', travelMinutes => {
    const draft = { startedAt: T, travelOneWayMinutes: 0, travelMinutes, rebuys: 0, bountyCount: 0, bountyPerBounty: 0 } as ActiveSession;
    expect(saveActiveSessions([draft])).toBe(true);
    expect(loadActiveSessions()).toEqual([draft]);
  });
  it('keeps legacy outbound minutes separate from the new total field', () => {
    data.set(ACTIVE, JSON.stringify([{ startedAt: T, travelOneWayMinutes: 15 }]));
    expect(loadActiveSessions()[0].travelOneWayMinutes).toBe(15);
    expect(loadActiveSessions()[0].travelMinutes).toBeUndefined();
  });
  it('reports persistence failure and retains the old single-session key', () => {
    failSet = ACTIVE;
    data.set('bankrolledge_active_session', JSON.stringify({ startedAt: T, travelOneWayMinutes: 15 }));
    expect(saveActiveSessions([{ startedAt: T } as ActiveSession])).toBe(false);
    expect(loadActiveSessions()[0].travelOneWayMinutes).toBe(15);
    expect(data.has('bankrolledge_active_session')).toBe(true);
  });
  it('still loads the migrated draft when retiring the old key fails', () => {
    failRemove = 'bankrolledge_active_session';
    data.set(failRemove, JSON.stringify({ startedAt: T, travelOneWayMinutes: 15 }));
    expect(loadActiveSessions()[0].travelOneWayMinutes).toBe(15);
    expect(loadActiveSessions()[0].travelOneWayMinutes).toBe(15);
    expect(data.has(ACTIVE)).toBe(true);
  });
});
