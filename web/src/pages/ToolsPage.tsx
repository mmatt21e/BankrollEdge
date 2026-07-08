// "More" hub — bankroll management, settings and the poker utilities live
// here so the bottom nav stays focused on the core tracking loop. The poker
// tools follow the poker feature switch (Settings → Display).
import { Link } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';

interface HubLink {
  to: string;
  icon: string;
  name: string;
  blurb: string;
}

const MANAGE: HubLink[] = [
  {
    to: '/bankroll',
    icon: '🏦',
    name: 'Manage bankroll',
    blurb: 'Deposits, withdrawals and your starting bankroll history.',
  },
  {
    to: '/settings',
    icon: '⚙️',
    name: 'Settings',
    blurb: 'General, display, poker, table games and sports settings.',
  },
];

const TOOLS: HubLink[] = [
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

function HubRow({ link }: { link: HubLink }) {
  return (
    <Link to={link.to} className="session-row" style={{ textDecoration: 'none' }}>
      <span aria-hidden="true" style={{ fontSize: '1.6rem' }}>{link.icon}</span>
      <span className="grow col" style={{ gap: 2 }}>
        <span className="title">{link.name}</span>
        <span className="muted small">{link.blurb}</span>
      </span>
      <span aria-hidden="true" className="muted">›</span>
    </Link>
  );
}

export default function ToolsPage() {
  const { settings } = useAppState();
  return (
    <main className="page">
      <h1>More</h1>
      <div className="col">
        {MANAGE.map((l) => (
          <HubRow key={l.to} link={l} />
        ))}
      </div>
      {settings.showPoker && (
        <>
          <h2>Tools</h2>
          <div className="col">
            {TOOLS.map((l) => (
              <HubRow key={l.to} link={l} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
