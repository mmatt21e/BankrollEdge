// Live-session card for the dashboard: start a session (capturing its setup
// up front), watch the running clock, add rebuys / bounties, then stop & log.
// Moved out of the old Play screen when it merged into the Dashboard.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useNow } from '../hooks/useAppState';
import { money, elapsedClock, formatDateTime } from '../domain/format';
import {
  ActiveSession,
  PendingDrive,
  SessionType,
  GameType,
  TableGameType,
  VenueType,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  gameTypeLabel,
  tableGameLabel,
  pokerGameOptions,
  tableGameOptions,
} from '../models/types';
import { ConfirmDialog, Dialog, MoneyInput } from './common';

/** All running sessions plus the start actions. Several sessions can run at
 *  once — one card each, targeted by their startedAt handle. A drive to the
 *  venue can be clocked before any session exists; starting a session
 *  consumes it as travel time. */
export function LiveSessionCard() {
  const app = useAppState();
  const [setupOpen, setSetupOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  return (
    <>
      {app.pendingDrive && <DriveCard drive={app.pendingDrive} onStartSession={() => setSetupOpen(true)} />}
      {app.activeSessions.map((active) => (
        <RunningSessionCard key={active.startedAt} active={active} />
      ))}
      {/* Idle (or "start another"): a slim one-line action, not a full card.
          Starting captures the setup up front so the details are recorded
          from the moment you sit down. */}
      <button type="button" className="live-start" onClick={() => setSetupOpen(true)}>
        <span aria-hidden="true">▶</span>{' '}
        {app.activeSessions.length > 0 ? 'Start another session' : 'Start live session'}
      </button>
      {!app.pendingDrive && (
        <button type="button" className="live-start" onClick={() => setDriveOpen(true)}>
          <span aria-hidden="true">🚗</span> Start drive to the venue
        </button>
      )}
      {/* Mounted per open so the form re-reads current defaults each time. */}
      {setupOpen && (
        <StartSessionDialog
          onCancel={() => setSetupOpen(false)}
          onStart={(setup) => {
            app.startSession(setup);
            setSetupOpen(false);
          }}
        />
      )}
      {driveOpen && (
        <StartDriveDialog
          onCancel={() => setDriveOpen(false)}
          onStart={(location) => {
            app.startDrive(location);
            setDriveOpen(false);
          }}
        />
      )}
    </>
  );
}

/** The drive-in-progress (or arrived) card. The clock runs until "I've
 *  arrived" freezes it; starting a session then records it as travel. */
function DriveCard({ drive, onStartSession }: { drive: PendingDrive; onStartSession: () => void }) {
  const app = useAppState();
  const now = useNow(true);
  const driving = drive.arrivedAt === 0;
  const elapsed = (driving ? now : drive.arrivedAt) - drive.startedAt;
  const minutes = Math.max(0, Math.round(elapsed / 60000));
  return (
    <section className="card col" style={{ background: 'var(--primary-container)' }}>
      <div className="overline">{driving ? 'Driving to the venue' : 'Arrived'}</div>
      <div className="money" style={{ fontSize: '2rem', fontWeight: 700 }} role="timer">
        {elapsedClock(elapsed)}
      </div>
      {drive.location !== '' && <div style={{ fontWeight: 600 }}>{drive.location}</div>}
      <p className="muted small" style={{ margin: 0 }}>
        {driving
          ? 'Tap “I’ve arrived” when you get there, then start your session as usual.'
          : `${minutes} min drive recorded — it's doubled for the round trip when you log the session.`}
      </p>
      <div className="row">
        <button type="button" className="btn btn-outline grow" onClick={app.cancelDrive}>
          Cancel drive
        </button>
        {driving ? (
          <button type="button" className="btn grow" onClick={app.markArrived}>
            I've arrived
          </button>
        ) : (
          <button type="button" className="btn grow" onClick={onStartSession}>
            ▶ Start session
          </button>
        )}
      </div>
    </section>
  );
}

/** Asks where you're driving (optional) and starts the drive clock.
 *  Render only while open. */
function StartDriveDialog({
  onCancel,
  onStart,
}: {
  onCancel: () => void;
  onStart: (location: string) => void;
}) {
  const app = useAppState();
  const [location, setLocation] = useState('');
  return (
    <Dialog label="Start drive" onClose={onCancel}>
      <h2>Start drive</h2>
      <p className="muted" style={{ margin: 0 }}>
        Clocks your travel to the venue. When you start a session after arriving, the drive is
        recorded as travel time and doubled to estimate the round trip.
      </p>
      <label className="field">
        <span>Destination (optional)</span>
        <input
          type="text"
          list="drive-venue-options"
          value={location}
          placeholder="e.g. Bellagio"
          onChange={(e) => setLocation(e.target.value)}
        />
        <datalist id="drive-venue-options">
          {app.availableLocations.map((loc) => (
            <option key={loc} value={loc} />
          ))}
        </datalist>
      </label>
      <div className="actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={() => onStart(location)}>
          🚗 Start drive
        </button>
      </div>
    </Dialog>
  );
}

function RunningSessionCard({ active }: { active: ActiveSession }) {
  const app = useAppState();
  const navigate = useNavigate();
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const now = useNow(true);

  const isTable = active.sessionType === 'TABLE';
  const isTournament = active.sessionType === 'TOURNAMENT' || active.sessionType === 'SNG';
  const gameLabel = isTable ? tableGameLabel(active.tableGame) : gameTypeLabel(active.gameType);
  const stakes =
    !isTable && !isTournament && (active.smallBlind > 0 || active.bigBlind > 0)
      ? `${money(active.smallBlind, active.currency)}/${money(active.bigBlind, active.currency)}`
      : '';
  const summary = [gameLabel, stakes, active.location].filter(Boolean).join(' · ');
  const bountyTotal = active.bountyPerBounty * active.bountyCount;

  const stopAndLog = () => {
    const minutes = Math.max(0, Math.floor((Date.now() - active.startedAt) / 60000));
    // The draft prefills the editor; it's cleared once the session is saved.
    navigate(`/session/new?live=${active.startedAt}&duration=${minutes}`);
  };

  return (
    <section className="card col" style={{ background: 'var(--primary-container)' }}>
      <div className="overline">Live session</div>
      <div className="money" style={{ fontSize: '2rem', fontWeight: 700 }} role="timer">
        {elapsedClock(now - active.startedAt)}
      </div>
      {summary && <div style={{ fontWeight: 600 }}>{summary}</div>}
      <div className="muted">
        Started {formatDateTime(active.startedAt)}
        {active.travelOneWayMinutes > 0 && <> · {active.travelOneWayMinutes} min drive</>}
      </div>
      {(active.buyIn > 0 || active.rebuys > 0) && (
        <div className="muted">
          Buy-in {money(active.buyIn, active.currency)}
          {active.rebuys > 0 && <> · Rebuys {money(active.rebuys, active.currency)}</>}
          {active.rebuys > 0 && (
            <> · In {money(active.buyIn + active.rebuys, active.currency)}</>
          )}
        </div>
      )}
      {isTournament && (
        <div className="row-between" style={{ alignItems: 'center' }}>
          <span>
            Bounties: <strong>{active.bountyCount}</strong>
            {bountyTotal > 0 && (
              <span className="muted"> · {money(bountyTotal, active.currency)}</span>
            )}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Remove a bounty"
              disabled={active.bountyCount === 0}
              onClick={() => app.adjustBounty(active.startedAt, -1)}
            >
              −
            </button>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Add a bounty"
              onClick={() => app.adjustBounty(active.startedAt, 1)}
            >
              + Bounty
            </button>
          </div>
        </div>
      )}
      <button type="button" className="btn btn-outline" onClick={() => setRebuyOpen(true)}>
        + Add rebuy
      </button>
      <div className="row">
        <button type="button" className="btn btn-outline grow" onClick={() => setConfirmDiscard(true)}>
          Discard
        </button>
        <button type="button" className="btn grow" onClick={stopAndLog}>
          ■ Stop &amp; log
        </button>
      </div>
      {/* Mounted per open so a previous amount never lingers in the field. */}
      {rebuyOpen && (
        <RebuyDialog
          currency={active.currency}
          onCancel={() => setRebuyOpen(false)}
          onAdd={(amount) => {
            app.addRebuy(active.startedAt, amount);
            setRebuyOpen(false);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this live session?"
        message="The running timer, buy-in and any rebuys or bounties recorded so far will be lost. Nothing is saved."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          app.clearSession(active.startedAt);
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </section>
  );
}

/** Prompts for a rebuy / re-entry amount to add to the running session.
 *  Render only while open. */
function RebuyDialog({
  currency,
  onCancel,
  onAdd,
}: {
  currency: string;
  onCancel: () => void;
  onAdd: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const value = Number.parseFloat(amount);
  const valid = Number.isFinite(value) && value > 0;
  return (
    <Dialog label="Add rebuy" onClose={onCancel}>
      <h2>Add rebuy</h2>
      <p className="muted" style={{ margin: 0 }}>
        Adds to this session's total buy-in. Log the cash-out when you stop.
      </p>
      <label className="field">
        <span>Rebuy amount</span>
        <MoneyInput currency={currency} value={amount} onChange={setAmount} />
      </label>
      <div className="actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" disabled={!valid} onClick={() => onAdd(value)}>
          Add
        </button>
      </div>
    </Dialog>
  );
}

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
}

/** Captures the session's setup the moment it starts, so game, venue, stakes
 *  and buy-in are recorded up front rather than reconstructed at stop time.
 *  Render only while open. */
function StartSessionDialog({
  onCancel,
  onStart,
}: {
  onCancel: () => void;
  onStart: (setup: Omit<ActiveSession, 'startedAt' | 'travelOneWayMinutes'>) => void;
}) {
  const app = useAppState();
  const { settings } = app;
  const [form, setForm] = useState<SetupState>(() => ({
    sessionType:
      settings.defaultSessionType !== 'ALL'
        ? settings.defaultSessionType
        : settings.showPoker
          ? 'CASH'
          : 'TABLE',
    gameType: 'NLH',
    tableGame: 'BLACKJACK',
    venueType: 'LIVE',
    // Arriving from a tracked drive carries its destination in.
    location: app.pendingDrive?.location ?? '',
    smallBlind: '',
    bigBlind: '',
    buyIn: '',
    bountyPerBounty: '',
  }));

  const set = (patch: Partial<SetupState>) => setForm((prev) => ({ ...prev, ...patch }));
  const num = (v: string) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const isTable = form.sessionType === 'TABLE';
  const isTournament = form.sessionType === 'TOURNAMENT' || form.sessionType === 'SNG';
  const pokerGames = pokerGameOptions(settings, app.recordedPokerGames);
  const tableGames = tableGameOptions(settings, app.recordedTableGames);

  const start = () => {
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
      currency: settings.currency,
    });
  };

  return (
    <Dialog label="Start live session" onClose={onCancel}>
      <h2>Start live session</h2>

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

        <div className="segmented" role="group" aria-label="Live or online">
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

        {!isTable && !isTournament && (
          <div className="row">
            <label className="field grow">
              <span>Small blind</span>
              <MoneyInput
                currency={settings.currency}
                value={form.smallBlind}
                onChange={(v) => set({ smallBlind: v })}
              />
            </label>
            <label className="field grow">
              <span>Big blind</span>
              <MoneyInput
                currency={settings.currency}
                value={form.bigBlind}
                onChange={(v) => set({ bigBlind: v })}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>Buy-in</span>
          <MoneyInput
            currency={settings.currency}
            value={form.buyIn}
            onChange={(v) => set({ buyIn: v })}
          />
        </label>

        {isTournament && (
          <label className="field">
            <span>Bounty per knockout (optional)</span>
            <MoneyInput
              currency={settings.currency}
              value={form.bountyPerBounty}
              onChange={(v) => set({ bountyPerBounty: v })}
            />
          </label>
        )}

      <div className="actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={start}>
          ▶ Start
        </button>
      </div>
    </Dialog>
  );
}
