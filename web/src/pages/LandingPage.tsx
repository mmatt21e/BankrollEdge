// Install-promotion landing, shown only to browser visitors at the root.
// Installed (standalone) launches bypass this entirely — see main.tsx.
import { useEffect, useState } from 'react';
import { canInstall, isIos, onInstallChange, promptInstall } from '../pwa/install';

const FEATURES = [
  'Track cash games, tournaments, table games and sports bets',
  'See your bankroll, hourly rate and stats at a glance',
  'Works fully offline — all data stays on your device',
];

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [installable, setInstallable] = useState(canInstall());
  const ios = isIos();

  // The prompt often arrives after first paint; re-render when it does.
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') onEnter();
  };

  const base = import.meta.env.BASE_URL;
  return (
    <main className="landing">
      <img
        className="landing-logo"
        src={`${base}icons/icon-192.png`}
        alt=""
        width={96}
        height={96}
      />
      <div>
        <h1>BankrollEdge</h1>
        <p className="tagline">Your poker &amp; gambling bankroll, always in your pocket.</p>
      </div>

      <ul className="landing-features">
        {FEATURES.map((f) => (
          <li key={f}>
            <span className="tick" aria-hidden="true">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="landing-actions">
        {installable ? (
          <button type="button" className="btn btn-block" onClick={install}>
            ⬇&nbsp; Install app
          </button>
        ) : ios ? (
          <div className="install-hint">
            <strong>Install on your iPhone or iPad:</strong> tap the Share button in Safari, then
            choose <strong>“Add to Home Screen.”</strong>
          </div>
        ) : (
          <div className="install-hint">
            To install, open your browser menu and choose <strong>“Install app”</strong> or{' '}
            <strong>“Add to Home Screen.”</strong>
          </div>
        )}
        <button type="button" className="link-btn" onClick={onEnter}>
          Continue in browser →
        </button>
      </div>

      <p className="muted small" style={{ margin: 0 }}>
        Installing adds an app icon and opens straight to your bankroll — no app store needed.
      </p>
    </main>
  );
}
