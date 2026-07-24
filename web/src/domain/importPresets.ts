// One-tap import presets for popular trackers' CSV exports. A preset maps
// that app's known header names onto our import fields and fixes its date
// format; detection fingerprints the header row so the right preset can be
// suggested automatically. Anything a preset doesn't cover still goes
// through the normal header guesser and manual mapper.
import { ColumnMapping, DateFormat, MapFieldKey, guessMapping } from './importMap';

export interface ImportPreset {
  key: 'pbt' | 'pokerbase' | 'pokerincome';
  name: string;
  blurb: string;
  dateFormat: DateFormat;
  /** Lowercased source header → our field. Applied over the generic guess. */
  headerMap: Partial<Record<string, MapFieldKey>>;
  /** Fields to unmap even if the generic guesser matched them. */
  drop?: MapFieldKey[];
  /** Does this header row look like this app's export? */
  matches(headers: string[]): boolean;
}

const lower = (headers: string[]) => headers.map((h) => h.trim().toLowerCase());

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    key: 'pbt',
    name: 'Poker Bankroll Tracker',
    blurb: 'The "—PBT Bankroll Export—" CSV from pokerbankrolltracker.net.',
    dateFormat: 'YMD',
    headerMap: {
      starttime: 'date',
      playingminutes: 'durationMinutes',
      type: 'sessionType',
      game: 'game',
      limit: 'stakes',
      location: 'location',
      buyin: 'buyIn',
      // cashout is intentionally NOT mapped: PBT's netprofit is authoritative
      // (their cashout doesn't fold in expenses the way our profit does), and
      // the importer reconstructs the cash-out from net so profits match.
      netprofit: 'net',
      rebuycosts: 'rebuysAddons',
      smallblind: 'smallBlind',
      bigblind: 'bigBlind',
      currency: 'currency',
      expenses: 'expenses',
      place: 'position',
      notes: 'notes',
    },
    // cashOut: netprofit is authoritative (see headerMap comment).
    // durationHours: the generic guesser mistakes 'endtime' for a duration.
    drop: ['cashOut', 'durationHours'],
    matches: (headers) => {
      const h = lower(headers);
      return h.includes('starttime') && h.includes('playingminutes') && h.includes('netprofit');
    },
  },
  {
    key: 'pokerbase',
    name: 'Pokerbase',
    blurb: "Pokerbase's session export (date, location, expense, currency, profit).",
    dateFormat: 'AUTO',
    headerMap: {
      date: 'date',
      location: 'location',
      expense: 'expenses',
      currency: 'currency',
      profit: 'net',
    },
    matches: (headers) => {
      const h = lower(headers);
      return h.includes('profit') && h.includes('expense') && h.includes('date') && h.length <= 8;
    },
  },
  {
    key: 'pokerincome',
    name: 'Poker Income / Manager',
    blurb: 'Best-effort mapping for Poker Income-style exports.',
    dateFormat: 'AUTO',
    headerMap: {
      'session type': 'sessionType',
      'game type': 'game',
      stakes: 'stakes',
      blinds: 'stakes',
      'buy in': 'buyIn',
      'buy-in': 'buyIn',
      'cash out': 'cashOut',
      'cashed out': 'cashOut',
      duration: 'durationHours',
      minutes: 'durationMinutes',
      profit: 'net',
    },
    matches: (headers) => {
      const h = lower(headers);
      return h.some((x) => x === 'session type' || x === 'game type');
    },
  },
];

/** PBT exports start with a "—PBT Bankroll Export—" sentinel line; drop it so
 *  the real header row parses. Safe on any input. */
export function stripSentinel(text: string): string {
  const nl = text.indexOf('\n');
  if (nl < 0) return text;
  const first = text.slice(0, nl);
  return /PBT Bankroll Export/i.test(first) ? text.slice(nl + 1) : text;
}

export function detectPreset(headers: string[]): ImportPreset | null {
  return IMPORT_PRESETS.find((p) => p.matches(headers)) ?? null;
}

/** Generic guess first, then the preset's explicit header mappings on top. */
export function applyPreset(preset: ImportPreset, headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...guessMapping(headers) };
  headers.forEach((header, index) => {
    const key = preset.headerMap[header.trim().toLowerCase()];
    if (key) mapping[key] = index;
  });
  for (const key of preset.drop ?? []) delete mapping[key];
  return mapping;
}
