// Ports of Android CsvExporter/CsvImporter — the byte format is identical, so
// CSVs are interchangeable between the Android app and the PWA.
import {
  Session,
  SessionType,
  GameType,
  TableGameType,
  SESSION_TYPE_LABELS,
  GAME_TYPE_LABELS,
  TABLE_GAME_LABELS,
  GAME_TYPES,
  SESSION_TYPES,
  TABLE_GAMES,
  profit,
  stakesLabel,
  isTableSession,
  emptySession,
} from '../models/types';

// The first 15 columns match the Android app's export exactly (so CSVs remain
// interchangeable); the columns after Notes are v2 additions that older
// importers simply ignore. The table-game columns after Tags are v1.7
// additions handled the same way.
const HEADER =
  'Date,Type,Game,Location,Stakes,DurationMinutes,BuyIn,RebuysAddons,CashOut,Tips,Profit,Position,FieldSize,Currency,Notes,' +
  'LiveOnline,AddOns,Rake,Expenses,HandsPlayed,TableSize,Tags,' +
  'TableGame,TableMinBet,TableMaxBet,UnitValue,UnitsMin,UnitsMax';

const pad = (n: number) => String(n).padStart(2, '0');

/** "yyyy-MM-dd HH:mm" in local time (matches Android's export format). */
export function formatIso(epochMillis: number): string {
  const d = new Date(epochMillis);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseIso(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return Number.isNaN(t) ? null : t;
}

function escape(value: string): string {
  if (value === '') return '';
  const needsQuoting = value.includes(',') || value.includes('"') || value.includes('\n');
  const escaped = value.replaceAll('"', '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

export function buildCsv(sessions: Session[]): string {
  const lines = [HEADER];
  for (const s of [...sessions].sort((a, b) => a.startTime - b.startTime)) {
    lines.push(
      [
        formatIso(s.startTime),
        SESSION_TYPE_LABELS[s.sessionType],
        GAME_TYPE_LABELS[s.gameType],
        escape(s.location),
        escape(stakesLabel(s)),
        s.durationMinutes,
        s.buyIn,
        s.rebuysAddons,
        s.cashOut,
        s.tips,
        profit(s),
        s.position,
        s.fieldSize,
        s.currency,
        escape(s.notes),
        s.venueType === 'ONLINE' ? 'Online' : 'Live',
        s.addOns,
        s.rake,
        s.expenses,
        s.handsPlayed,
        s.tableSize,
        escape(s.tags.join(';')),
        isTableSession(s) ? TABLE_GAME_LABELS[s.tableGame] : '',
        s.tableMinBet,
        s.tableMaxBet,
        s.unitValue,
        s.unitsMin,
        s.unitsMax,
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

export interface ImportResult {
  sessions: Session[];
  skippedRows: number;
}

/** Column matching is by header name (case-insensitive); rows that fail to
 *  parse are counted, not fatal. Throws if there is no Date column. */
export function parseCsv(csv: string): ImportResult {
  const records = tokenize(csv);
  if (records.length === 0) return { sessions: [], skippedRows: 0 };

  const header = records[0].map((h) => h.trim().toLowerCase());
  const col = new Map(header.map((name, i) => [name, i]));
  if (!col.has('date')) {
    throw new Error("No 'Date' column found — is this a BankrollEdge CSV export?");
  }
  const field = (row: string[], name: string): string => {
    const i = col.get(name);
    return i === undefined ? '' : (row[i] ?? '').trim();
  };
  const num = (row: string[], name: string): number => {
    const v = Number.parseFloat(field(row, name));
    return Number.isFinite(v) ? v : 0;
  };
  const int = (row: string[], name: string): number => {
    const v = Number.parseInt(field(row, name), 10);
    return Number.isFinite(v) ? v : 0;
  };

  const sessions: Session[] = [];
  let skipped = 0;
  for (const row of records.slice(1)) {
    if (row.every((f) => f.trim() === '')) continue;
    const startTime = parseIso(field(row, 'date'));
    if (startTime === null) {
      skipped++;
      continue;
    }
    const stakes = parseStakes(field(row, 'stakes'));
    sessions.push({
      ...emptySession(startTime),
      sessionType: parseType(field(row, 'type')),
      gameType: parseGame(field(row, 'game')),
      location: field(row, 'location'),
      startTime,
      durationMinutes: int(row, 'durationminutes'),
      smallBlind: stakes?.[0] ?? 0,
      bigBlind: stakes?.[1] ?? 0,
      buyIn: num(row, 'buyin'),
      rebuysAddons: num(row, 'rebuysaddons'),
      cashOut: num(row, 'cashout'),
      tips: num(row, 'tips'),
      position: int(row, 'position'),
      fieldSize: int(row, 'fieldsize'),
      currency: field(row, 'currency') || 'USD',
      notes: field(row, 'notes'),
      venueType: /online/i.test(field(row, 'liveonline')) ? 'ONLINE' : 'LIVE',
      addOns: num(row, 'addons'),
      rake: num(row, 'rake'),
      expenses: num(row, 'expenses'),
      handsPlayed: int(row, 'handsplayed'),
      tableSize: int(row, 'tablesize'),
      tags: field(row, 'tags').split(';').map((t) => t.trim()).filter(Boolean),
      tableGame: parseTableGame(field(row, 'tablegame')),
      tableMinBet: num(row, 'tableminbet'),
      tableMaxBet: num(row, 'tablemaxbet'),
      unitValue: num(row, 'unitvalue'),
      unitsMin: num(row, 'unitsmin'),
      unitsMax: num(row, 'unitsmax'),
    });
  }
  return { sessions, skippedRows: skipped };
}

function parseType(value: string): SessionType {
  const found = SESSION_TYPES.find(
    (t) =>
      t.toLowerCase() === value.toLowerCase() ||
      SESSION_TYPE_LABELS[t].toLowerCase() === value.toLowerCase(),
  );
  if (found) return found;
  if (/table/i.test(value)) return 'TABLE';
  return /tourn/i.test(value) ? 'TOURNAMENT' : 'CASH';
}

function parseGame(value: string): GameType {
  return (
    GAME_TYPES.find(
      (g) =>
        g.toLowerCase() === value.toLowerCase() ||
        GAME_TYPE_LABELS[g].toLowerCase() === value.toLowerCase(),
    ) ?? 'OTHER'
  );
}

function parseTableGame(value: string): TableGameType {
  if (value === '') return 'BLACKJACK'; // model default for non-table rows
  return (
    TABLE_GAMES.find(
      (g) =>
        g.toLowerCase() === value.toLowerCase() ||
        TABLE_GAME_LABELS[g].toLowerCase() === value.toLowerCase(),
    ) ?? 'OTHER'
  );
}

function parseStakes(value: string): [number, number] | null {
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const sb = Number.parseFloat(parts[0].trim());
  const bb = Number.parseFloat(parts[1].trim());
  return Number.isFinite(sb) && Number.isFinite(bb) ? [sb, bb] : null;
}

/** RFC-4180-style tokenizer: quoted fields may contain commas, escaped quotes
 *  ("") and newlines. Returns one array of fields per record. */
export function tokenize(csv: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    fields.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    if (fields.length > 1 || fields[0] !== '') records.push(fields);
    fields = [];
  };

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\r') {
      // swallow; \n ends the record
    } else if (c === '\n') {
      endRecord();
    } else {
      field += c;
    }
  }
  if (field !== '' || fields.length > 0) endRecord();
  return records;
}
