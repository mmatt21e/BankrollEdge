// The More hub: every destination in the app, grouped, with star-to-pin for
// the bottom bar (max 5 pins) — plus the user's own Quick Links, which open
// external sites (Pokerbase profile, tournament schedules, casino pages…)
// in the browser.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  MAX_NAV_PINS,
  NAV_DESTINATIONS,
  NavDestination,
  navGateOpen,
} from '../models/navDestinations';
import { QuickLink } from '../models/types';
import { MessageBanner, SectionCard } from '../components/common';

const GROUPS: NavDestination['group'][] = ['Tracking', 'Poker tools', 'App'];

export default function MorePage() {
  const app = useAppState();
  const navigate = useNavigate();
  const { settings } = app;
  const [message, setMessage] = useState('');

  const pinned = new Set(settings.navPins);
  const togglePin = (dest: NavDestination) => {
    if (pinned.has(dest.key)) {
      app.updateSettings({ navPins: settings.navPins.filter((k) => k !== dest.key) });
      setMessage(`${dest.title} removed from the bottom bar.`);
    } else if (settings.navPins.length >= MAX_NAV_PINS) {
      setMessage(`The bar holds ${MAX_NAV_PINS} shortcuts — unpin one first (tap a filled star).`);
    } else {
      app.updateSettings({ navPins: [...settings.navPins, dest.key] });
      setMessage(`${dest.title} pinned to the bottom bar.`);
    }
  };

  return (
    <main className="page">
      <h1>More</h1>
      <p className="muted" style={{ margin: 0 }}>
        Everything lives here. Tap the star to pin a shortcut to the bottom bar
        (up to {MAX_NAV_PINS}).
      </p>
      <MessageBanner>{message}</MessageBanner>

      {GROUPS.map((group) => {
        const items = NAV_DESTINATIONS.filter(
          (d) => d.group === group && navGateOpen(d, settings),
        );
        if (items.length === 0) return null;
        return (
          <section key={group} className="col" aria-label={group}>
            <h2>{group}</h2>
            {items.map((dest) => (
              <div key={dest.key} className="row" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className="session-row grow"
                  onClick={() => navigate(dest.route)}
                >
                  <span aria-hidden="true" className="icon-lg">{dest.emoji}</span>
                  <span className="grow col" style={{ gap: 2 }}>
                    <span className="title">{dest.title}</span>
                    <span className="muted small">{dest.blurb}</span>
                  </span>
                  <span aria-hidden="true" className="muted">›</span>
                </button>
                <button
                  type="button"
                  className="btn-plain"
                  style={{ minWidth: 44, minHeight: 44, textAlign: 'center', fontSize: '1.3rem' }}
                  aria-label={pinned.has(dest.key) ? `Unpin ${dest.title} from the bottom bar` : `Pin ${dest.title} to the bottom bar`}
                  aria-pressed={pinned.has(dest.key)}
                  onClick={() => togglePin(dest)}
                >
                  {pinned.has(dest.key) ? '★' : '☆'}
                </button>
              </div>
            ))}
          </section>
        );
      })}

      <QuickLinksCard />
    </main>
  );
}

/** The user's own external links, opened in the browser. Sites like these
 *  can't be embedded inside the app (they block framing, and the app works
 *  offline), so a one-tap jump is the reliable version of "in the app". */
function QuickLinksCard() {
  const app = useAppState();
  const { quickLinks } = app.settings;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [emoji, setEmoji] = useState('');

  const normalizeUrl = (raw: string): string => {
    const t = raw.trim();
    if (t === '') return '';
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  const addLink = () => {
    const link: QuickLink = {
      id: Math.max(0, ...quickLinks.map((l) => l.id)) + 1,
      name: name.trim() || url.trim(),
      url: normalizeUrl(url),
      emoji: emoji.trim() || '🔗',
    };
    if (link.url === '') return;
    app.updateSettings({ quickLinks: [...quickLinks, link] });
    setName('');
    setUrl('');
    setEmoji('');
  };

  const removeLink = (id: number) =>
    app.updateSettings({ quickLinks: quickLinks.filter((l) => l.id !== id) });

  return (
    <SectionCard title="Your links">
      <p className="muted" style={{ margin: 0 }}>
        Save the outside sites you use — your Pokerbase profile, staking page,
        tournament schedules, casino sites. They open in your browser.
      </p>
      {quickLinks.map((link) => (
        <div key={link.id} className="row" style={{ alignItems: 'center' }}>
          <a
            className="session-row grow"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <span aria-hidden="true" className="icon-lg">{link.emoji}</span>
            <span className="grow col" style={{ gap: 2 }}>
              <span className="title">{link.name}</span>
              <span className="muted small">{link.url}</span>
            </span>
            <span aria-hidden="true" className="muted">↗</span>
          </a>
          <button
            type="button"
            className="back"
            aria-label={`Delete link ${link.name}`}
            onClick={() => removeLink(link.id)}
          >
            🗑
          </button>
        </div>
      ))}
      <div className="row">
        <label className="field" style={{ width: 64 }}>
          <span>Icon</span>
          <input
            type="text"
            value={emoji}
            placeholder="🔗"
            maxLength={4}
            onChange={(e) => setEmoji(e.target.value)}
          />
        </label>
        <label className="field grow">
          <span>Name</span>
          <input
            type="text"
            value={name}
            placeholder="WSOPC schedule"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>
      <div className="row">
        <label className="field grow">
          <span>Link</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            placeholder="wsop.com/tournaments"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
          />
        </label>
        <button
          type="button"
          className="btn"
          style={{ alignSelf: 'flex-end' }}
          disabled={url.trim() === ''}
          onClick={addLink}
        >
          Add
        </button>
      </div>
    </SectionCard>
  );
}
