// Poker calendar: upcoming sessions/tournaments with an "Add to device
// calendar" (.ics with built-in alarm) — the portable reminder mechanism that
// works on both Android and iOS without any calendar-API integration.
import { FormEvent, useState } from 'react';
import { CalendarEvent } from '../models/types';
import { buildIcs } from '../domain/ics';
import { formatDateTime, money } from '../domain/format';
import { eventStore } from '../storage/db';
import { useAppState, useStoreList } from '../hooks/useAppState';
import { ConfirmDialog, TopBar, useBack } from '../components/common';
import { exportFile } from '../services/files';

export default function CalendarPage() {
  const back = useBack('/tools');
  const currency = useAppState().settings.currency;
  const { items: events, loaded, save, remove } = useStoreList<CalendarEvent>(eventStore);
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [start, setStart] = useState('');
  const [lateReg, setLateReg] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState('60');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const startTime = new Date(start).getTime();
    if (!name.trim() || !Number.isFinite(startTime)) return;
    await save({
      id: 0,
      name: name.trim(),
      location: location.trim(),
      buyIn: Number.parseFloat(buyIn) || 0,
      startTime,
      lateRegEnd: lateReg ? new Date(lateReg).getTime() || 0 : 0,
      notes: notes.trim(),
      reminderMinutes: Number.parseInt(reminder, 10) || 0,
    });
    setName('');
    setLocation('');
    setBuyIn('');
    setStart('');
    setLateReg('');
    setNotes('');
  };

  const upcoming = [...events].sort((a, b) => a.startTime - b.startTime);
  const now = Date.now();

  return (
    <>
      <TopBar title="Poker calendar" onBack={back} />
      <main className="page page--with-topbar">
        <form className="card col" onSubmit={onSubmit}>
          <h2>Add event</h2>
          <label className="field">
            <span>Event name</span>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="row">
            <label className="field grow">
              <span>Location</span>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label className="field grow">
              <span>Buy-in</span>
              <input
                type="text"
                inputMode="decimal"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </label>
          </div>
          <label className="field">
            <span>Starts</span>
            <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Late registration ends (optional)</span>
            <input type="datetime-local" value={lateReg} onChange={(e) => setLateReg(e.target.value)} />
          </label>
          <label className="field">
            <span>Reminder before start</span>
            <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
              <option value="0">None</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="1440">1 day</option>
            </select>
          </label>
          <label className="field">
            <span>Notes</span>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="submit" className="btn">Add event</button>
          <p className="muted small" style={{ margin: 0 }}>
            Use "Add to calendar" on a saved event to put it (with its reminder) into your
            phone's calendar app — that's what fires the notification.
          </p>
        </form>

        {!loaded ? null : upcoming.length === 0 ? (
          <p className="empty">No events yet. Add your next session or tournament above.</p>
        ) : (
          <div className="col">
            {upcoming.map((ev) => (
              <div key={ev.id} className={`card col ${ev.startTime < now ? 'muted' : ''}`} style={{ gap: 6 }}>
                <div className="row-between">
                  <strong>{ev.name}</strong>
                  {ev.buyIn > 0 && <span className="money">{money(ev.buyIn, currency)}</span>}
                </div>
                <div className="muted small">
                  {formatDateTime(ev.startTime)}
                  {ev.location && ` • ${ev.location}`}
                  {ev.lateRegEnd > 0 && ` • late reg until ${formatDateTime(ev.lateRegEnd)}`}
                </div>
                {ev.notes && <div className="small">{ev.notes}</div>}
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-outline grow"
                    onClick={() =>
                      exportFile(
                        `${ev.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'poker-event'}.ics`,
                        buildIcs(ev, Date.now()),
                        'text/calendar',
                      )
                    }
                  >
                    📅 Add to calendar
                  </button>
                  <button
                    type="button"
                    className="back"
                    aria-label={`Delete event ${ev.name}`}
                    onClick={() => setPendingDelete(ev)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Delete this event?"
          message={pendingDelete ? `"${pendingDelete.name}" will be removed from the calendar. This can't be undone.` : ''}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const ev = pendingDelete;
            setPendingDelete(null);
            if (ev) remove(ev.id);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </main>
    </>
  );
}
