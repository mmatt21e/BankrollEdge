// Travel log: drives recorded without a session (declined at the attach
// prompt, or added by hand), plus overall travel totals including the
// travel tied to sessions.
import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { TravelEntry } from '../models/types';
import { duration, formatDate, toDateInput } from '../domain/format';
import { SectionCard, TopBar, useBack } from '../components/common';

export default function TravelLogPage() {
  const app = useAppState();
  const back = useBack('/more');
  const { travelLog } = app.settings;

  const sessionTravel = app.sessions.reduce((a, s) => a + s.travelMinutes, 0);
  const unattached = travelLog.reduce((a, t) => a + t.minutes, 0);
  const entries = [...travelLog].sort((a, b) => b.time - a.time);

  const remove = (id: number) =>
    app.updateSettings({ travelLog: travelLog.filter((t) => t.id !== id) });

  return (
    <>
      <TopBar title="Travel log" onBack={back} />
      <main className="page page--with-topbar">
        <SectionCard title="Overall travel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Tied to sessions</span>
            <span style={{ fontWeight: 600 }}>{sessionTravel > 0 ? duration(sessionTravel) : '—'}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Unattached drives</span>
            <span style={{ fontWeight: 600 }}>{unattached > 0 ? duration(unattached) : '—'}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Total</span>
            <span style={{ fontWeight: 700 }}>
              {sessionTravel + unattached > 0 ? duration(sessionTravel + unattached) : '—'}
            </span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Session travel is edited on each session. Drives you chose not to tie to a session
            live here as overall travel — they don't affect any session's stats.
          </p>
        </SectionCard>

        <SectionCard title="Unattached drives">
          {entries.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              No unattached drives yet. Declining the “tie your drive to this session?” prompt
              files the drive here.
            </p>
          )}
          {entries.map((t) => (
            <div className="row" key={t.id} style={{ alignItems: 'center' }}>
              <span className="grow col" style={{ gap: 2 }}>
                <span className="title">{duration(t.minutes)}{t.location ? ` · ${t.location}` : ''}</span>
                <span className="muted small">{formatDate(t.time)}</span>
              </span>
              <button
                type="button"
                className="back"
                aria-label={`Delete drive on ${formatDate(t.time)}`}
                onClick={() => remove(t.id)}
              >
                🗑
              </button>
            </div>
          ))}
          <AddDriveRow
            onAdd={(entry) =>
              app.updateSettings({
                travelLog: [
                  ...travelLog,
                  { ...entry, id: Math.max(0, ...travelLog.map((t) => t.id)) + 1 },
                ],
              })
            }
          />
        </SectionCard>
      </main>
    </>
  );
}

function AddDriveRow({ onAdd }: { onAdd: (entry: Omit<TravelEntry, 'id'>) => void }) {
  const [minutes, setMinutes] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => toDateInput(Date.now()));
  const value = Number.parseInt(minutes, 10);
  const valid = Number.isFinite(value) && value > 0 && date !== '';

  const add = () => {
    const [y, m, d] = date.split('-').map(Number);
    onAdd({
      time: new Date(y, (m || 1) - 1, d || 1, 12).getTime(),
      minutes: value,
      location: location.trim(),
    });
    setMinutes('');
    setLocation('');
  };

  return (
    <>
      <div className="row">
        <label className="field" style={{ width: 110 }}>
          <span>Minutes</span>
          <input
            type="text"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label className="field grow">
          <span>Where to (optional)</span>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="field grow">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          style={{ alignSelf: 'flex-end' }}
          disabled={!valid}
          onClick={add}
        >
          Add drive
        </button>
      </div>
    </>
  );
}
