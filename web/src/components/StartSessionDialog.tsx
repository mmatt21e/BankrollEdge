import { useRef, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { ActiveSession, Session, SessionType, GameType, TableGameType, VenueType, SESSION_TYPES, SESSION_TYPE_LABELS, pokerGameOptions, tableGameOptions } from '../models/types';
import { Dialog, MoneyInput } from './common';
import { CommuteInput } from './CommuteInput';
import { parseCommuteMinutes } from '../domain/commute';

interface SetupState {
  sessionType: SessionType;
  gameType: GameType;
  tableGame: TableGameType;
  venueType: VenueType;
  location: string;
  smallBlind: string;
  bigBlind: string;
  buyIn: string;
  bountyPerBounty: string;
  travelMinutes: string;
}

/** Captures the session's setup the moment it starts, so game, venue, stakes
 *  and buy-in are recorded up front rather than reconstructed at stop time.
 *  Render only while open. */
export function StartSessionDialog({
  initial,
  onBack,
  onCancel,
  onStart,
}: {
  initial: Session;
  onBack: () => void;
  onCancel: () => void;
  onStart: (setup: Omit<ActiveSession, 'startedAt' | 'travelOneWayMinutes'>) => void;
}) {
  const app = useAppState();
  const { settings } = app;
  const [form, setForm] = useState<SetupState>(() => ({
    sessionType: initial.sessionType,
    gameType: initial.gameType,
    tableGame: initial.tableGame,
    venueType: initial.venueType,
    location: initial.location,
    smallBlind: '',
    bigBlind: '',
    buyIn: '',
    bountyPerBounty: '',
    travelMinutes: '',
  }));
  const starting = useRef(false);
  const [error, setError] = useState('');
  const commute = parseCommuteMinutes(form.travelMinutes);

  const set = (patch: Partial<SetupState>) => setForm((prev) => ({ ...prev, ...patch }));
  const num = (v: string) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const isTable = form.sessionType === 'TABLE';
  const isTournament = form.sessionType === 'TOURNAMENT' || form.sessionType === 'SNG';
  const pokerGames = pokerGameOptions(settings, [...app.recordedPokerGames, form.gameType]);
  const tableGames = tableGameOptions(settings, [...app.recordedTableGames, form.tableGame]);

  const start = () => {
    if (starting.current || commute === null) return;
    starting.current = true;
    try {
      onStart({
        sessionType: form.sessionType,
        gameType: form.gameType,
        tableGame: form.tableGame,
        venueType: form.venueType,
        location: form.location.trim(),
        smallBlind: isTable || isTournament ? 0 : num(form.smallBlind),
        bigBlind: isTable || isTournament ? 0 : num(form.bigBlind),
        buyIn: num(form.buyIn),
        rebuys: 0,
        bountyPerBounty: isTournament ? num(form.bountyPerBounty) : 0,
        bountyCount: 0,
        currency: initial.currency,
        travelMinutes: commute,
      });
    } catch (err) {
      starting.current = false;
      setError((err as Error).message);
    }
  };

  return (
    <Dialog label="Start live session" onClose={onCancel}>
      <h2>Start live session</h2>
      {app.activeSessions.length > 0 && <p className="muted small" style={{ margin: 0 }}>Your {app.activeSessions.length} running {app.activeSessions.length === 1 ? 'session stays' : 'sessions stay'} active. This starts a separate timer.</p>}
      {error && <p role="alert">{error}</p>}

        <label className="field">
          <span>Session type</span>
          <select
            value={form.sessionType}
            onChange={(e) => set({ sessionType: e.target.value as SessionType })}
          >
            {SESSION_TYPES.filter(
              (t) =>
                t === form.sessionType ||
                (t === 'TABLE' ? settings.showTableGames : settings.showPoker),
            ).map((t) => (
              <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>

        <div className="segmented" role="group" aria-label="Live or online" style={{ flexShrink: 0 }}>
          {(['LIVE', 'ONLINE'] as VenueType[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={form.venueType === v}
              onClick={() => set({ venueType: v })}
            >
              {v === 'LIVE' ? 'Live' : 'Online'}
            </button>
          ))}
        </div>

        {isTable ? (
          <label className="field">
            <span>Table game</span>
            <select
              value={form.tableGame}
              onChange={(e) => set({ tableGame: e.target.value as TableGameType })}
            >
              {tableGames.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Game</span>
            <select
              value={form.gameType}
              onChange={(e) => set({ gameType: e.target.value as GameType })}
            >
              {pokerGames.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Venue / location</span>
          <input
            type="text"
            list="live-venue-options"
            value={form.location}
            placeholder="e.g. Bellagio"
            onChange={(e) => set({ location: e.target.value })}
          />
          <datalist id="live-venue-options">
            {app.availableLocations.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </label>

        <CommuteInput value={form.travelMinutes} onChange={(travelMinutes) => set({ travelMinutes })} />

        {!isTable && !isTournament && (
          <div className="row">
            <label className="field grow">
              <span>Small blind</span>
              <MoneyInput
                currency={initial.currency}
                value={form.smallBlind}
                onChange={(v) => set({ smallBlind: v })}
              />
            </label>
            <label className="field grow">
              <span>Big blind</span>
              <MoneyInput
                currency={initial.currency}
                value={form.bigBlind}
                onChange={(v) => set({ bigBlind: v })}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>Buy-in</span>
          <MoneyInput
            currency={initial.currency}
            value={form.buyIn}
            onChange={(v) => set({ buyIn: v })}
          />
        </label>

        {isTournament && (
          <label className="field">
            <span>Bounty per knockout (optional)</span>
            <MoneyInput
              currency={initial.currency}
              value={form.bountyPerBounty}
              onChange={(v) => set({ bountyPerBounty: v })}
            />
          </label>
        )}

      <div className="col">
        <div className="row">
          <button type="button" className="btn btn-outline grow" aria-label="Back to choices" onClick={onBack}>Back</button>
          <button type="button" className="btn btn-outline grow" onClick={onCancel}>Cancel</button>
        </div>
        <button type="button" className="btn" disabled={commute === null} onClick={start}>
          {app.activeSessions.length > 0 ? 'Start another live session' : 'Start live session'}
        </button>
      </div>
    </Dialog>
  );
}
