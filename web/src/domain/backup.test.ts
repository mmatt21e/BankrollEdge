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
      handNotes: [
        {
          id: 1,
          sessionId: 42,
          createdAt: 1_700_000_500_000,
          stakes: '1/2',
          position: 'BTN',
          holeCards: 'Ah Kh',
          board: 'Qh 7d 2c',
          potSize: 320,
          actionSummary: '3-bet pot',
          result: 'Won',
          tags: ['review'],
          notes: '',
          reviewLater: true,
        },
      ],
      homeGames: [
        {
          id: 3,
          name: 'Friday game',
          date: 1_700_000_000_000,
          notes: '',
          players: [
            {
              id: 1, name: 'Amy', buyIn: 100, rebuys: 0, addOns: 0,
              cashOut: 150, paid: true, paymentMethod: 'VENMO' as const, seat: 1, notes: '',
            },
          ],
        },
      ],
      structures: [],
      events: [],
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

    // Tool collections round-trip too (ids re-assigned on restore).
    expect(restored.handNotes).toHaveLength(1);
    expect(restored.handNotes[0].holeCards).toBe('Ah Kh');
    expect(restored.handNotes[0].reviewLater).toBe(true);
    expect(restored.homeGames[0].players[0].paymentMethod).toBe('VENMO');
  });

  it('treats v1 backups (no collections) as empty collections', () => {
    const v1 = JSON.stringify({
      app: 'BankrollEdge',
      version: 1,
      settings: { startingBankroll: 0, currency: 'USD', defaultSessionType: 'ALL' },
      sessions: [],
      transactions: [],
    });
    const restored = backupFromJson(v1);
    expect(restored.handNotes).toEqual([]);
    expect(restored.homeGames).toEqual([]);
    expect(restored.structures).toEqual([]);
    expect(restored.events).toEqual([]);
  });

  it('rejects foreign JSON', () => {
    expect(() => backupFromJson('{"app":"SomethingElse","sessions":[]}')).toThrow(
      /Not a BankrollEdge backup/,
    );
  });
});
