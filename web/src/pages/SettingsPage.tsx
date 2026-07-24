// Settings tab — search across every setting (like phone settings search),
// with the pages grouped underneath. Feature-gated pages (Poker, Table
// games, Sports, venues) only appear while their feature switch is on.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { HubRow } from '../components/common';
import { searchSettings } from '../models/settingsIndex';
import { NAV_DESTINATIONS, NavGate, gateOpen, navGateOpen } from '../models/navDestinations';

interface SettingsLink {
  to: string;
  icon: string;
  name: string;
  blurb: string;
  gate?: NavGate;
}

const GROUPS: { title: string; links: SettingsLink[] }[] = [
  {
    title: 'App setup',
    links: [
      { to: '/settings/bankroll', icon: '🏦', name: 'Bankroll & currency', blurb: 'Starting bankroll, sports roll and default currency.' },
      { to: '/settings/features', icon: '🧭', name: 'Features & navigation', blurb: 'Turn poker, table games or sports on/off; bottom-bar shortcuts.' },
      { to: '/settings/display', icon: '🎨', name: 'Display', blurb: 'Theme, card deck colors and dashboard cards.' },
    ],
  },
  {
    title: 'Games',
    links: [
      { to: '/settings/poker', icon: '🃏', name: 'Poker', blurb: 'Default session type, game list and stakes presets.', gate: 'poker' },
      { to: '/settings/table-games', icon: '🎲', name: 'Table games', blurb: 'Game list, units and table-stakes presets.', gate: 'table' },
      { to: '/settings/sports', icon: '🏈', name: 'Sports', blurb: 'Unit size and odds format.', gate: 'sports' },
      { to: '/settings/venues', icon: '📍', name: 'Saved venues', blurb: 'The venue pick list for logging sessions.', gate: 'session' },
    ],
  },
  {
    title: 'Data & privacy',
    links: [
      { to: '/settings/data', icon: '💾', name: 'Data & backup', blurb: 'CSV export/import, backup, restore and clear data.' },
      { to: '/settings/privacy', icon: '🔒', name: 'Privacy', blurb: 'Hide balances and PIN lock.' },
      { to: '/settings/about', icon: 'ℹ️', name: 'About', blurb: 'Version and app info.' },
    ],
  },
];

export default function SettingsPage() {
  const { settings } = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const settingHits = trimmed ? searchSettings(trimmed, settings) : [];
  // Also surface whole screens (tools, trackers…) so the search finds
  // anything in the app, not just switches.
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const screenHits = trimmed
    ? NAV_DESTINATIONS.filter((d) => {
        if (!navGateOpen(d, settings)) return false;
        const hay = `${d.title} ${d.label} ${d.blurb}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
    : [];

  return (
    <main className="page">
      <h1>Settings</h1>

      <input
        type="search"
        placeholder="Search settings…"
        aria-label="Search settings"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {trimmed !== '' ? (
        <>
          {settingHits.length === 0 && screenHits.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              No settings match “{trimmed}”.
            </p>
          )}
          {settingHits.length > 0 && (
            <section className="col" aria-label="Matching settings">
              <div className="overline">Settings</div>
              {settingHits.map((e) => (
                <button
                  key={`${e.route}-${e.label}`}
                  type="button"
                  className="session-row"
                  onClick={() => navigate(e.section ? `${e.route}?h=${e.section}` : e.route)}
                >
                  <span className="grow col" style={{ gap: 2 }}>
                    <span className="title">{e.label}</span>
                    <span className="muted small">{e.page}</span>
                  </span>
                  <span aria-hidden="true" className="muted">›</span>
                </button>
              ))}
            </section>
          )}
          {screenHits.length > 0 && (
            <section className="col" aria-label="Matching screens">
              <div className="overline">Screens & tools</div>
              {screenHits.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="session-row"
                  onClick={() => navigate(d.route)}
                >
                  <span aria-hidden="true" className="icon-lg">{d.emoji}</span>
                  <span className="grow col" style={{ gap: 2 }}>
                    <span className="title">{d.title}</span>
                    <span className="muted small">{d.blurb}</span>
                  </span>
                  <span aria-hidden="true" className="muted">›</span>
                </button>
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          {GROUPS.map((group) => {
            const links = group.links.filter((l) => gateOpen(l.gate, settings));
            if (links.length === 0) return null;
            return (
              <section key={group.title} className="col" aria-label={group.title}>
                <div className="overline">{group.title}</div>
                {links.map((l) => (
                  <HubRow key={l.to} to={l.to} icon={l.icon} name={l.name} blurb={l.blurb} />
                ))}
              </section>
            );
          })}
          <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>
            BankrollEdge v{__APP_VERSION__}
          </p>
        </>
      )}
    </main>
  );
}
