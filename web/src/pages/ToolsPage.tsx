// Tools hub — entry point for the home-game and tournament utilities.
import { Link } from 'react-router-dom';

const TOOLS = [
  {
    to: '/tools/clock',
    icon: '⏱',
    name: 'Tournament clock',
    blurb: 'Blind levels, breaks, alerts and a full-screen display for home games.',
  },
  {
    to: '/tools/home-games',
    icon: '🎲',
    name: 'Home game ledger',
    blurb: 'Track buy-ins, rebuys and cash-outs per player, then settle the night.',
  },
  {
    to: '/tools/payout',
    icon: '🏆',
    name: 'Payout calculator',
    blurb: 'Prize pools, payout templates and rounded payouts by place.',
  },
  {
    to: '/tools/deal',
    icon: '🤝',
    name: 'Deal / chop calculator',
    blurb: 'Split the remaining pool by chips — ICM, chip chop or even.',
  },
  {
    to: '/tools/stack-value',
    icon: '💰',
    name: 'My stack value',
    blurb: 'What your stack is worth — chip position and ICM cash equity.',
  },
  {
    to: '/tools/chips',
    icon: '🪙',
    name: 'Tournament Chip stack setup',
    blurb: 'Chips per player from your set, with inventory warnings.',
  },
  {
    to: '/tools/calendar',
    icon: '📅',
    name: 'Poker calendar',
    blurb: 'Upcoming sessions and tournaments, with device-calendar reminders.',
  },
  {
    to: '/tools/hands',
    icon: '🃏',
    name: 'Hand notes',
    blurb: 'Capture interesting hands, link them to sessions, review later.',
  },
];

export default function ToolsPage() {
  return (
    <main className="page">
      <h1>Tools</h1>
      <div className="col">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="session-row" style={{ textDecoration: 'none' }}>
            <span aria-hidden="true" style={{ fontSize: '1.6rem' }}>{t.icon}</span>
            <span className="grow col" style={{ gap: 2 }}>
              <span className="title">{t.name}</span>
              <span className="muted small">{t.blurb}</span>
            </span>
            <span aria-hidden="true" className="muted">›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
