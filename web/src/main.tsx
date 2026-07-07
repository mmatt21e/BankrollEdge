import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import LandingPage from './pages/LandingPage';
import { AppStateProvider } from './hooks/useAppState';
import { isInstalledPWA } from './pwa/install';
import './styles/global.css';

// Service worker: precaches the app shell so the app works fully offline;
// updates activate automatically on the next visit.
registerSW({ immediate: true });

// basename follows Vite's base so subpath deploys (GitHub Pages) route correctly.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
// Once a browser visitor taps "Continue in browser" we don't nag them again
// for the rest of the tab session.
const ENTERED_KEY = 'be_entered_browser';

function isRootPath(): boolean {
  const path = window.location.pathname.replace(basename, '') || '/';
  return path === '/' || path === '';
}

/** Show the install landing only to browser visitors arriving at the root.
 *  Installed (standalone) launches and in-app deep links go straight to the app. */
function shouldShowLanding(): boolean {
  if (isInstalledPWA()) return false;
  try {
    if (sessionStorage.getItem(ENTERED_KEY)) return false;
  } catch {
    /* sessionStorage may be blocked (private mode) — just show the landing. */
  }
  return isRootPath();
}

function Root() {
  const [landing, setLanding] = useState(shouldShowLanding);

  if (landing) {
    return (
      <LandingPage
        onEnter={() => {
          try {
            sessionStorage.setItem(ENTERED_KEY, '1');
          } catch {
            /* ignore — dismissal just won't persist across reloads */
          }
          setLanding(false);
        }}
      />
    );
  }

  return (
    <BrowserRouter basename={basename}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
