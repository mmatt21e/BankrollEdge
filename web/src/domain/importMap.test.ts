import { describe, it, expect } from 'vitest';
import {
  analyzeCsv,
  guessMapping,
  applyMapping,
  parseMoney,
  parseFlexibleDate,
  ImportOptions,
} from './importMap';
import { profit, isTournamentStyle } from '../models/types';

const OPTS: ImportOptions = {
  dateFormat: 'AUTO',
  defaultCurrency: 'USD',
  defaultSessionType: 'CASH',
};

describe('parseMoney', () => {
  it('strips symbols, commas and handles negatives / parentheses', () => {
    expect(parseMoney('$1,234.50')).toBeCloseTo(1234.5, 9);
    expect(parseMoney('-40')).toBe(-40);
    expect(parseMoney('(50)')).toBe(-50);
    expect(parseMoney('  €2.000  ')).toBe(2.0); // dot decimal assumed
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('n/a')).toBe(0);
  });
});

describe('parseFlexibleDate', () => {
  const ymd = (t: number) => {
    const d = new Date(t);
    return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
  };
  it('reads the native ISO format', () => {
    expect(ymd(parseFlexibleDate('2026-01-05 19:30', 'AUTO')!)).toEqual([2026, 1, 5, 19, 30]);
  });
  it('reads US M/D/Y with AM/PM', () => {
    expect(ymd(parseFlexibleDate('1/5/2026 7:30 PM', 'MDY')!)).toEqual([2026, 1, 5, 19, 30]);
  });
  it('reads D/M/Y when told to', () => {
    expect(ymd(parseFlexibleDate('05/01/2026', 'DMY')!)).toEqual([2026, 1, 5, 0, 0]);
  });
  it('auto-detects day-first when the first number exceeds 12', () => {
    expect(ymd(parseFlexibleDate('25/12/2026', 'AUTO')!)).toEqual([2026, 12, 25, 0, 0]);
  });
  it('supports 2-digit years and dot separators', () => {
    expect(ymd(parseFlexibleDate('05.01.26', 'DMY')!)).toEqual([2026, 1, 5, 0, 0]);
  });
  it('returns null for junk', () => {
    expect(parseFlexibleDate('not a date', 'AUTO')).toBeNull();
    expect(parseFlexibleDate('', 'AUTO')).toBeNull();
  });
});

describe('guessMapping', () => {
  it('matches common foreign headers', () => {
    const headers = ['Date', 'Game Type', 'Location', 'Buy In', 'Cash Out', 'Net Profit', 'Notes'];
    const m = guessMapping(headers);
    expect(m.date).toBe(0);
    expect(m.game).toBe(1);
    expect(m.location).toBe(2);
    expect(m.buyIn).toBe(3);
    expect(m.cashOut).toBe(4);
    expect(m.net).toBe(5);
    expect(m.notes).toBe(6);
  });

  it("maps BankrollEdge's own export headers", () => {
    const { headers } = analyzeCsv('Date,Type,Game,Location,Stakes,BuyIn,CashOut,Currency\n');
    const m = guessMapping(headers);
    expect(m.date).toBe(0);
    expect(m.sessionType).toBe(1);
    expect(m.game).toBe(2);
    expect(m.stakes).toBe(4);
    expect(m.buyIn).toBe(5);
    expect(m.cashOut).toBe(6);
    expect(m.currency).toBe(7);
  });

  it('does not assign one header to two fields', () => {
    const m = guessMapping(['Date', 'Amount']);
    const used = Object.values(m);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('applyMapping', () => {
  it('imports a foreign CSV with $ amounts and a net column', () => {
    const csv =
      'When,Where,Buy In,Net\n' +
      '01/05/2026,Bellagio,"$300","$240.00"\n' +
      '01/06/2026,Aria,"$500","-$150"\n';
    const { headers, rows } = analyzeCsv(csv);
    const mapping = guessMapping(headers);
    const { sessions, skipped } = applyMapping(rows, mapping, OPTS);
    expect(skipped).toBe(0);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].location).toBe('Bellagio');
    expect(sessions[0].buyIn).toBe(300);
    // Net was mapped (not cash-out) → profit reproduces the net exactly.
    expect(profit(sessions[0])).toBeCloseTo(240, 9);
    expect(profit(sessions[1])).toBeCloseTo(-150, 9);
    expect(sessions[0].currency).toBe('USD');
  });

  it('uses cash-out when both cash-out and net are present', () => {
    const csv = 'Date,BuyIn,CashOut,Net\n2026-02-01 12:00,100,450,999\n';
    const { headers, rows } = analyzeCsv(csv);
    const m = guessMapping(headers);
    const { sessions } = applyMapping(rows, m, OPTS);
    expect(sessions[0].cashOut).toBe(450);
    expect(profit(sessions[0])).toBeCloseTo(350, 9); // ignores the net column
  });

  it('splits combined stakes and converts hours to minutes', () => {
    const csv = 'Date,Stakes,Hours,BuyIn,CashOut\n2026-03-01 18:00,1/3,4.5,200,260\n';
    const { headers, rows } = analyzeCsv(csv);
    const m = guessMapping(headers);
    const { sessions } = applyMapping(rows, m, OPTS);
    expect(sessions[0].smallBlind).toBe(1);
    expect(sessions[0].bigBlind).toBe(3);
    expect(sessions[0].durationMinutes).toBe(270);
  });

  it('reads separate small/big blind columns', () => {
    const csv = 'Date,SB,BB,BuyIn,CashOut\n2026-03-02 18:00,2,5,500,700\n';
    const m = guessMapping(analyzeCsv(csv).headers);
    const { sessions } = applyMapping(analyzeCsv(csv).rows, m, OPTS);
    expect(sessions[0].smallBlind).toBe(2);
    expect(sessions[0].bigBlind).toBe(5);
  });

  it('classifies session type and game fuzzily', () => {
    const csv =
      'Date,Type,Game,BuyIn,CashOut\n' +
      '2026-04-01 10:00,Tournament,NL Holdem,100,600\n' +
      '2026-04-02 10:00,Sit n Go,PLO,50,0\n';
    const m = guessMapping(analyzeCsv(csv).headers);
    const { sessions } = applyMapping(analyzeCsv(csv).rows, m, OPTS);
    expect(sessions[0].sessionType).toBe('TOURNAMENT');
    expect(sessions[0].gameType).toBe('NLH');
    expect(sessions[1].sessionType).toBe('SNG');
    expect(sessions[1].gameType).toBe('PLO');
    expect(isTournamentStyle(sessions[1])).toBe(true);
  });

  it('skips rows with unreadable dates and counts them', () => {
    const csv = 'Date,BuyIn,CashOut\n2026-01-01 12:00,100,150\nTBD,100,150\n\n';
    const m = guessMapping(analyzeCsv(csv).headers);
    const { sessions, skipped, total } = applyMapping(analyzeCsv(csv).rows, m, OPTS);
    expect(sessions).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(total).toBe(2); // blank line ignored, not counted
  });

  it('applies the default currency and session type when unmapped', () => {
    const csv = 'Date,CashOut\n2026-05-01 12:00,80\n';
    const m = guessMapping(analyzeCsv(csv).headers);
    const { sessions } = applyMapping(analyzeCsv(csv).rows, m, {
      ...OPTS,
      defaultCurrency: 'EUR',
      defaultSessionType: 'TOURNAMENT',
    });
    expect(sessions[0].currency).toBe('EUR');
    expect(sessions[0].sessionType).toBe('TOURNAMENT');
  });
});
