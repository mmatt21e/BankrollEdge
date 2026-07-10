// Port of Android SessionFilter (ui/SessionFilter.kt).
import {
  Session,
  SessionType,
  GameType,
  TableGameType,
  VenueType,
  gameTypeLabel,
  tableGameLabel,
  isTableSession,
  stakesLabel,
  tableStakesLabel,
} from '../models/types';

export type DateRange = 'ALL' | 'THIS_MONTH' | 'LAST_30' | 'THIS_YEAR';

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  ALL: 'All time',
  THIS_MONTH: 'This month',
  LAST_30: 'Last 30 days',
  THIS_YEAR: 'This year',
};

export interface SessionFilter {
  type: SessionType | null;
  game: GameType | null;
  /** Only applies to table-game sessions. */
  tableGame: TableGameType | null;
  venueType: VenueType | null;
  location: string | null;
  tag: string | null;
  range: DateRange;
  /** Free-text search over venue, notes, game name, stakes and tags. */
  query: string;
}

export const EMPTY_FILTER: SessionFilter = {
  type: null,
  game: null,
  tableGame: null,
  venueType: null,
  location: null,
  tag: null,
  range: 'ALL',
  query: '',
};

export const isFilterActive = (f: SessionFilter): boolean =>
  f.type !== null || f.game !== null || f.tableGame !== null ||
  f.venueType !== null || f.location !== null || f.tag !== null ||
  f.range !== 'ALL' || f.query.trim() !== '';

export function rangeStart(range: DateRange, now: number): number | null {
  const d = new Date(now);
  switch (range) {
    case 'ALL':
      return null;
    case 'LAST_30':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'THIS_MONTH':
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    case 'THIS_YEAR':
      return new Date(d.getFullYear(), 0, 1).getTime();
  }
}

function matches(s: Session, q: string): boolean {
  const needle = q.toLowerCase();
  const gameLabel = isTableSession(s)
    ? tableGameLabel(s.tableGame)
    : gameTypeLabel(s.gameType);
  const stakes = isTableSession(s) ? tableStakesLabel(s) : stakesLabel(s);
  return (
    s.location.toLowerCase().includes(needle) ||
    s.notes.toLowerCase().includes(needle) ||
    gameLabel.toLowerCase().includes(needle) ||
    stakes.toLowerCase().includes(needle) ||
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
  return sessions.filter(
    (s) =>
      (filter.type === null || s.sessionType === filter.type) &&
      (filter.game === null || (!isTableSession(s) && s.gameType === filter.game)) &&
      (filter.tableGame === null || (isTableSession(s) && s.tableGame === filter.tableGame)) &&
      (filter.venueType === null || s.venueType === filter.venueType) &&
      (filter.location === null || s.location === filter.location) &&
      (filter.tag === null || s.tags.includes(filter.tag)) &&
      (from === null || s.startTime >= from) &&
      (q === '' || matches(s, q)),
  );
}
