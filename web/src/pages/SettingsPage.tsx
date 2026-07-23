// Settings tab — manage bankroll first, then every settings area directly.
// Feature-gated areas (Poker, Table games, Sports) only appear while their
// feature switch is on; Display always shows so features can be re-enabled.
import { useAppState } from '../hooks/useAppState';
import { HubRow } from '../components/common';

interface SettingsLink {
  to: string;
  icon: string;
  name: string;
  blurb: string;
}

export default function SettingsPage() {
  const { settings } = useAppState();

  const links: SettingsLink[] = [
    {
      to: '/bankroll',
      icon: '🏦',
      name: 'Manage bankroll',
      blurb: 'Deposits, withdrawals and your bankroll history.',
    },
    {
      to: '/settings/general',
      icon: '⚙️',
      name: 'General',
      blurb: 'Bankroll, currency, venues, CSV, backup, privacy.',
    },
    {
      to: '/settings/display',
      icon: '🎨',
      name: 'Display',
      blurb: 'Theme, features, tabs and dashboard cards.',
    },
    ...(settings.showPoker
      ? [{
          to: '/settings/poker',
          icon: '🃏',
          name: 'Poker',
          blurb: 'Default view and cash-game stakes presets.',
        }]
      : []),
    ...(settings.showTableGames
      ? [{
          to: '/settings/table-games',
          icon: '🎲',
          name: 'Table games',
          blurb: 'Table-stakes presets.',
        }]
      : []),
    ...(settings.showSports
      ? [{
          to: '/settings/sports',
          icon: '🏈',
          name: 'Sports',
          blurb: 'Unit size and odds format.',
        }]
      : []),
  ];

  return (
    <main className="page">
      <h1>Settings</h1>
      <div className="col">
        {links.map((l) => (
          <HubRow key={l.to} {...l} />
        ))}
      </div>
      <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>
        BankrollEdge v{__APP_VERSION__}
      </p>
    </main>
  );
}
