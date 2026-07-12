// Settings → General: bankroll, currency, saved venues, CSV export/import,
// JSON backup & restore, privacy and about.
import { ChangeEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useStoreList, type ClearScope } from '../hooks/useAppState';
import { buildCsv } from '../domain/csv';
import { buildBetsCsv } from '../domain/bets';
import { backupToJson, backupFromJson } from '../domain/backup';
import { exportFile, readFileAsText } from '../services/files';
import { ConfirmDialog, MoneyInput, SectionCard, TopBar } from '../components/common';
import {
  eventStore,
  handNoteStore,
  homeGameStore,
  stakeStore,
  structureStore,
  venueStore,
} from '../storage/db';
import {
  hasPin,
  setPin,
  clearPin,
  loadHideBalances,
  saveHideBalances,
} from '../storage/settings';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'BRL', 'MXN', 'JPY'];

export default function GeneralSettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const canSession = app.settings.showPoker || app.settings.showTableGames;
  const [bankrollText, setBankrollText] = useState(
    app.settings.startingBankroll === 0 ? '' : String(app.settings.startingBankroll),
  );
  const [sportsBankrollText, setSportsBankrollText] = useState(
    app.settings.startingSportsBankroll === 0 ? '' : String(app.settings.startingSportsBankroll),
  );
  const [message, setMessage] = useState('');
  const [pendingBackup, setPendingBackup] = useState<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  const readPicked = async (
    e: ChangeEvent<HTMLInputElement>,
    setPending: (text: string) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(await readFileAsText(file));
    } catch (err) {
      setMessage(`Couldn't read “${file.name}”: ${(err as Error).message}.`);
    }
  };

  const doRestore = async () => {
    const json = pendingBackup!;
    setPendingBackup(null);
    try {
      const backup = backupFromJson(json);
      await app.restoreBackup(backup);
      setBankrollText(
        backup.settings.startingBankroll === 0 ? '' : String(backup.settings.startingBankroll),
      );
      setMessage(
        `Restored ${backup.sessions.length} sessions and ${backup.transactions.length} transactions.`,
      );
    } catch (err) {
      setMessage(`Restore failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
    <TopBar title="General" onBack={() => navigate(-1)} />
    <main className="page" style={{ paddingTop: 0 }}>
      {message && (
        <div className="card" role="status" style={{ borderLeft: '4px solid var(--gold-500)' }}>
          {message}
        </div>
      )}

      <SectionCard title="Bankroll">
        <p className="muted" style={{ margin: 0 }}>
          Your starting bankroll is added to session profits and transactions to show your
          current bankroll.
        </p>
        <div className="row">
          <label className="field grow">
            <span>Starting amount</span>
            <MoneyInput value={bankrollText} onChange={setBankrollText} />
          </label>
          <button
            type="button"
            className="btn"
            style={{ alignSelf: 'flex-end' }}
            onClick={() =>
              app.updateSettings({ startingBankroll: Number.parseFloat(bankrollText) || 0 })
            }
          >
            Save
          </button>
        </div>
        {app.settings.showSports && (
          <>
            <div className="segmented" role="group" aria-label="Bankroll mode">
              {(
                [
                  [false, 'One bankroll for all'],
                  [true, 'Separate sports roll'],
                ] as [boolean, string][]
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={app.settings.separateBankrolls === value}
                  onClick={() => app.updateSettings({ separateBankrolls: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            {app.settings.separateBankrolls && (
              <div className="row">
                <label className="field grow">
                  <span>Sports starting bankroll</span>
                  <MoneyInput value={sportsBankrollText} onChange={setSportsBankrollText} />
                </label>
                <button
                  type="button"
                  className="btn"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() =>
                    app.updateSettings({
                      startingSportsBankroll: Number.parseFloat(sportsBankrollText) || 0,
                    })
                  }
                >
                  Save
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Default currency">
        <label className="field">
          <span>Applied to new sessions; existing sessions keep their own currency.</span>
          <select
            value={app.settings.currency}
            onChange={(e) => app.updateSettings({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </SectionCard>

      {canSession && <VenuesCard />}

      <SectionCard title="CSV export & import">
        <p className="muted" style={{ margin: 0 }}>
          Spreadsheet-friendly CSVs. Imports ADD to your existing data.
        </p>
        {canSession && (
          <>
            <div className="overline">Sessions ({app.sessions.length})</div>
            <div className="row">
              <button
                type="button"
                className="btn btn-outline"
                disabled={app.sessions.length === 0}
                onClick={() => exportFile('bankrolledge_export.csv', buildCsv(app.sessions), 'text/csv')}
              >
                Export
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate('/settings/import')}
              >
                Import CSV
              </button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Import maps columns from any app's CSV — BankrollEdge, other poker trackers or a
              spreadsheet.
            </p>
          </>
        )}
        {app.settings.showSports && (
          <>
            <div className="overline">Sports bets ({app.bets.length})</div>
            <div className="row">
              <button
                type="button"
                className="btn btn-outline"
                disabled={app.bets.length === 0}
                onClick={() => exportFile('bankrolledge_bets.csv', buildBetsCsv(app.bets), 'text/csv')}
              >
                Export
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate('/settings/import?type=bets')}
              >
                Import CSV
              </button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Import maps columns from any app or sportsbook CSV — American or decimal odds are
              both understood.
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard title="Backup & restore">
        <p className="muted" style={{ margin: 0 }}>
          Save everything (sessions, bankroll transactions and settings) to a JSON file, or
          restore from a previous backup. Backup files are interchangeable with the Android app.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              // Gather the tool collections so the backup covers everything.
              const [handNotes, homeGames, structures, events, venues, stakes] =
                await Promise.all([
                  handNoteStore.list(),
                  homeGameStore.list(),
                  structureStore.list(),
                  eventStore.list(),
                  venueStore.list(),
                  stakeStore.list(),
                ]);
              await exportFile(
                'bankrolledge_backup.json',
                backupToJson(
                  {
                    settings: app.settings,
                    sessions: app.sessions,
                    transactions: app.transactions,
                    bets: app.bets,
                    handNotes,
                    homeGames,
                    structures,
                    events,
                    venues,
                    stakes,
                  },
                  Date.now(),
                ),
                'application/json',
              );
            }}
          >
            Export backup
          </button>
          <button type="button" className="btn btn-outline" onClick={() => backupInput.current?.click()}>
            Restore
          </button>
          <input
            ref={backupInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => readPicked(e, setPendingBackup)}
          />
        </div>
      </SectionCard>

      <ClearDataCard onResult={setMessage} />

      <PrivacyCard />

      <SectionCard title="About">
        <p style={{ margin: 0, fontWeight: 600 }}>BankrollEdge</p>
        <p className="muted" style={{ margin: 0 }}>
          A bankroll tracker for poker, casino table games and sports betting. Web version
          1.32.1 — works fully offline; all data stays on this device. Install it from your
          browser menu for an app-like experience.
        </p>
      </SectionCard>

      <ConfirmDialog
        open={pendingBackup !== null}
        title="Restore backup?"
        message="This replaces ALL current sessions, transactions and settings with the backup's contents. This can't be undone."
        confirmLabel="Restore"
        danger
        onConfirm={doRestore}
        onCancel={() => setPendingBackup(null)}
      />
    </main>
    </>
  );
}

/** Saved venues — shared by poker and table-game sessions. */
function VenuesCard() {
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
    <SectionCard title="Saved venues">
      <p className="muted" style={{ margin: 0 }}>
        These appear as dropdown choices when you log a session — pick one instead of retyping
        it. You can also add new ones straight from the session screen.
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
  );
}

/** Danger zone: permanently delete logged results by category or all at once. */
function ClearDataCard({ onResult }: { onResult: (msg: string) => void }) {
  const app = useAppState();
  const [pending, setPending] = useState<ClearScope | null>(null);

  const pokerCount = app.sessions.filter((s) => s.sessionType !== 'TABLE').length;
  const tableCount = app.sessions.filter((s) => s.sessionType === 'TABLE').length;
  const sportsCount = app.bets.length;
  const allCount = app.sessions.length + app.bets.length + app.transactions.length;

  const NOUN: Record<ClearScope, string> = {
    poker: 'poker sessions',
    table: 'table-game sessions',
    sports: 'sports bets',
    all: 'sessions, bets and bankroll transactions',
  };
  const COUNT: Record<ClearScope, number> = {
    poker: pokerCount,
    table: tableCount,
    sports: sportsCount,
    all: allCount,
  };

  const run = async () => {
    const scope = pending;
    setPending(null);
    if (!scope) return;
    const n = await app.clearData(scope);
    onResult(n === 0 ? 'Nothing to clear.' : `Cleared ${n} ${scope === 'all' ? 'records' : NOUN[scope]}.`);
  };

  const clearButton = (scope: ClearScope, text: string, count: number, danger = false) => (
    <button
      type="button"
      className={`btn ${danger ? 'btn-danger' : 'btn-outline'}`}
      disabled={count === 0}
      onClick={() => setPending(scope)}
    >
      {text} ({count})
    </button>
  );

  return (
    <SectionCard title="Clear data">
      <p className="muted" style={{ margin: 0 }}>
        Permanently delete logged results by category, or everything at once. This can't be
        undone — export a backup first if you're not sure. Saved venues, blind structures and
        hand notes are not affected.
      </p>
      <div className="col" style={{ gap: 8 }}>
        {app.settings.showPoker && clearButton('poker', 'Clear poker', pokerCount)}
        {app.settings.showTableGames && clearButton('table', 'Clear table games', tableCount)}
        {app.settings.showSports && clearButton('sports', 'Clear sports bets', sportsCount)}
        {clearButton('all', 'Clear all data', allCount, true)}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Clear this data?"
        message={
          pending
            ? `This permanently deletes ${COUNT[pending]} ${NOUN[pending]}. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </SectionCard>
  );
}

function PrivacyCard() {
  const [pinSet, setPinSet] = useState(hasPin());
  const [newPin, setNewPin] = useState('');
  const [hide, setHide] = useState(loadHideBalances());

  const applyHide = (value: boolean) => {
    setHide(value);
    saveHideBalances(value);
    document.body.classList.toggle('privacy-hide', value);
  };

  return (
    <SectionCard title="Privacy">
      <p className="muted" style={{ margin: 0 }}>
        Everything stays on this device — nothing is uploaded anywhere. These controls guard
        against someone glancing at (or opening) the app on your phone.
      </p>

      <div className="row-between" style={{ marginTop: 4 }}>
        <span>Hide balances (blur all money)</span>
        <button
          type="button"
          className="chip"
          aria-pressed={hide}
          style={{ minHeight: 44 }}
          onClick={() => applyHide(!hide)}
        >
          {hide ? 'On' : 'Off'}
        </button>
      </div>

      {pinSet ? (
        <div className="row-between">
          <span>PIN lock is on</span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              clearPin();
              setPinSet(false);
            }}
          >
            Remove PIN
          </button>
        </div>
      ) : (
        <div className="row">
          <label className="field grow">
            <span>Set a 4–8 digit PIN (required at launch)</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={newPin}
              maxLength={8}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <button
            type="button"
            className="btn"
            style={{ alignSelf: 'flex-end' }}
            disabled={newPin.length < 4}
            onClick={async () => {
              await setPin(newPin);
              setNewPin('');
              setPinSet(true);
            }}
          >
            Set PIN
          </button>
        </div>
      )}
      {pinSet && (
        <p className="muted small" style={{ margin: 0 }}>
          Forgot the PIN? Clearing the browser's site data removes it — along with your
          data, so keep a backup exported.
        </p>
      )}
    </SectionCard>
  );
}
