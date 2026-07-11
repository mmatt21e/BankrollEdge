// Flexible CSV import with column mapping — lets users bring session history
// in from OTHER apps (Poker Bankroll Tracker, Pokerbase, RunGood, spreadsheets,
// …) whose column names and formats differ from BankrollEdge's own export.
//
// The flow: analyzeCsv() → guessMapping() (auto-match headers) → the user
// tweaks the mapping in the UI → applyMapping() turns rows into Sessions with
// tolerant value parsing (many date/money formats). Only a date is required.
import {
  Session,
  SessionType,
  GameType,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  emptySession,
  normalizeSession,
} from '../models/types';
import { tokenize, parseIso } from './csv';

export type MapFieldKey =
  | 'date'
  | 'sessionType'
  | 'game'
  | 'venueType'
  | 'location'
  | 'stakes'
  | 'smallBlind'
  | 'bigBlind'
  | 'durationMinutes'
  | 'durationHours'
  | 'buyIn'
  | 'rebuysAddons'
  | 'cashOut'
  | 'net'
  | 'tips'
  | 'expenses'
  | 'position'
  | 'fieldSize'
  | 'currency'
  | 'tags'
  | 'notes';

export type MapFieldGroup = 'Essentials' | 'Money' | 'Game details' | 'Extras';

export interface MapField {
  key: MapFieldKey;
  label: string;
  group: MapFieldGroup;
  hint?: string;
  required?: boolean;
  /** Normalized (a–z0–9 only) header aliases used for auto-guessing. */
  synonyms: string[];
}

// Order matters: more specific fields are guessed first so a generic header
// (e.g. "result") doesn't get claimed before "cashout"/"smallblind" etc.
export const MAP_FIELDS: MapField[] = [
  { key: 'date', label: 'Date / time', group: 'Essentials', required: true, hint: 'The only required column.', synonyms: ['date', 'datetime', 'sessiondate', 'dateplayed', 'day', 'starttime', 'start', 'when', 'timestamp'] },
  { key: 'sessionType', label: 'Session type', group: 'Essentials', hint: 'Cash / Tournament / Sit & Go / Home / Table.', synonyms: ['type', 'sessiontype', 'format', 'category', 'gameformat'] },
  { key: 'venueType', label: 'Live / online', group: 'Essentials', synonyms: ['liveonline', 'live', 'online', 'venuetype', 'setting', 'medium'] },
  { key: 'game', label: 'Game / variant', group: 'Game details', synonyms: ['game', 'gametype', 'variant', 'gamevariant', 'gamename'] },
  { key: 'location', label: 'Location / venue', group: 'Game details', synonyms: ['location', 'venue', 'casino', 'room', 'site', 'place', 'cardroom', 'where', 'network'] },
  { key: 'stakes', label: 'Stakes (combined, e.g. 1/2)', group: 'Game details', synonyms: ['stakes', 'stake', 'blinds', 'limit', 'level', 'limits'] },
  { key: 'smallBlind', label: 'Small blind', group: 'Game details', synonyms: ['smallblind', 'sb'] },
  { key: 'bigBlind', label: 'Big blind', group: 'Game details', synonyms: ['bigblind', 'bb'] },
  { key: 'buyIn', label: 'Buy-in', group: 'Money', synonyms: ['buyin', 'buyinamount', 'bought', 'moneyin', 'invested', 'cost', 'entry'] },
  { key: 'rebuysAddons', label: 'Rebuys / add-ons', group: 'Money', synonyms: ['rebuys', 'rebuysaddons', 'rebuy', 'reentry', 'reentries', 'topup', 'addons', 'addon'] },
  { key: 'cashOut', label: 'Cash-out / ending', group: 'Money', hint: 'Amount you left with.', synonyms: ['cashout', 'cashedout', 'cashoutamount', 'moneyout', 'ending', 'endstack', 'payout', 'won', 'returns'] },
  { key: 'net', label: 'Net profit/loss', group: 'Money', hint: 'Use this if the file has profit instead of a cash-out.', synonyms: ['net', 'netprofit', 'profit', 'pl', 'profitloss', 'netresult', 'result', 'winloss', 'winnings', 'netwin', 'total'] },
  { key: 'tips', label: 'Tips / tokes', group: 'Money', synonyms: ['tips', 'tip', 'toke', 'tokes', 'gratuity'] },
  { key: 'expenses', label: 'Expenses', group: 'Money', synonyms: ['expenses', 'expense', 'costs', 'travel', 'fees'] },
  { key: 'durationMinutes', label: 'Duration (minutes)', group: 'Game details', synonyms: ['durationminutes', 'minutes', 'mins', 'durationmin', 'minsplayed'] },
  { key: 'durationHours', label: 'Duration (hours)', group: 'Game details', synonyms: ['durationhours', 'hours', 'duration', 'hrs', 'hoursplayed', 'length', 'time', 'timeplayed'] },
  { key: 'position', label: 'Finish position', group: 'Game details', synonyms: ['position', 'place', 'finish', 'finished', 'rank', 'placing'] },
  { key: 'fieldSize', label: 'Field size', group: 'Game details', synonyms: ['fieldsize', 'entrants', 'field', 'runners', 'entries', 'players'] },
  { key: 'currency', label: 'Currency', group: 'Extras', synonyms: ['currency', 'ccy', 'curr'] },
  { key: 'tags', label: 'Tags', group: 'Extras', synonyms: ['tags', 'tag', 'labels', 'label'] },
  { key: 'notes', label: 'Notes', group: 'Extras', synonyms: ['notes', 'note', 'comment', 'comments', 'description', 'memo', 'details'] },
];

/** header index each field is mapped to (absent = unmapped). */
export type ColumnMapping = Partial<Record<MapFieldKey, number>>;

export type DateFormat = 'AUTO' | 'MDY' | 'DMY' | 'YMD';

export interface ImportOptions {
  dateFormat: DateFormat;
  defaultCurrency: string;
  defaultSessionType: SessionType;
}

export interface MappedImport {
  sessions: Session[];
  /** Non-empty rows whose date couldn't be parsed. */
  skipped: number;
  /** Non-empty data rows considered. */
  total: number;
}

const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export function analyzeCsv(csv: string): { headers: string[]; rows: string[][] } {
  const records = tokenize(csv);
  if (records.length === 0) return { headers: [], rows: [] };
  return { headers: records[0].map((h) => h.trim()), rows: records.slice(1) };
}

/** Auto-match headers to fields. A header matches a field when its normalized
 *  form equals an alias, or overlaps an alias of >=4 chars either way. Each
 *  header is used at most once; fields are matched in MAP_FIELDS order. */
export function guessMapping(headers: string[]): ColumnMapping {
  const normed = headers.map(norm);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};

  const assign = (matches: (field: MapField, header: string) => boolean) => {
    for (const field of MAP_FIELDS) {
      if (mapping[field.key] !== undefined) continue;
      const i = normed.findIndex(
        (h, idx) => !used.has(idx) && h !== '' && matches(field, h),
      );
      if (i >= 0) {
        mapping[field.key] = i;
        used.add(i);
      }
    }
  };

  // Pass 1: exact alias matches win globally before any fuzzy match, so
  // "Game Type" maps to Game, not Session type (which "type" would fuzzily grab).
  assign((field, h) => field.synonyms.includes(h));
  // Pass 2: fuzzy overlap (>=4-char aliases) for whatever is still unmapped.
  assign((field, h) => field.synonyms.some((s) => s.length >= 4 && (h.includes(s) || s.includes(h))));

  return mapping;
}

// --- Value parsers (tolerant of formats from other apps) ---

/** "$1,234.50", "(50)" → -50, "-40", "" → 0. */
export function parseMoney(raw: string): number {
  let s = (raw ?? '').trim();
  if (!s) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^0-9.\-]/g, '');
  const v = Number.parseFloat(s);
  if (!Number.isFinite(v)) return 0;
  return negative ? -Math.abs(v) : v;
}

const parseIntFlex = (raw: string): number => Math.round(parseMoney(raw));

function parseTime(t: string): { hour: number; minute: number } {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i.exec(t);
  if (!m) return { hour: 0, minute: 0 };
  let h = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2], 10);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return { hour: h, minute };
}

/** Parses many date shapes to epoch millis (local); null if unrecognized.
 *  Ambiguous D/M vs M/D is resolved by [format] (AUTO uses value hints). */
export function parseFlexibleDate(raw: string, format: DateFormat): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // Native "yyyy-MM-dd HH:mm" fast path.
  const iso = parseIso(s);
  if (iso !== null) return iso;

  const [datePart, ...timeRest] = s.split(/[ T]/);
  const timePart = timeRest.join(' ');
  const parts = datePart.split(/[/\-.]/).map((x) => x.trim()).filter(Boolean);

  if (parts.length >= 3) {
    let year: number;
    let month: number;
    let day: number;
    const [a, b, c] = parts.map((n) => Number.parseInt(n, 10));
    if (parts[0].length === 4 || format === 'YMD') {
      year = a;
      month = b;
      day = c;
    } else {
      let mdy = format === 'MDY';
      if (format === 'AUTO') mdy = !(a > 12) || b > 12;
      if (format === 'DMY') mdy = false;
      month = mdy ? a : b;
      day = mdy ? b : a;
      year = c;
      if (year < 100) year += 2000;
    }
    if (!year || !month || !day || month > 12 || day > 31) return null;
    const { hour, minute } = parseTime(timePart);
    const t = new Date(year, month - 1, day, hour, minute).getTime();
    return Number.isNaN(t) ? null : t;
  }

  // Fall back to the engine (handles "Jan 5 2026", ISO with offset, etc.).
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseStakes(value: string): [number, number] | null {
  const parts = value.split(/[/\\-]/);
  if (parts.length < 2) return null;
  const sb = parseMoney(parts[0]);
  const bb = parseMoney(parts[1]);
  return sb > 0 || bb > 0 ? [sb, bb] : null;
}

function parseTypeFuzzy(value: string, fallback: SessionType): SessionType {
  const v = value.trim();
  if (!v) return fallback;
  const found = SESSION_TYPES.find(
    (t) => t.toLowerCase() === v.toLowerCase() || SESSION_TYPE_LABELS[t].toLowerCase() === v.toLowerCase(),
  );
  if (found) return found;
  if (/\bsng\b|sit\s*(?:n|&|and)?\s*go/i.test(v)) return 'SNG';
  if (/home/i.test(v)) return 'HOME';
  if (/table|black\s*jack|baccarat|roulette|pit/i.test(v)) return 'TABLE';
  if (/tourn|mtt/i.test(v)) return 'TOURNAMENT';
  if (/cash|ring/i.test(v)) return 'CASH';
  return fallback;
}

function parseGameFuzzy(value: string): GameType {
  const v = value.trim();
  if (!v) return 'OTHER';
  const found = GAME_TYPES.find(
    (g) => g.toLowerCase() === v.toLowerCase() || GAME_TYPE_LABELS[g].toLowerCase() === v.toLowerCase(),
  );
  if (found) return found;
  if (/plo|omaha/i.test(v)) return 'PLO';
  if (/nlh|hold\s*'?em|holdem|nlhe/i.test(v)) return 'NLH';
  return v; // keep custom game name
}

/** Turns rows into Sessions using [mapping]. Rows with an unparseable/empty
 *  date are skipped and counted. Imported sessions get fresh ids on save. */
export function applyMapping(
  rows: string[][],
  mapping: ColumnMapping,
  options: ImportOptions,
): MappedImport {
  const has = (key: MapFieldKey) => mapping[key] !== undefined;
  const cell = (row: string[], key: MapFieldKey): string => {
    const i = mapping[key];
    return i === undefined ? '' : (row[i] ?? '').trim();
  };

  const sessions: Session[] = [];
  let skipped = 0;
  let total = 0;

  for (const row of rows) {
    if (row.every((f) => f.trim() === '')) continue;
    total++;

    const startTime = parseFlexibleDate(cell(row, 'date'), options.dateFormat);
    if (startTime === null) {
      skipped++;
      continue;
    }

    // Stakes: a combined column and/or separate SB/BB columns.
    let smallBlind = 0;
    let bigBlind = 0;
    if (has('stakes')) {
      const st = parseStakes(cell(row, 'stakes'));
      if (st) [smallBlind, bigBlind] = st;
    }
    if (has('smallBlind')) smallBlind = parseMoney(cell(row, 'smallBlind')) || smallBlind;
    if (has('bigBlind')) bigBlind = parseMoney(cell(row, 'bigBlind')) || bigBlind;

    let durationMinutes = 0;
    if (has('durationMinutes')) durationMinutes = parseIntFlex(cell(row, 'durationMinutes'));
    if (has('durationHours')) {
      const hours = parseMoney(cell(row, 'durationHours'));
      if (hours) durationMinutes = Math.round(hours * 60);
    }

    const buyIn = has('buyIn') ? parseMoney(cell(row, 'buyIn')) : 0;
    const rebuysAddons = has('rebuysAddons') ? parseMoney(cell(row, 'rebuysAddons')) : 0;
    const tips = has('tips') ? parseMoney(cell(row, 'tips')) : 0;
    const expenses = has('expenses') ? parseMoney(cell(row, 'expenses')) : 0;

    // Cash-out preferred; otherwise derive it from a net-profit column so that
    // profit(session) reproduces the imported net exactly.
    let cashOut = 0;
    if (has('cashOut')) {
      cashOut = parseMoney(cell(row, 'cashOut'));
    } else if (has('net')) {
      cashOut = buyIn + rebuysAddons + tips + expenses + parseMoney(cell(row, 'net'));
    }

    sessions.push(
      normalizeSession({
        ...emptySession(startTime),
        startTime,
        sessionType: has('sessionType')
          ? parseTypeFuzzy(cell(row, 'sessionType'), options.defaultSessionType)
          : options.defaultSessionType,
        gameType: has('game') ? parseGameFuzzy(cell(row, 'game')) : 'NLH',
        venueType: has('venueType')
          ? /online|internet|app|web/i.test(cell(row, 'venueType'))
            ? 'ONLINE'
            : 'LIVE'
          : 'LIVE',
        location: has('location') ? cell(row, 'location') : '',
        smallBlind,
        bigBlind,
        durationMinutes,
        buyIn,
        rebuysAddons,
        cashOut,
        tips,
        expenses,
        position: has('position') ? parseIntFlex(cell(row, 'position')) : 0,
        fieldSize: has('fieldSize') ? parseIntFlex(cell(row, 'fieldSize')) : 0,
        currency: (has('currency') && cell(row, 'currency')) || options.defaultCurrency,
        tags: has('tags')
          ? cell(row, 'tags').split(/[;,|]/).map((t) => t.trim()).filter(Boolean)
          : [],
        notes: has('notes') ? cell(row, 'notes') : '',
      }),
    );
  }

  return { sessions, skipped, total };
}
