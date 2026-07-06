import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppStateProvider } from './hooks/useAppState';
import './styles/global.css';

// Service worker: precaches the app shell so the app works fully offline;
// updates activate automatically on the next visit.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename follows Vite's base so subpath deploys (GitHub Pages) route correctly. */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
