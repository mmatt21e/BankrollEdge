// Every individual setting in the app, indexed for the settings search —
// the way iOS/Android let you type "pin" or "dark mode" and jump straight
// to the switch. Each entry deep-links to its page; `section` matches the
// SectionCard id there, which useSectionHighlight scrolls to and flashes.
import { AppSettings } from './types';
import { NavGate, gateOpen } from './navDestinations';

export interface SettingsEntry {
  /** What the user is looking for, e.g. "Theme" or "PIN lock". */
  label: string;
  /** The settings page it lives on, shown as the breadcrumb. */
  page: string;
  route: string;
  /** SectionCard id on that page (appended as ?h=…). */
  section?: string;
  /** Extra words people might type for it (all lowercase). */
  keywords: string[];
  /** Feature switch that hides this setting entirely when off. */
  gate?: NavGate;
}

export const SETTINGS_INDEX: SettingsEntry[] = [
  // Bankroll & currency
  { label: 'Starting bankroll', page: 'Bankroll & currency', route: '/settings/bankroll', section: 'starting', keywords: ['balance', 'initial', 'amount', 'money', 'roll'] },
  { label: 'Separate sports bankroll', page: 'Bankroll & currency', route: '/settings/bankroll', section: 'starting', keywords: ['split', 'betting', 'roll', 'sports'], gate: 'sports' },
  { label: 'Default currency', page: 'Bankroll & currency', route: '/settings/bankroll', section: 'currency', keywords: ['usd', 'eur', 'gbp', 'dollar', 'euro', 'symbol', 'money'] },
  { label: 'Deposits & withdrawals', page: 'Bankroll & currency', route: '/bankroll', keywords: ['transactions', 'manage', 'bankroll', 'history', 'deposit', 'withdraw'] },

  // Features & navigation
  { label: 'Poker on/off', page: 'Features & navigation', route: '/settings/features', section: 'features', keywords: ['feature', 'enable', 'disable', 'hide', 'cash', 'tournament'] },
  { label: 'Table games on/off', page: 'Features & navigation', route: '/settings/features', section: 'features', keywords: ['feature', 'enable', 'disable', 'hide', 'blackjack', 'craps', 'casino'] },
  { label: 'Sports betting on/off', page: 'Features & navigation', route: '/settings/features', section: 'features', keywords: ['feature', 'enable', 'disable', 'hide', 'bets'] },
  { label: 'Bottom navigation shortcuts', page: 'Features & navigation', route: '/settings/features', section: 'nav', keywords: ['tabs', 'bar', 'pin', 'pins', 'star', 'customize', 'menu', 'shortcut'] },

  // Display
  { label: 'Theme', page: 'Display', route: '/settings/display', section: 'theme', keywords: ['dark', 'light', 'system', 'appearance', 'mode', 'color'] },
  { label: 'Card deck colors', page: 'Display', route: '/settings/display', section: 'deck', keywords: ['four', 'two', '4-color', '2-color', 'suits', 'diamonds', 'clubs', 'cards'], gate: 'poker' },
  { label: 'Dashboard cards', page: 'Display', route: '/settings/display', section: 'dash', keywords: ['chart', 'tiles', 'heatmap', 'calendar', 'snapshot', 'home', 'profit graph'] },
  { label: 'Travel time in hourly rates', page: 'Display', route: '/settings/display', section: 'stats', keywords: ['drive', 'driving', 'commute', 'travel', '$/hr', 'per hour', 'statistics', 'rate'] },

  // Poker
  { label: 'Default session type', page: 'Poker', route: '/settings/poker', section: 'default-type', keywords: ['cash', 'tournament', 'preselect', 'new session'], gate: 'poker' },
  { label: 'Poker games list', page: 'Poker', route: '/settings/poker', section: 'games', keywords: ['holdem', 'omaha', 'plo', 'custom game', 'hide game', 'variants'], gate: 'poker' },
  { label: 'Cash game stakes presets', page: 'Poker', route: '/settings/poker', section: 'stakes', keywords: ['blinds', 'small blind', 'big blind', '1/2', '2/5', 'limits'], gate: 'poker' },

  // Table games
  { label: 'Table games list', page: 'Table games', route: '/settings/table-games', section: 'games', keywords: ['blackjack', 'craps', 'roulette', 'baccarat', 'custom game', 'hide game'], gate: 'table' },
  { label: 'Table units display', page: 'Table games', route: '/settings/table-games', section: 'units', keywords: ['unit', 'amounts', 'chips'], gate: 'table' },
  { label: 'Table stakes presets', page: 'Table games', route: '/settings/table-games', section: 'stakes', keywords: ['min bet', 'max bet', 'spread', 'limits'], gate: 'table' },

  // Sports
  { label: 'Betting unit size', page: 'Sports', route: '/settings/sports', section: 'unit', keywords: ['units', 'stake', 'bet size'], gate: 'sports' },
  { label: 'Odds format', page: 'Sports', route: '/settings/sports', section: 'odds', keywords: ['american', 'decimal', '-110', 'price', 'lines'], gate: 'sports' },

  // Saved venues
  { label: 'Saved venues', page: 'Saved venues', route: '/settings/venues', section: 'venues', keywords: ['casino', 'location', 'room', 'place', 'where'], gate: 'session' },

  // Data & backup
  { label: 'CSV export', page: 'Data & backup', route: '/settings/data', section: 'csv', keywords: ['spreadsheet', 'excel', 'download', 'sessions', 'bets'] },
  { label: 'CSV import', page: 'Data & backup', route: '/settings/data', section: 'csv', keywords: ['pokerbase', 'poker bankroll tracker', 'poker income', 'upload', 'migrate', 'transfer'] },
  { label: 'Backup (export JSON)', page: 'Data & backup', route: '/settings/data', section: 'backup', keywords: ['save', 'json', 'export', 'everything', 'transfer'] },
  { label: 'Restore backup', page: 'Data & backup', route: '/settings/data', section: 'backup', keywords: ['import', 'merge', 'replace', 'recover', 'json'] },
  { label: 'Clear data', page: 'Data & backup', route: '/settings/data', section: 'clear', keywords: ['delete', 'reset', 'erase', 'wipe', 'remove all'] },

  // Privacy
  { label: 'Hide balances', page: 'Privacy', route: '/settings/privacy', section: 'hide', keywords: ['blur', 'money', 'discreet', 'shoulder'] },
  { label: 'PIN lock', page: 'Privacy', route: '/settings/privacy', section: 'pin', keywords: ['password', 'passcode', 'lock', 'security', 'protect'] },

  // About
  { label: 'About & version', page: 'About', route: '/settings/about', section: 'about', keywords: ['version', 'install', 'pwa', 'offline', 'app info'] },
];

/** Case-insensitive multi-word match: every query word must appear in the
 *  entry's label, page name or keywords. Label matches rank first. */
export function searchSettings(query: string, settings: AppSettings): SettingsEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: [number, number, SettingsEntry][] = [];
  SETTINGS_INDEX.forEach((entry, i) => {
    if (!gateOpen(entry.gate, settings)) return;
    const label = entry.label.toLowerCase();
    const haystack = `${label} ${entry.page.toLowerCase()} ${entry.keywords.join(' ')}`;
    if (!words.every((w) => haystack.includes(w))) return;
    const score = words.every((w) => label.includes(w)) ? (label.startsWith(words[0]) ? 0 : 1) : 2;
    scored.push([score, i, entry]);
  });
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , e]) => e);
}
