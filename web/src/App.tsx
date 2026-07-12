import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { routes } from './routes/routes';
import { NavBar } from './components/common';
import { PinLock } from './components/PinLock';
import { useAppState, useOnline } from './hooks/useAppState';
import { hasPin, loadHideBalances } from './storage/settings';

export default function App() {
  const element = useRoutes(routes);
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const { settings } = useAppState();
  const [locked, setLocked] = useState(hasPin);

  // "Hide balances" masks every money value app-wide via a body class.
  useEffect(() => {
    document.body.classList.toggle('privacy-hide', loadHideBalances());
  }, [location]);

  // Theme override from Settings → Display; SYSTEM follows the device.
  useEffect(() => {
    if (settings.theme === 'SYSTEM') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme.toLowerCase();
  }, [settings.theme]);

  if (locked) return <PinLock onUnlock={() => setLocked(false)} />;

  // Bottom nav + FAB only on top-level destinations.
  const topLevel = ['/', '/sessions', '/tables', '/bets', '/tools', '/settings'].includes(location.pathname);
  const canSession = settings.showPoker || settings.showTableGames;
  const onHome = location.pathname === '/';
  const onSessions = location.pathname === '/sessions';
  const onTables = location.pathname === '/tables';
  const onBets = location.pathname === '/bets';
  // With poker and table games both off, adding a bet is the only + action.
  const fabAddsBet = onBets || (onHome && !canSession);
  const showFab =
    (onHome && (canSession || settings.showSports)) ||
    (onSessions && settings.showPoker) ||
    (onTables && settings.showTableGames) ||
    (onBets && settings.showSports);

  // The Table + adds a table session; the Poker + adds a poker session
  // (respecting the user's default poker type). Dashboard/other tabs use defaults.
  const pokerDefault =
    settings.defaultSessionType !== 'ALL' && settings.defaultSessionType !== 'TABLE'
      ? settings.defaultSessionType
      : 'CASH';
  const fabTarget = fabAddsBet
    ? '/bet/new'
    : onTables
      ? '/session/new?type=TABLE'
      : onSessions
        ? `/session/new?type=${pokerDefault}`
        : '/session/new';
  const fabLabel = fabAddsBet ? 'Add bet' : onTables ? 'Add table session' : 'Add session';

  return (
    <>
      {!online && (
        <div className="offline-banner" role="status">
          Offline — everything still works; data is stored on this device.
        </div>
      )}
      {element}
      {showFab && (
        <button
          type="button"
          className="fab"
          aria-label={fabLabel}
          onClick={() => navigate(fabTarget)}
        >
          +
        </button>
      )}
      {topLevel && <NavBar />}
    </>
  );
}
