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
  const topLevel = ['/', '/sessions', '/bets', '/stats', '/tools', '/settings'].includes(location.pathname);
  const canSession = settings.showPoker || settings.showTableGames;
  const onPlay = location.pathname === '/';
  const onSessions = location.pathname === '/sessions';
  const onBets = location.pathname === '/bets';
  // With poker and table games both off, adding a bet is the only + action.
  const fabAddsBet = onBets || (onPlay && !canSession);
  const showFab =
    (onPlay && (canSession || settings.showSports)) ||
    (onSessions && canSession) ||
    (onBets && settings.showSports);

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
          aria-label={fabAddsBet ? 'Add bet' : 'Add session'}
          onClick={() => navigate(fabAddsBet ? '/bet/new' : '/session/new')}
        >
          +
        </button>
      )}
      {topLevel && <NavBar />}
    </>
  );
}
