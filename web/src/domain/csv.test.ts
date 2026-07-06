// Port of Android CsvExporterTest + CsvImporterTest.
import { describe, it, expect } from 'vitest';
import { buildCsv, parseCsv } from './csv';
import { emptySession, profit, Session } from '../models/types';

const T0 = 1_700_000_000_000;

describe('buildCsv', () => {
  it('includes a header with a Profit column', () => {
    const header = buildCsv([]).split('\n')[0];
    expect(header.split(',')).toContain('Profit');
  });

  it('carries the net result in the Profit column', () => {
    const csv = buildCsv([
      {
        ...emptySession(T0),
        buyIn: 100,
        rebuysAddons: 50,
        cashOut: 400,
        tips: 10, // profit = 240
      },
    ]);
    const lines = csv.trim().split('\n');
    const header = lines[0].split(',');
    const row = lines[1].split(',');
    expect(row[header.indexOf('Profit')]).toBe('240');
  });

  it('escapes commas and quotes', () => {
    const csv = buildCsv([
      { ...emptySession(T0), location: 'Vegas, NV', notes: 'said "nice hand"' },
    ]);
    expect(csv).toContain('"Vegas, NV"');
    expect(csv).toContain('"said ""nice hand"""');
  });
});

describe('parseCsv', () => {
  it('round-trips our own export', () => {
    const original: Session[] = [
      {
        ...emptySession(T0),
        sessionType: 'CASH',
        gameType: 'PLO',
        location: 'Vegas, NV',
        notes: 'said "nice hand"\nsecond line',
        durationMinutes: 185,
        smallBlind: 2,
        bigBlind: 5,
        buyIn: 500,
        rebuysAddons: 200,
        cashOut: 950,
        tips: 25,
      },
      {
        ...emptySession(T0 + 100_000_000),
        sessionType: 'TOURNAMENT',
        gameType: 'NLH',
        location: 'Home',
        durationMinutes: 300,
        buyIn: 100,
        position: 15,
        fieldSize: 90,
      },
    ];
    const result = parseCsv(buildCsv(original));
    expect(result.skippedRows).toBe(0);
    expect(result.sessions).toHaveLength(2);

    const cashS = result.sessions.find((s) => s.sessionType === 'CASH')!;
    expect(cashS.location).toBe('Vegas, NV');
    expect(cashS.notes).toBe('said "nice hand"\nsecond line');
    expect(cashS.durationMinutes).toBe(185);
    expect(cashS.smallBlind).toBe(2);
    expect(cashS.bigBlind).toBe(5);
    expect(profit(cashS)).toBeCloseTo(225, 9);
    expect(cashS.gameType).toBe('PLO');

    const mtt = result.sessions.find((s) => s.sessionType === 'TOURNAMENT')!;
    expect(mtt.position).toBe(15);
    expect(mtt.fieldSize).toBe(90);
    // Start times survive to the minute (export format drops seconds).
    expect(Math.floor(mtt.startTime / 60_000)).toBe(Math.floor((T0 + 100_000_000) / 60_000));
  });

  it('skips unparseable rows instead of failing', () => {
    const csv = [
      'Date,Type,Game,Location,Stakes,DurationMinutes,BuyIn,RebuysAddons,CashOut,Tips,Profit,Position,FieldSize,Currency,Notes',
      "2026-01-15 19:30,Cash Game,No-Limit Hold'em,Casino,1/2,120,200,0,350,5,145,0,0,USD,ok",
      "not-a-date,Cash Game,No-Limit Hold'em,Casino,1/2,120,200,0,350,5,145,0,0,USD,bad",
    ].join('\n');
    const result = parseCsv(csv);
    expect(result.sessions).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });

  it('accepts reordered columns', () => {
    const result = parseCsv('BuyIn,CashOut,Date,Type\n100,400,2026-02-01 12:00,Tournament');
    expect(result.sessions[0].sessionType).toBe('TOURNAMENT');
    expect(profit(result.sessions[0])).toBeCloseTo(300, 9);
  });

  it('rejects files without a Date column', () => {
    expect(() => parseCsv('Foo,Bar\n1,2')).toThrow(/Date/);
  });
});

describe('table game sessions', () => {
  it('round-trips table game, bet range and unit sizing through CSV', () => {
    const csv = buildCsv([
      {
        ...emptySession(T0),
        sessionType: 'TABLE',
        tableGame: 'CRAPS',
        tableMinBet: 10,
        tableMaxBet: 1000,
        unitValue: 25,
        unitsMin: 1,
        unitsMax: 4,
        buyIn: 300,
        cashOut: 450,
        location: 'Bellagio',
      },
    ]);
    const result = parseCsv(csv);
    expect(result.skippedRows).toBe(0);
    const s = result.sessions[0];
    expect(s.sessionType).toBe('TABLE');
    expect(s.tableGame).toBe('CRAPS');
    expect(s.tableMinBet).toBe(10);
    expect(s.tableMaxBet).toBe(1000);
    expect(s.unitValue).toBe(25);
    expect(s.unitsMin).toBe(1);
    expect(s.unitsMax).toBe(4);
    expect(profit(s)).toBeCloseTo(150, 9);
  });

  it('leaves the TableGame column empty for poker sessions', () => {
    const csv = buildCsv([{ ...emptySession(T0), buyIn: 100, cashOut: 200 }]);
    const lines = csv.trim().split('\n');
    const header = lines[0].split(',');
    const row = lines[1].split(',');
    expect(row[header.indexOf('TableGame')]).toBe('');
  });
});
