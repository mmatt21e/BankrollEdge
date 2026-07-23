// Flexible sports-bet CSV import with column mapping — bring bet history in
// from other trackers or a sportsbook export whose columns/formats differ from
// BankrollEdge's own. Mirrors importMap.ts (sessions) and reuses its generic
// column matcher and value parsers.
import {
  SportsBet,
  Sport,
  BetType,
  BetStatus,
  SPORTS,
  SPORT_LABELS,
  BET_TYPES,
  BET_TYPE_LABELS,
  BET_STATUSES,
  BET_STATUS_LABELS,
  emptyBet,
  normalizeBet,
} from '../models/types';
import { americanToDecimal } from './bets';
import {
  MapField,
  DateFormat,
  matchColumns,
  parseMoney,
  parseFlexibleDate,
} from './importMap';

// Field order matters (exact-before-fuzzy resolves conflicts): specific keys
// like "eventStart"/"closingOdds" precede the generic "event"/"odds".
export const BET_MAP_FIELDS: MapField[] = [
  { key: 'placedAt', label: 'Date placed', group: 'Essentials', required: true, hint: 'The only required column.', synonyms: ['placedat', 'placed', 'dateplaced', 'betdate', 'date', 'datetime', 'day', 'timestamp', 'when'] },
  { key: 'sport', label: 'Sport / league', group: 'Essentials', synonyms: ['sport', 'league', 'sportleague'] },
  { key: 'status', label: 'Result / status', group: 'Essentials', hint: 'Won / Lost / Push / Pending…', synonyms: ['status', 'result', 'outcome', 'grade', 'settled', 'graded'] },
  { key: 'event', label: 'Event / matchup', group: 'Details', synonyms: ['event', 'matchup', 'game', 'teams', 'match', 'fixture', 'contest'] },
  { key: 'pick', label: 'Pick / selection', group: 'Details', synonyms: ['pick', 'selection', 'bet', 'wager', 'side', 'play', 'runner'] },
  { key: 'betType', label: 'Bet type / market', group: 'Details', synonyms: ['bettype', 'market', 'wagertype', 'type', 'markettype'] },
  { key: 'odds', label: 'Odds / price', group: 'Odds & money', hint: 'American (+150 / -110) or decimal.', synonyms: ['odds', 'price', 'line', 'decimalodds', 'americanodds', 'oddsdecimal', 'oddsamerican'] },
  { key: 'stake', label: 'Stake / risk', group: 'Odds & money', synonyms: ['stake', 'risk', 'wagered', 'staked', 'riskamount', 'wageramount', 'betamount', 'amount', 'bet'] },
  { key: 'net', label: 'Net profit/loss', group: 'Odds & money', hint: 'Use if the file has profit rather than only a result.', synonyms: ['net', 'profit', 'pl', 'pnl', 'profitloss', 'netprofit', 'netresult', 'winloss', 'won', 'winnings'] },
  { key: 'cashOutAmount', label: 'Cash-out amount', group: 'Odds & money', synonyms: ['cashout', 'cashoutamount', 'cashedout'] },
  { key: 'closingOdds', label: 'Closing odds', group: 'Odds & money', hint: 'For CLV tracking.', synonyms: ['closingodds', 'closingline', 'closingoddsdecimal', 'clv', 'closeprice', 'closing'] },
  { key: 'freeBet', label: 'Free / bonus bet', group: 'Extras', synonyms: ['freebet', 'bonusbet', 'free', 'bonus', 'promo'] },
  { key: 'sportsbook', label: 'Sportsbook', group: 'Extras', synonyms: ['sportsbook', 'book', 'bookmaker', 'operator', 'site'] },
  { key: 'eventStart', label: 'Event start time', group: 'Extras', synonyms: ['eventstart', 'gametime', 'starttime', 'kickoff', 'eventdate'] },
  { key: 'currency', label: 'Currency', group: 'Extras', synonyms: ['currency', 'ccy', 'curr'] },
  { key: 'tags', label: 'Tags', group: 'Extras', synonyms: ['tags', 'tag', 'labels', 'label'] },
  { key: 'notes', label: 'Notes', group: 'Extras', synonyms: ['notes', 'note', 'comment', 'comments', 'description', 'memo'] },
];

export type BetColumnMapping = Record<string, number>;

export type OddsInputFormat = 'AUTO' | 'AMERICAN' | 'DECIMAL';

export interface BetImportOptions {
  dateFormat: DateFormat;
  oddsFormat: OddsInputFormat;
  defaultCurrency: string;
}

export interface MappedBetImport {
  bets: SportsBet[];
  skipped: number;
  total: number;
}

export function guessBetMapping(headers: string[]): BetColumnMapping {
  return matchColumns(BET_MAP_FIELDS, headers);
}

/** Parses an odds cell to decimal odds. AUTO treats a leading sign or |value|
 *  >= 100 as American, otherwise decimal. European decimal commas ("1,91")
 *  are decimal odds, never American. */
export function parseOdds(raw: string, format: OddsInputFormat): number {
  let s = (raw ?? '').trim();
  if (!s) return 0;
  // "1,91" is decimal-comma notation — stripping the comma would turn it into
  // American +191. Normalize it to a dot before parsing.
  const decimalComma = /^\d+,\d+$/.test(s);
  if (decimalComma) s = s.replace(',', '.');
  const n = Number.parseFloat(s.replace(/[^0-9.+\-]/g, ''));
  if (!Number.isFinite(n) || n === 0) return 0;
  if (format === 'DECIMAL') return n > 1 ? n : 0;
  if (format === 'AMERICAN') return decimalComma ? 0 : americanToDecimal(n);
  // AUTO
  if (decimalComma) return n > 1 ? n : 0;
  if (/^[+\-]/.test(s) || Math.abs(n) >= 100) return americanToDecimal(n);
  return n > 1 ? n : americanToDecimal(n);
}

function parseSportFuzzy(value: string): Sport {
  const v = value.trim();
  if (!v) return 'OTHER';
  const found = SPORTS.find(
    (s) => s.toLowerCase() === v.toLowerCase() || SPORT_LABELS[s].toLowerCase() === v.toLowerCase(),
  );
  if (found) return found;
  if (/football|nfl/i.test(v) && !/college|ncaa/i.test(v)) return 'NFL';
  if (/basketball|nba/i.test(v) && !/college|ncaa/i.test(v)) return 'NBA';
  if (/baseball|mlb/i.test(v)) return 'MLB';
  if (/hockey|nhl/i.test(v)) return 'NHL';
  if (/ufc|mma/i.test(v)) return 'MMA';
  if (/soccer|epl|futbol|football club|fc/i.test(v)) return 'SOCCER';
  return 'OTHER';
}

function parseBetTypeFuzzy(value: string): BetType {
  const v = value.trim();
  if (!v) return 'OTHER';
  const found = BET_TYPES.find(
    (t) => t.toLowerCase() === v.toLowerCase() || BET_TYPE_LABELS[t].toLowerCase() === v.toLowerCase(),
  );
  if (found) return found;
  if (/spread|handicap|line|ats/i.test(v)) return 'SPREAD';
  if (/money\s*line|ml|h2h|winner/i.test(v)) return 'MONEYLINE';
  if (/total|over|under|o\/u|ou/i.test(v)) return 'TOTAL';
  if (/parlay|acca|accumulator|multi/i.test(v)) return 'PARLAY';
  if (/teaser/i.test(v)) return 'TEASER';
  if (/future|outright/i.test(v)) return 'FUTURES';
  if (/prop/i.test(v)) return 'PROP';
  if (/live|in\s*play|inplay/i.test(v)) return 'LIVE';
  return 'OTHER';
}

function parseStatusFuzzy(value: string): BetStatus | null {
  const v = value.trim();
  if (!v) return null;
  const found = BET_STATUSES.find(
    (s) =>
      s.toLowerCase() === v.toLowerCase() ||
      s.replace('_', ' ').toLowerCase() === v.toLowerCase() ||
      BET_STATUS_LABELS[s].toLowerCase() === v.toLowerCase(),
  );
  if (found) return found;
  if (/^w|win|won|cover/i.test(v)) return 'WON';
  if (/^l|los|lose/i.test(v)) return 'LOST';
  if (/push|tie|tied|even/i.test(v)) return 'PUSH';
  if (/void|cancel|refund/i.test(v)) return 'VOID';
  if (/cash/i.test(v)) return 'CASHED_OUT';
  if (/pend|open|unsettled|live/i.test(v)) return 'PENDING';
  return null;
}

/** Turns rows into SportsBets using [mapping]. Rows with an unparseable/empty
 *  placed-at date are skipped and counted. When a net-profit column is mapped,
 *  odds/stake/cash-out are back-filled so betProfit reproduces that net. */
export function applyBetMapping(
  rows: string[][],
  mapping: BetColumnMapping,
  options: BetImportOptions,
): MappedBetImport {
  const has = (key: string) => mapping[key] !== undefined;
  const cell = (row: string[], key: string): string => {
    const i = mapping[key];
    return i === undefined ? '' : (row[i] ?? '').trim();
  };

  const bets: SportsBet[] = [];
  let skipped = 0;
  let total = 0;

  for (const row of rows) {
    if (row.every((f) => f.trim() === '')) continue;
    total++;

    const placedAt = parseFlexibleDate(cell(row, 'placedAt'), options.dateFormat);
    if (placedAt === null) {
      skipped++;
      continue;
    }

    // Stakes and cash-outs can't be negative (accounting-style "(2)" cells).
    let stake = Math.max(0, has('stake') ? parseMoney(cell(row, 'stake')) : 0);
    let odds = has('odds') ? parseOdds(cell(row, 'odds'), options.oddsFormat) : 0;
    let cashOutAmount = Math.max(
      0,
      has('cashOutAmount') ? parseMoney(cell(row, 'cashOutAmount')) : 0,
    );
    const freeBet = has('freeBet') && /yes|true|1|free|bonus/i.test(cell(row, 'freeBet'));

    const net = has('net') ? parseMoney(cell(row, 'net')) : null;
    let status: BetStatus =
      (has('status') ? parseStatusFuzzy(cell(row, 'status')) : null) ??
      (net !== null ? (net > 0 ? 'WON' : net < 0 ? 'LOST' : 'PUSH') : 'PENDING');

    // Make betProfit() reproduce the imported net exactly, preserving as much
    // real info (stake / odds) as the data allows.
    if (net !== null) {
      if (status === 'WON') {
        if (stake > 0) odds = 1 + net / stake;
        else {
          stake = net;
          odds = 2;
        }
      } else if (status === 'LOST') {
        if (!freeBet && Math.abs(-stake - net) > 0.005) stake = Math.abs(net);
      } else if (status === 'CASHED_OUT' || status === 'PENDING') {
        // Pending + a net figure is contradictory — record it as a cash-out.
        status = 'CASHED_OUT';
        cashOutAmount = (freeBet ? 0 : stake) + net;
      }
      // PUSH / VOID contribute 0; a mapped net of 0 is consistent.
    }

    bets.push(
      normalizeBet({
        ...emptyBet(placedAt),
        placedAt,
        sport: has('sport') ? parseSportFuzzy(cell(row, 'sport')) : 'OTHER',
        event: has('event') ? cell(row, 'event') : '',
        pick: has('pick') ? cell(row, 'pick') : '',
        betType: has('betType') ? parseBetTypeFuzzy(cell(row, 'betType')) : 'OTHER',
        status,
        odds,
        stake,
        cashOutAmount,
        freeBet,
        closingOdds: has('closingOdds') ? parseOdds(cell(row, 'closingOdds'), options.oddsFormat) : 0,
        sportsbook: has('sportsbook') ? cell(row, 'sportsbook') : '',
        eventStart: has('eventStart')
          ? parseFlexibleDate(cell(row, 'eventStart'), options.dateFormat) ?? 0
          : 0,
        tags: has('tags')
          ? cell(row, 'tags').split(/[;,|]/).map((t) => t.trim()).filter(Boolean)
          : [],
        notes: has('notes') ? cell(row, 'notes') : '',
        currency: (has('currency') && cell(row, 'currency')) || options.defaultCurrency,
      }),
    );
  }

  return { bets, skipped, total };
}
