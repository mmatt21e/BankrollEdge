import { AppSettings, Session, SessionType, SESSION_TYPES, emptySession } from '../models/types';
import { SessionFilter } from './filter';

export type SessionEntryScope = 'dashboard' | 'poker' | 'table';
export interface SessionEntryState {
  sessionEntry?: {
    step?: 'live' | 'previous';
    returnTo?: string;
    originIndex?: number;
    trigger?: 'dashboard' | 'fab';
  };
}

/** Keep only unambiguous game/venue context; date ranges are list filters,
 *  not a request to backdate a live session. */
export function sessionEntryUrl(scope: SessionEntryScope, settings: AppSettings, filter: SessionFilter): string {
  const params = new URLSearchParams();
  const types = filter.types.filter((type) => scope !== 'poker' || type !== 'TABLE');
  const pokerContext = scope === 'poker' || (scope === 'dashboard' && filter.games.length > 0 && filter.tableGames.length === 0);
  const fallback = settings.defaultSessionType !== 'ALL' && (!pokerContext || settings.defaultSessionType !== 'TABLE')
    ? settings.defaultSessionType : pokerContext || settings.showPoker ? 'CASH' : 'TABLE';
  const tableContext = scope === 'table' || (scope === 'dashboard' && types.length === 0 && filter.tableGames.length > 0 && filter.games.length === 0);
  const type = tableContext ? 'TABLE' : types.length === 1 ? types[0] : fallback;
  params.set('type', type);
  const games = type === 'TABLE' ? filter.tableGames : filter.games;
  if (games.length === 1) params.set(type === 'TABLE' ? 'tableGame' : 'game', games[0]);
  if (filter.venueType) params.set('venueType', filter.venueType);
  if (filter.locations.length === 1) params.set('location', filter.locations[0]);
  return '/session/new?' + params.toString();
}

/** Shared initial values for both choices, including legacy start/duration
 *  deep links. A live timer always uses the actual start-button time. */
export function sessionEntryDefaults(params: URLSearchParams, settings: AppSettings, now: number): Session {
  const type = params.get('type') as SessionType;
  const start = Number(params.get('start'));
  const duration = Number(params.get('duration'));
  return {
    ...emptySession(Number.isFinite(start) && start > 0 && start <= 8.64e15 ? start : now),
    durationMinutes: Number.isSafeInteger(duration) && duration >= 0 ? duration : 0,
    currency: settings.currency,
    sessionType: SESSION_TYPES.includes(type) ? type : settings.defaultSessionType !== 'ALL'
      ? settings.defaultSessionType : settings.showPoker ? 'CASH' : 'TABLE',
    gameType: params.get('game')?.trim() || 'NLH',
    tableGame: params.get('tableGame')?.trim() || 'BLACKJACK',
    venueType: params.get('venueType') === 'ONLINE' ? 'ONLINE' : 'LIVE',
    location: params.get('location') || '',
  };
}
