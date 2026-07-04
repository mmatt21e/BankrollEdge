// Port of Android SessionFilter (ui/SessionFilter.kt).
import {
  Session,
  SessionType,
  GameType,
  GAME_TYPE_LABELS,
  stakesLabel,
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
  location: string | null;
  range: DateRange;
  /** Free-text search over venue, notes, game name and stakes. */
  query: string;
}

export const EMPTY_FILTER: SessionFilter = {
  type: null,
  game: null,
  location: null,
  range: 'ALL',
  query: '',
};

export const isFilterActive = (f: SessionFilter): boolean =>
  f.type !== null || f.game !== null || f.location !== null ||
  f.range !== 'ALL' || f.query.trim() !== '';

function rangeStart(range: DateRange, now: number): number | null {
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
  return (
    s.location.toLowerCase().includes(needle) ||
    s.notes.toLowerCase().includes(needle) ||
    GAME_TYPE_LABELS[s.gameType].toLowerCase().includes(needle) ||
    stakesLabel(s).toLowerCase().includes(needle)
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
      (filter.game === null || s.gameType === filter.game) &&
      (filter.location === null || s.location === filter.location) &&
      (from === null || s.startTime >= from) &&
      (q === '' || matches(s, q)),
  );
}
