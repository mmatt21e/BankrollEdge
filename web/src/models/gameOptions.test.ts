import { describe, it, expect } from 'vitest';
import { pokerGameOptions, tableGameOptions, DEFAULT_SETTINGS, AppSettings } from './types';

const settings = (patch: Partial<AppSettings> = {}): AppSettings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('pokerGameOptions with recorded games', () => {
  it('appends imported custom games not in the configured list', () => {
    const opts = pokerGameOptions(settings(), ['NLH', 'Big O', 'Chinese Poker']);
    const values = opts.map((o) => o.value);
    expect(values).toContain('Big O');
    expect(values).toContain('Chinese Poker');
    // Built-in NLH is present exactly once (not duplicated by the recorded list).
    expect(values.filter((v) => v === 'NLH')).toHaveLength(1);
    // Custom recorded games use their own name as the label.
    expect(opts.find((o) => o.value === 'Big O')?.label).toBe('Big O');
  });

  it('re-includes a recorded built-in even if the user hid it', () => {
    const opts = pokerGameOptions(settings({ hiddenPokerGames: ['STUD'] }), ['STUD']);
    const stud = opts.find((o) => o.value === 'STUD');
    expect(stud).toBeDefined();
    expect(stud?.label).toBe('Seven-Card Stud'); // built-in label, not the raw code
  });

  it('never produces duplicate values', () => {
    const opts = pokerGameOptions(
      settings({ customPokerGames: ['Home Mix'] }),
      ['NLH', 'PLO', 'Home Mix', 'Home Mix'],
    );
    const values = opts.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('is unchanged when no recorded games are passed', () => {
    expect(pokerGameOptions(settings())).toEqual(pokerGameOptions(settings(), []));
  });
});

describe('tableGameOptions with recorded games', () => {
  it('appends imported custom table games', () => {
    const opts = tableGameOptions(settings(), ['Pai Gow', 'BLACKJACK']);
    const values = opts.map((o) => o.value);
    expect(values).toContain('Pai Gow');
    expect(values.filter((v) => v === 'BLACKJACK')).toHaveLength(1);
  });
});
