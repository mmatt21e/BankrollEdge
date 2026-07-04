import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { routes } from './routes/routes';
import { NavBar } from './components/common';
import { useOnline } from './hooks/useAppState';

export default function App() {
  const element = useRoutes(routes);
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();

  // Bottom nav + FAB only on top-level destinations (matches the Android
  // Scaffold, which hides them on the editor/bankroll detail screens).
  const topLevel = ['/', '/sessions', '/stats', '/settings'].includes(location.pathname);
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
