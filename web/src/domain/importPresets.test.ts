import { describe, it, expect } from 'vitest';
import { analyzeCsv, applyMapping } from './importMap';
import { IMPORT_PRESETS, applyPreset, detectPreset, stripSentinel } from './importPresets';
import { profit } from '../models/types';

// A trimmed Poker Bankroll Tracker export (documented format: sentinel first
// line, yyyy-MM-dd HH:mm:ss dates, netprofit column).
const PBT_CSV = [
  '—PBT Bankroll Export—',
  'id,starttime,endtime,playingminutes,game,limit,location,type,buyin,cashout,netprofit,rebuycosts,smallblind,bigblind,currency,expenses,place,notes',
  '1,2026-05-04 19:30:00,2026-05-05 01:30:00,360,NL Holdem,1/3,Bellagio,Cash Game,300,520,220,0,1,3,USD,0,,good game',
  '2,2026-05-10 12:00:00,2026-05-10 20:00:00,480,NL Holdem,,Wynn,Tournament,150,0,-150,0,0,0,USD,10,45,busted',
].join('\n');

const POKERBASE_CSV = [
  'date,location,expense,currency,profit',
  '2026-06-01,Gabes,15,USD,250',
  '2026-06-03,Caesars,0,USD,-80',
].join('\n');

describe('stripSentinel', () => {
  it('drops the PBT sentinel line and leaves other files alone', () => {
    expect(stripSentinel(PBT_CSV).startsWith('id,starttime')).toBe(true);
    expect(stripSentinel(POKERBASE_CSV)).toBe(POKERBASE_CSV);
  });
});

describe('preset detection', () => {
  it('fingerprints PBT and Pokerbase exports', () => {
    const pbt = analyzeCsv(stripSentinel(PBT_CSV));
    expect(detectPreset(pbt.headers)?.key).toBe('pbt');
    const pb = analyzeCsv(POKERBASE_CSV);
    expect(detectPreset(pb.headers)?.key).toBe('pokerbase');
  });

  it('recognizes Poker Income-style headers', () => {
    expect(detectPreset(['Date', 'Session Type', 'Game Type', 'Profit'])?.key).toBe('pokerincome');
  });

  it('leaves unknown files to the generic guesser', () => {
    expect(detectPreset(['Date', 'BuyIn', 'CashOut'])).toBeNull();
  });
});

describe('PBT import end-to-end', () => {
  const { headers, rows } = analyzeCsv(stripSentinel(PBT_CSV));
  const preset = IMPORT_PRESETS.find((p) => p.key === 'pbt')!;
  const mapping = applyPreset(preset, headers);
  const result = applyMapping(rows, mapping, {
    dateFormat: preset.dateFormat,
    defaultCurrency: 'USD',
    defaultSessionType: 'CASH',
  });

  it('imports every row with the right shape', () => {
    expect(result.skipped).toBe(0);
    expect(result.sessions).toHaveLength(2);
    const cash = result.sessions[0];
    expect(cash.sessionType).toBe('CASH');
    expect(cash.durationMinutes).toBe(360);
    expect(cash.location).toBe('Bellagio');
    expect(cash.smallBlind).toBe(1);
    expect(cash.bigBlind).toBe(3);
    expect(profit(cash)).toBeCloseTo(220, 9);
    expect(new Date(cash.startTime).getFullYear()).toBe(2026);
  });

  it('reproduces tournament losses from netprofit', () => {
    const mtt = result.sessions[1];
    expect(mtt.sessionType).toBe('TOURNAMENT');
    expect(mtt.position).toBe(45);
    expect(profit(mtt)).toBeCloseTo(-150, 9);
  });
});

describe('Pokerbase import end-to-end', () => {
  const { headers, rows } = analyzeCsv(POKERBASE_CSV);
  const preset = IMPORT_PRESETS.find((p) => p.key === 'pokerbase')!;
  const mapping = applyPreset(preset, headers);
  const result = applyMapping(rows, mapping, {
    dateFormat: preset.dateFormat,
    defaultCurrency: 'USD',
    defaultSessionType: 'CASH',
  });

  it('imports profit-only rows with expenses', () => {
    expect(result.skipped).toBe(0);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].location).toBe('Gabes');
    expect(result.sessions[0].expenses).toBe(15);
    expect(profit(result.sessions[0])).toBeCloseTo(250, 9);
    expect(profit(result.sessions[1])).toBeCloseTo(-80, 9);
  });
});
