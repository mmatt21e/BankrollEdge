// Port of Android BackupManagerTest.
import { describe, it, expect } from 'vitest';
import { backupToJson, backupFromJson } from './backup';
import { DEFAULT_SETTINGS, emptyBet, emptySession, profit, signedAmount } from '../models/types';

describe('backup', () => {
  it('round-trips sessions, transactions and settings', () => {
    const backup = {
      settings: {
        ...DEFAULT_SETTINGS,
        startingBankroll: 1500,
        currency: 'EUR',
        defaultSessionType: 'CASH' as const,
        betUnitValue: 50,
        oddsFormat: 'DECIMAL' as const,
        separateBankrolls: true,
        startingSportsBankroll: 200,
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
      venues: [{ id: 5, name: 'Bellagio' }],
      stakes: [
        { id: 1, kind: 'POKER' as const, smallBlind: 1, bigBlind: 2, minBet: 0, maxBet: 0 },
        { id: 2, kind: 'TABLE' as const, smallBlind: 0, bigBlind: 0, minBet: 25, maxBet: 5000 },
      ],
      wallets: [
        { id: 1, name: 'Caesars card', kind: 'CASINO' as const, balance: 250, currency: 'USD', notes: '', updatedAt: 1_700_000_000_000 },
      ],
      playerNotes: [
        { id: 1, name: 'Rich', notes: 'overfolds rivers', updatedAt: 1_700_000_000_000 },
      ],
      bets: [
        {
          ...emptyBet(1_700_000_222_000),
          id: 9,
          sport: 'NFL' as const,
          pick: 'Chiefs -3.5',
          betType: 'SPREAD' as const,
          odds: 1.9091,
          stake: 110,
          status: 'WON' as const,
          sportsbook: 'DraftKings',
          legs: [],
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

    // Tool collections round-trip too (ids re-assigned on restore).
    expect(restored.handNotes).toHaveLength(1);
    expect(restored.handNotes[0].holeCards).toBe('Ah Kh');
    expect(restored.handNotes[0].reviewLater).toBe(true);
    expect(restored.homeGames[0].players[0].paymentMethod).toBe('VENMO');

    // Saved venues and stakes presets round-trip (ids re-assigned on restore).
    expect(restored.venues).toHaveLength(1);
    expect(restored.venues[0].name).toBe('Bellagio');
    expect(restored.venues[0].id).toBe(0);
    expect(restored.stakes).toHaveLength(2);
    expect(restored.stakes.find((s) => s.kind === 'POKER')?.bigBlind).toBe(2);
    expect(restored.stakes.find((s) => s.kind === 'TABLE')?.maxBet).toBe(5000);

    // Wallets and player notes round-trip (ids re-assigned on restore).
    expect(restored.wallets).toHaveLength(1);
    expect(restored.wallets[0].balance).toBe(250);
    expect(restored.playerNotes[0].notes).toBe('overfolds rivers');

    expect(restored.bets).toHaveLength(1);
    expect(restored.bets[0].id).toBe(0);
    expect(restored.bets[0].pick).toBe('Chiefs -3.5');
    expect(restored.bets[0].status).toBe('WON');
    expect(restored.bets[0].stake).toBe(110);
  });

  it('round-trips quick links and drops malformed ones', () => {
    const backup = {
      settings: {
        ...DEFAULT_SETTINGS,
        quickLinks: [
          { id: 3, name: 'WSOPC', url: 'https://wsop.com', emoji: '🏆' },
        ],
      },
      sessions: [], transactions: [], bets: [], handNotes: [], homeGames: [],
      structures: [], events: [], venues: [], stakes: [], wallets: [], playerNotes: [],
    };
    const restored = backupFromJson(backupToJson(backup, 1));
    expect(restored.settings.quickLinks).toEqual([
      { id: 1, name: 'WSOPC', url: 'https://wsop.com', emoji: '🏆' },
    ]);
    const tampered = JSON.parse(backupToJson(backup, 1));
    tampered.settings.quickLinks = ['junk', { name: 'no url' }, { url: 'https://ok.io' }];
    expect(backupFromJson(JSON.stringify(tampered)).settings.quickLinks).toEqual([
      { id: 2, name: '', url: 'https://ok.io', emoji: '🔗' }, // ids re-assigned on restore
    ]);
  });

  it('round-trips bounty winnings', () => {
    const backup = {
      settings: { ...DEFAULT_SETTINGS },
      sessions: [
        {
          ...emptySession(1_700_000_123_456),
          id: 1,
          sessionType: 'TOURNAMENT' as const,
          buyIn: 100,
          cashOut: 0,
          bountyPerBounty: 50,
          bountyCount: 3,
        },
      ],
      transactions: [],
      bets: [],
      handNotes: [],
      homeGames: [],
      structures: [],
      events: [],
      venues: [],
      stakes: [],
      wallets: [],
      playerNotes: [],
    };
    const restored = backupFromJson(backupToJson(backup, 1));
    const s = restored.sessions[0];
    expect(s.bountyPerBounty).toBe(50);
    expect(s.bountyCount).toBe(3);
    expect(profit(s)).toBeCloseTo(50, 9); // 3×50 bounties − 100 buy-in
  });

  it('round-trips the travel log and drops malformed entries', () => {
    const backup = {
      settings: {
        ...DEFAULT_SETTINGS,
        travelLog: [{ id: 7, time: 1_700_000_000_000, minutes: 35, location: 'Bellagio' }],
      },
      sessions: [],
      transactions: [],
      bets: [],
      handNotes: [],
      homeGames: [],
      structures: [],
      events: [],
      venues: [],
      stakes: [],
      wallets: [],
      playerNotes: [],
    };
    const restored = backupFromJson(backupToJson(backup, 1));
    expect(restored.settings.travelLog).toEqual([
      { id: 1, time: 1_700_000_000_000, minutes: 35, location: 'Bellagio' }, // id re-assigned
    ]);

    const tampered = JSON.parse(backupToJson(backup, 1));
    tampered.settings.travelLog = ['junk', { minutes: 10 }, { time: 5, minutes: 0 }];
    expect(backupFromJson(JSON.stringify(tampered)).settings.travelLog).toEqual([]);
  });

  it('round-trips straddle fields and defaults foreign values to NONE', () => {
    const backup = {
      settings: { ...DEFAULT_SETTINGS },
      sessions: [
        {
          ...emptySession(1_700_000_123_456),
          id: 1,
          straddle: 'MANDATORY' as const,
          straddleMin: 10,
          straddleMax: 25,
          travelMinutes: 45,
        },
      ],
      transactions: [],
      bets: [],
      handNotes: [],
      homeGames: [],
      structures: [],
      events: [],
      venues: [],
      stakes: [],
      wallets: [],
      playerNotes: [],
    };
    const restored = backupFromJson(backupToJson(backup, 1));
    expect(restored.sessions[0].straddle).toBe('MANDATORY');
    expect(restored.sessions[0].straddleMin).toBe(10);
    expect(restored.sessions[0].straddleMax).toBe(25);
    expect(restored.sessions[0].travelMinutes).toBe(45);

    // A hand-edited or pre-straddle backup falls back to no straddling.
    const tampered = JSON.parse(backupToJson(backup, 1));
    tampered.sessions[0].straddle = 'SOMETIMES';
    expect(backupFromJson(JSON.stringify(tampered)).sessions[0].straddle).toBe('NONE');
    delete tampered.sessions[0].straddle;
    expect(backupFromJson(JSON.stringify(tampered)).sessions[0].straddle).toBe('NONE');
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
    expect(restored.venues).toEqual([]);
    expect(restored.stakes).toEqual([]);
    expect(restored.bets).toEqual([]);
    expect(restored.settings.betUnitValue).toBe(0);
    expect(restored.settings.oddsFormat).toBe('AMERICAN');
  });

  it('rejects foreign JSON', () => {
    expect(() => backupFromJson('{"app":"SomethingElse","sessions":[]}')).toThrow(
      /Not a BankrollEdge backup/,
    );
  });

  it('sanitizes hand-edited data: bad enums, missing timestamps, junk collections', () => {
    const restored = backupFromJson(
      JSON.stringify({
        app: 'BankrollEdge',
        version: 4,
        settings: {},
        sessions: [
          { startTime: 1_700_000_000_000, gameQuality: 'great', sleep: 'nope' },
          { gameQuality: 'GOOD' }, // no startTime → dropped
        ],
        transactions: [],
        bets: [],
        handNotes: ['not-an-object', 42],
        homeGames: [{ name: 'No players array' }],
        structures: [{ name: 'No levels array' }],
        events: [],
        venues: [null],
        stakes: [],
      }),
    );
    expect(restored.sessions).toHaveLength(1);
    expect(restored.sessions[0].gameQuality).toBe(''); // lowercase 'great' rejected
    expect(restored.sessions[0].sleep).toBe('');
    expect(restored.handNotes).toEqual([]);
    expect(restored.venues).toEqual([]);
    expect(restored.homeGames[0].players).toEqual([]);
    expect(restored.structures[0].levels).toEqual([]);
  });
});

describe('table game backup fields', () => {
  it('round-trips table fields and rejects unknown table games', () => {
    const backup = {
      settings: { ...DEFAULT_SETTINGS },
      sessions: [
        {
          ...emptySession(1_700_000_123_456),
          id: 1,
          sessionType: 'TABLE' as const,
          tableGame: 'BACCARAT' as const,
          tableMinBet: 25,
          tableMaxBet: 5000,
          unitValue: 50,
          unitsMin: 1,
          unitsMax: 8,
          buyIn: 500,
          cashOut: 650,
        },
      ],
      transactions: [],
      bets: [],
      handNotes: [],
      homeGames: [],
      structures: [],
      events: [],
      venues: [],
      stakes: [],
      wallets: [],
      playerNotes: [],
    };
    const restored = backupFromJson(backupToJson(backup, 1_700_000_000_000));
    const s = restored.sessions[0];
    expect(s.sessionType).toBe('TABLE');
    expect(s.tableGame).toBe('BACCARAT');
    expect(s.tableMinBet).toBe(25);
    expect(s.tableMaxBet).toBe(5000);
    expect(s.unitValue).toBe(50);
    expect(s.unitsMin).toBe(1);
    expect(s.unitsMax).toBe(8);
    expect(profit(s)).toBeCloseTo(150, 9);

    // An unknown table game name is kept verbatim (custom user-added games),
    // while an empty one falls back to the model default.
    const tampered = JSON.parse(backupToJson(backup, 1_700_000_000_000));
    tampered.sessions[0].tableGame = 'SIC_BO_FUTURE';
    const reread = backupFromJson(JSON.stringify(tampered));
    expect(reread.sessions[0].tableGame).toBe('SIC_BO_FUTURE');
    tampered.sessions[0].tableGame = '';
    const rereadEmpty = backupFromJson(JSON.stringify(tampered));
    expect(rereadEmpty.sessions[0].tableGame).toBe('BLACKJACK');
  });
});
