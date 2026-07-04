import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { routes } from './routes/routes';
import { NavBar } from './components/common';
import { PinLock } from './components/PinLock';
import { useOnline } from './hooks/useAppState';
import { hasPin, loadHideBalances } from './storage/settings';

export default function App() {
  const element = useRoutes(routes);
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const [locked, setLocked] = useState(hasPin);

  // "Hide balances" masks every money value app-wide via a body class.
  useEffect(() => {
    document.body.classList.toggle('privacy-hide', loadHideBalances());
  }, [location]);

  if (locked) return <PinLock onUnlock={() => setLocked(false)} />;

  // Bottom nav + FAB only on top-level destinations.
  const topLevel = ['/', '/sessions', '/stats', '/tools', '/settings'].includes(location.pathname);
  const showFab = location.pathname === '/' || location.pathname === '/sessions';

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
          aria-label="Add session"
          onClick={() => navigate('/session/new')}
        >
          +
        </button>
      )}
      {topLevel && <NavBar />}
    </>
  );
}
