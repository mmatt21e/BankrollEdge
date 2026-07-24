// Settings → Saved venues: the shared venue pick list used when logging
// poker and table-game sessions.
import { useState } from 'react';
import { useStoreList } from '../hooks/useAppState';
import { SectionCard, TopBar, useBack, useSectionHighlight } from '../components/common';
import { venueStore } from '../storage/db';

export default function VenuesSettingsPage() {
  const back = useBack('/settings');
  useSectionHighlight();
  const venues = useStoreList(venueStore);
  const sortedVenues = [...venues.items].sort((a, b) => a.name.localeCompare(b.name));
  const [venueName, setVenueName] = useState('');

  const addVenue = async () => {
    const n = venueName.trim();
    if (!n) return;
    if (!venues.items.some((v) => v.name.toLowerCase() === n.toLowerCase())) {
      await venues.save({ id: 0, name: n });
    }
    setVenueName('');
  };

  return (
    <>
      <TopBar title="Saved venues" onBack={back} />
      <main className="page page--with-topbar">
        <SectionCard id="venues" title="Saved venues">
          <p className="muted" style={{ margin: 0 }}>
            These appear as dropdown choices when you log a session — pick one instead of
            retyping it. You can also add new ones straight from the session screen.
          </p>
          {sortedVenues.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>No saved venues yet.</p>
          )}
          {sortedVenues.map((v) => (
            <div className="row" key={v.id}>
              <label className="field grow">
                <input
                  type="text"
                  defaultValue={v.name}
                  onBlur={(e) => {
                    const n = e.target.value.trim();
                    if (n && n !== v.name) venues.save({ ...v, name: n });
                  }}
                />
              </label>
              <button
                type="button"
                className="back"
                aria-label={`Delete ${v.name}`}
                onClick={() => venues.remove(v.id)}
              >
                🗑
              </button>
            </div>
          ))}
          <div className="row">
            <label className="field grow">
              <input
                type="text"
                placeholder="Add a venue"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVenue())}
              />
            </label>
            <button type="button" className="btn" onClick={addVenue}>Add</button>
          </div>
        </SectionCard>
      </main>
    </>
  );
}
