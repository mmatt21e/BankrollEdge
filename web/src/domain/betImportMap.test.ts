import { describe, it, expect } from 'vitest';
import {
  analyzeCsv,
} from './importMap';
import {
  guessBetMapping,
  applyBetMapping,
  parseOdds,
  BetImportOptions,
} from './betImportMap';
import { betProfit, effectiveOdds } from './bets';

const OPTS: BetImportOptions = {
  dateFormat: 'AUTO',
  oddsFormat: 'AUTO',
  defaultCurrency: 'USD',
};

describe('parseOdds', () => {
  it('auto-detects American vs decimal', () => {
    expect(parseOdds('+150', 'AUTO')).toBeCloseTo(2.5, 6);
    expect(parseOdds('-110', 'AUTO')).toBeCloseTo(1.9091, 3);
    expect(parseOdds('2.50', 'AUTO')).toBeCloseTo(2.5, 6);
    expect(parseOdds('150', 'AUTO')).toBeCloseTo(2.5, 6); // no sign but >=100 → American
    expect(parseOdds('', 'AUTO')).toBe(0);
  });
  it('honors a forced format', () => {
    expect(parseOdds('150', 'DECIMAL')).toBeCloseTo(150, 6);
    expect(parseOdds('150', 'AMERICAN')).toBeCloseTo(2.5, 6);
    expect(parseOdds('1.91', 'DECIMAL')).toBeCloseTo(1.91, 6);
  });
});

describe('guessBetMapping', () => {
  it('matches common sportsbook headers', () => {
    const headers = ['Date Placed', 'Sport', 'Selection', 'Odds', 'Stake', 'Result', 'Sportsbook'];
    const m = guessBetMapping(headers);
    expect(m.placedAt).toBe(0);
    expect(m.sport).toBe(1);
    expect(m.pick).toBe(2);
    expect(m.odds).toBe(3);
    expect(m.stake).toBe(4);
    expect(m.status).toBe(5);
    expect(m.sportsbook).toBe(6);
  });
  it("maps BankrollEdge's own bet export headers", () => {
    const { headers } = analyzeCsv(
      'PlacedAt,Sport,Event,Pick,BetType,Status,OddsDecimal,Stake,Profit,Sportsbook\n',
    );
    const m = guessBetMapping(headers);
    expect(m.placedAt).toBe(0);
    expect(m.status).toBe(5);
    expect(m.odds).toBe(6);
    expect(m.stake).toBe(7);
    expect(m.net).toBe(8);
  });
});

describe('applyBetMapping', () => {
  it('imports American odds with won/lost results', () => {
    const csv =
      'Date,Sport,Pick,Odds,Stake,Result\n' +
      '01/05/2026,NFL,Chiefs -3.5,-110,100,Won\n' +
      '01/06/2026,NBA,Lakers ML,+120,50,Lost\n';
    const { headers, rows } = analyzeCsv(csv);
    const m = guessBetMapping(headers);
    const { bets, skipped } = applyBetMapping(rows, m, OPTS);
    expect(skipped).toBe(0);
    expect(bets).toHaveLength(2);
    expect(bets[0].sport).toBe('NFL');
    expect(bets[0].status).toBe('WON');
    expect(effectiveOdds(bets[0])).toBeCloseTo(1.9091, 3);
    expect(betProfit(bets[0])).toBeCloseTo(90.909, 2);
    expect(bets[1].status).toBe('LOST');
    expect(betProfit(bets[1])).toBeCloseTo(-50, 6);
  });

  it('makes betProfit reproduce a mapped net exactly (odds back-filled)', () => {
    const csv = 'Date,Stake,Status,Net\n2026-02-01 12:00,100,Won,250\n';
    const m = guessBetMapping(analyzeCsv(csv).headers);
    const { bets } = applyBetMapping(analyzeCsv(csv).rows, m, OPTS);
    expect(bets[0].status).toBe('WON');
    expect(betProfit(bets[0])).toBeCloseTo(250, 6);
    expect(bets[0].stake).toBe(100); // stake preserved
  });

  it('derives status from a net column when no result column exists', () => {
    const csv = 'Date,Stake,Profit\n2026-03-01 12:00,100,60\n2026-03-02 12:00,100,-100\n';
    const m = guessBetMapping(analyzeCsv(csv).headers);
    const { bets } = applyBetMapping(analyzeCsv(csv).rows, m, OPTS);
    expect(bets[0].status).toBe('WON');
    expect(betProfit(bets[0])).toBeCloseTo(60, 6);
    expect(bets[1].status).toBe('LOST');
    expect(betProfit(bets[1])).toBeCloseTo(-100, 6);
  });

  it('reads decimal odds when told to', () => {
    const csv = 'Date,Odds,Stake,Result\n2026-04-01 12:00,2.50,40,Won\n';
    const m = guessBetMapping(analyzeCsv(csv).headers);
    const { bets } = applyBetMapping(analyzeCsv(csv).rows, m, { ...OPTS, oddsFormat: 'DECIMAL' });
    expect(effectiveOdds(bets[0])).toBeCloseTo(2.5, 6);
    expect(betProfit(bets[0])).toBeCloseTo(60, 6); // 40 * 1.5
  });

  it('fuzzily classifies sport, bet type and status', () => {
    const csv =
      'Date,Sport,Market,Status,Stake,Odds\n' +
      '2026-05-01 12:00,Basketball,Moneyline,W,100,-110\n' +
      '2026-05-02 12:00,Hockey,Total,push,100,-110\n';
    const m = guessBetMapping(analyzeCsv(csv).headers);
    const { bets } = applyBetMapping(analyzeCsv(csv).rows, m, OPTS);
    expect(bets[0].sport).toBe('NBA');
    expect(bets[0].betType).toBe('MONEYLINE');
    expect(bets[0].status).toBe('WON');
    expect(bets[1].sport).toBe('NHL');
    expect(bets[1].betType).toBe('TOTAL');
    expect(bets[1].status).toBe('PUSH');
    expect(betProfit(bets[1])).toBe(0);
  });

  it('skips rows with unreadable dates and applies the default currency', () => {
    const csv = 'Date,Stake,Status\n2026-01-01 12:00,100,Won\nTBD,100,Won\n';
    const m = guessBetMapping(analyzeCsv(csv).headers);
    const { bets, skipped, total } = applyBetMapping(analyzeCsv(csv).rows, m, {
      ...OPTS,
      defaultCurrency: 'GBP',
    });
    expect(bets).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(total).toBe(2);
    expect(bets[0].currency).toBe('GBP');
  });
});
