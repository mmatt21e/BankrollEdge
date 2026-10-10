// Live-session card for the dashboard: start a session (capturing its setup
// up front), watch the running clock, add rebuys / bounties, then stop & log.
// Moved out of the old Play screen when it merged into the Dashboard.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useNow } from '../hooks/useAppState';
import { money, elapsedClock, formatDateTime } from '../domain/format';
import {
  ActiveSession,
  gameTypeLabel,
  tableGameLabel,
} from '../models/types';
import { ConfirmDialog, Dialog, MoneyInput } from './common';
import { activeCommuteMinutes } from '../domain/commute';
import { useSessionEntry } from '../hooks/useSessionEntry';

/** Session timers track play only. Commute is entered manually. */
export function LiveSessionCard() {
  const app = useAppState();
  const openSessionEntry = useSessionEntry();
  return (
    <>
      {app.activeSessions.map((active) => <RunningSessionCard key={active.startedAt} active={active} />)}
      <button type="button" className="live-start" data-session-add="dashboard" onClick={() => openSessionEntry('dashboard', 'dashboard')}>
        <span aria-hidden="true">▶</span>{' '}
        {app.activeSessions.length > 0 ? 'Add another session' : 'Add session'}
      </button>
    </>
  );
}

function RunningSessionCard({ active }: { active: ActiveSession }) {
  const app = useAppState();
  const navigate = useNavigate();
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const finishing = useRef(false);
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
    if (finishing.current) return;
    finishing.current = true;
    const minutes = Math.max(0, Math.floor((Date.now() - active.startedAt) / 60000));
    // The editor keeps commute editable, separately from elapsed play time.
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
        {activeCommuteMinutes(active) > 0 && <> · Commute: {activeCommuteMinutes(active)} min</>}
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
