// Every screen a user can pin to the bottom navigation bar. The bar shows up
// to five pinned destinations plus a permanent More tab; everything here is
// always reachable from More regardless of what's pinned.
import { AppSettings } from './types';

export type NavGate = 'poker' | 'table' | 'sports' | 'session';

export interface NavDestination {
  /** Stable key stored in settings.navPins. Never rename. */
  key: string;
  route: string;
  /** Short label under the bottom-nav icon. */
  label: string;
  /** Emoji used as the icon in More (and in the bar for non-core pins). */
  emoji: string;
  /** Line-icon name from NavIcon for the core destinations; emoji otherwise. */
  icon?: string;
  /** Full name + description shown in the More hub. */
  title: string;
  blurb: string;
  /** Feature switch that hides this destination entirely when off. */
  gate?: NavGate;
  group: 'Tracking' | 'Poker tools' | 'App';
}

export const NAV_DESTINATIONS: NavDestination[] = [
  { key: 'dashboard', route: '/', label: 'Dashboard', emoji: '📊', icon: 'stats', title: 'Dashboard', blurb: 'Bankroll, profit chart, stats and insights.', group: 'Tracking' },
  { key: 'poker', route: '/sessions', label: 'Poker', emoji: '🃏', icon: 'poker', title: 'Poker sessions', blurb: 'Your cash-game and tournament history.', gate: 'poker', group: 'Tracking' },
  { key: 'table', route: '/tables', label: 'Table', emoji: '🎰', icon: 'tables', title: 'Table-game sessions', blurb: 'Blackjack, craps and other pit sessions.', gate: 'table', group: 'Tracking' },
  { key: 'sports', route: '/bets', label: 'Sports', emoji: '🏈', icon: 'bets', title: 'Sports bets', blurb: 'Open bets, settling and betting stats.', gate: 'sports', group: 'Tracking' },
  { key: 'bankroll', route: '/bankroll', label: 'Bankroll', emoji: '🏦', title: 'Manage bankroll', blurb: 'Deposits, withdrawals and balance history.', group: 'Tracking' },
  { key: 'deepstats', route: '/stats/deep', label: 'Stats', emoji: '🔢', title: 'Detailed statistics', blurb: 'BB/100, ROI per bullet, and by-week/stake/venue breakdowns.', gate: 'session', group: 'Tracking' },
  { key: 'calendar', route: '/tools/calendar', label: 'Calendar', emoji: '📅', title: 'Poker calendar', blurb: 'Upcoming events with device-calendar reminders.', gate: 'poker', group: 'Tracking' },
  { key: 'tools', route: '/tools', label: 'Tools', emoji: '🧰', icon: 'tools', title: 'Tools hub', blurb: 'All poker tools on one screen.', gate: 'poker', group: 'Poker tools' },
  { key: 'clock', route: '/tools/clock', label: 'Clock', emoji: '⏱', title: 'Tournament clock', blurb: 'Blind levels, breaks and a full-screen display.', gate: 'poker', group: 'Poker tools' },
  { key: 'homegames', route: '/tools/home-games', label: 'Home', emoji: '🎲', title: 'Home game ledger', blurb: 'Buy-ins, cash-outs and settlement.', gate: 'poker', group: 'Poker tools' },
  { key: 'payout', route: '/tools/payout', label: 'Payouts', emoji: '🏆', title: 'Payout calculator', blurb: 'Prize pools and payouts by place.', gate: 'poker', group: 'Poker tools' },
  { key: 'deal', route: '/tools/deal', label: 'Deal', emoji: '🤝', title: 'Deal / ICM calculator', blurb: 'Final-table deals: ICM, chip chop or even.', gate: 'poker', group: 'Poker tools' },
  { key: 'stackvalue', route: '/tools/stack-value', label: 'Stack', emoji: '📈', title: 'My stack value', blurb: 'What your stack is worth right now.', gate: 'poker', group: 'Poker tools' },
  { key: 'chips', route: '/tools/chips', label: 'Chips', emoji: '🪙', title: 'Chip calculator', blurb: 'Chip distributions for your chip set.', gate: 'poker', group: 'Poker tools' },
  { key: 'hands', route: '/tools/hands', label: 'Hands', emoji: '✍️', title: 'Hand notes', blurb: 'Capture hands and review them later.', gate: 'poker', group: 'Poker tools' },
  { key: 'settings', route: '/settings', label: 'Settings', emoji: '⚙️', icon: 'settings', title: 'Settings', blurb: 'Bankroll, display, data and privacy.', group: 'App' },
];

export const MAX_NAV_PINS = 5;

const byKey = new Map(NAV_DESTINATIONS.map((d) => [d.key, d]));

export const navDestination = (key: string): NavDestination | undefined => byKey.get(key);

/** Is this destination visible given the current feature switches? */
export function navGateOpen(dest: NavDestination, settings: AppSettings): boolean {
  switch (dest.gate) {
    case 'poker':
      return settings.showPoker;
    case 'table':
      return settings.showTableGames;
    case 'sports':
      return settings.showSports;
    case 'session':
      return settings.showPoker || settings.showTableGames;
    default:
      return true;
  }
}

/** The destinations to render in the bar: valid, gated, deduped, max 5. */
export function pinnedDestinations(settings: AppSettings): NavDestination[] {
  const seen = new Set<string>();
  const out: NavDestination[] = [];
  for (const key of settings.navPins) {
    if (seen.has(key)) continue;
    seen.add(key);
    const dest = byKey.get(key);
    if (dest && navGateOpen(dest, settings)) out.push(dest);
    if (out.length === MAX_NAV_PINS) break;
  }
  return out;
}
