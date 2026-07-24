// Session filtering. Grew out of the Android SessionFilter port: every
// dimension is now multi-select (empty selection = no filter on that
// dimension), matching the full-screen Filters sheet.
import {
  Session,
  SessionType,
  VenueType,
  gameTypeLabel,
  tableGameLabel,
  isTableSession,
  stakesLabel,
  tableStakesLabel,
} from '../models/types';
import { mondayIndex } from './aggregate';

export type DateRange = 'ALL' | 'YTD' | 'LAST_1Y' | 'LAST_6M' | 'LAST_3M' | 'THIS_MONTH' | 'LAST_30';

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  ALL: 'Max',
  YTD: 'YTD',
  LAST_1Y: '1Y',
  LAST_6M: '6M',
  LAST_3M: '3M',
  THIS_MONTH: 'This month',
  LAST_30: '1M',
};

export interface SessionFilter {
  /** Session categories; empty = all. */
  types: SessionType[];
  /** Poker game keys; empty = all. Never matches table sessions when set. */
  games: string[];
  /** Table game keys; empty = all. Only matches table sessions when set. */
  tableGames: string[];
  venueType: VenueType | null;
  locations: string[];
  tags: string[];
  /** Stakes labels as produced by stakesLabel/tableStakesLabel. */
  stakes: string[];
  currencies: string[];
  /** Monday-first weekday indexes (0 = Monday … 6 = Sunday); empty = all. */
  weekdays: number[];
  /** Table sizes (players); empty = all. */
  tableSizes: number[];
  range: DateRange;
  /** Free-text search over venue, notes, game name, stakes and tags. */
  query: string;
}

export const EMPTY_FILTER: SessionFilter = {
  types: [],
  games: [],
  tableGames: [],
  venueType: null,
  locations: [],
  tags: [],
  stakes: [],
  currencies: [],
  weekdays: [],
  tableSizes: [],
  range: 'ALL',
  query: '',
};

/** How many dimensions are constrained (drives the Filters badge). */
export const activeFilterCount = (f: SessionFilter): number =>
  (f.types.length > 0 ? 1 : 0) +
  (f.games.length > 0 ? 1 : 0) +
  (f.tableGames.length > 0 ? 1 : 0) +
  (f.venueType !== null ? 1 : 0) +
  (f.locations.length > 0 ? 1 : 0) +
  (f.tags.length > 0 ? 1 : 0) +
  (f.stakes.length > 0 ? 1 : 0) +
  (f.currencies.length > 0 ? 1 : 0) +
  (f.weekdays.length > 0 ? 1 : 0) +
  (f.tableSizes.length > 0 ? 1 : 0) +
  (f.range !== 'ALL' ? 1 : 0) +
  (f.query.trim() !== '' ? 1 : 0);

export const isFilterActive = (f: SessionFilter): boolean => activeFilterCount(f) > 0;

export function rangeStart(range: DateRange, now: number): number | null {
  const d = new Date(now);
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case 'ALL':
      return null;
    case 'LAST_30':
      return now - 30 * day;
    case 'LAST_3M':
      return new Date(d.getFullYear(), d.getMonth() - 3, d.getDate()).getTime();
    case 'LAST_6M':
      return new Date(d.getFullYear(), d.getMonth() - 6, d.getDate()).getTime();
    case 'LAST_1Y':
      return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).getTime();
    case 'THIS_MONTH':
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    case 'YTD':
      return new Date(d.getFullYear(), 0, 1).getTime();
  }
}

/** The stakes label a session is matched by (cash blinds or table min/max). */
export const sessionStakesLabel = (s: Session): string =>
  isTableSession(s) ? tableStakesLabel(s) : stakesLabel(s);

function matches(s: Session, q: string): boolean {
  const needle = q.toLowerCase();
  const gameLabel = isTableSession(s)
    ? tableGameLabel(s.tableGame)
    : gameTypeLabel(s.gameType);
  return (
    s.location.toLowerCase().includes(needle) ||
    s.notes.toLowerCase().includes(needle) ||
    gameLabel.toLowerCase().includes(needle) ||
    sessionStakesLabel(s).toLowerCase().includes(needle) ||
    s.tags.some((t) => t.toLowerCase().includes(needle))
  );
}

export function applyFilter(
  filter: SessionFilter,
  sessions: Session[],
  now: number,
): Session[] {
  const from = rangeStart(filter.range, now);
  const q = filter.query.trim();
  const wantsGames = filter.games.length > 0;
  const wantsTableGames = filter.tableGames.length > 0;
  return sessions.filter((s) => {
    if (filter.types.length > 0 && !filter.types.includes(s.sessionType)) return false;
    // Game selections span both disciplines: a session passes if it matches
    // either selected list (or no game filter is set at all).
    if (wantsGames || wantsTableGames) {
      const gameHit = isTableSession(s)
        ? wantsTableGames && filter.tableGames.includes(s.tableGame)
        : wantsGames && filter.games.includes(s.gameType);
      if (!gameHit) return false;
    }
    if (filter.venueType !== null && s.venueType !== filter.venueType) return false;
    if (filter.locations.length > 0 && !filter.locations.includes(s.location)) return false;
    if (filter.tags.length > 0 && !filter.tags.some((t) => s.tags.includes(t))) return false;
    if (filter.stakes.length > 0 && !filter.stakes.includes(sessionStakesLabel(s))) return false;
    if (filter.currencies.length > 0 && !filter.currencies.includes(s.currency)) return false;
    if (filter.weekdays.length > 0 && !filter.weekdays.includes(mondayIndex(new Date(s.startTime)))) return false;
    if (filter.tableSizes.length > 0 && !filter.tableSizes.includes(s.tableSize)) return false;
    if (from !== null && s.startTime < from) return false;
    if (q !== '' && !matches(s, q)) return false;
    return true;
  });
}
