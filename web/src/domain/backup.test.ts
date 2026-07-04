// Port of Android BackupManagerTest.
import { describe, it, expect } from 'vitest';
import { backupToJson, backupFromJson } from './backup';
import { emptySession, profit, signedAmount } from '../models/types';

describe('backup', () => {
  it('round-trips sessions, transactions and settings', () => {
    const backup = {
      settings: {
        startingBankroll: 1500,
        currency: 'EUR',
        defaultSessionType: 'CASH' as const,
      },
      sessions: [
        {
          ...emptySession(1_700_000_123_456),
          id: 42,
          sessionType: 'TOURNAMENT' as const,
          location: 'Vegas, NV',
          notes: 'line1\nline2 "quoted"',
          buyIn: 150,
          cashOut: 900,
          position: 3,
          fieldSize: 220,
          durationMinutes: 340,
        },
      ],
      transactions: [
        {
          id: 7,
          type: 'WITHDRAWAL' as const,
          amount: 250,
          time: 1_700_000_999_999,
          note: 'rent',
        },
      ],
    };

    const restored = backupFromJson(backupToJson(backup, 1));

    expect(restored.settings).toEqual(backup.settings);
    expect(restored.sessions).toHaveLength(1);
    const s = restored.sessions[0];
    expect(s.id).toBe(0); // ids re-assigned on restore
    expect(s.location).toBe('Vegas, NV');
    expect(s.notes).toBe('line1\nline2 "quoted"');
    expect(profit(s)).toBeCloseTo(750, 9);
    expect(s.position).toBe(3);
    expect(s.durationMinutes).toBe(340);

    const t = restored.transactions[0];
    expect(signedAmount(t)).toBeCloseTo(-250, 9);
    expect(t.note).toBe('rent');
  });

  it('rejects foreign JSON', () => {
    expect(() => backupFromJson('{"app":"SomethingElse","sessions":[]}')).toThrow(
      /Not a BankrollEdge backup/,
    );
  });
});
