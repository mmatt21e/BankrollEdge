// Port of Android SettingsScreen: starting bankroll, currency, default view,
// CSV export/import, JSON backup/restore, about.
import { ChangeEvent, useRef, useState } from 'react';
import { useAppState, useStoreList } from '../hooks/useAppState';
import { SessionType, stakePresetLabel } from '../models/types';
import { buildCsv, parseCsv } from '../domain/csv';
import { backupToJson, backupFromJson } from '../domain/backup';
import { exportFile, readFileAsText } from '../services/files';
import { ConfirmDialog, SectionCard } from '../components/common';
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

export default function SettingsPage() {
  const app = useAppState();
  const [bankrollText, setBankrollText] = useState(
    app.settings.startingBankroll === 0 ? '' : String(app.settings.startingBankroll),
  );
  const [unitText, setUnitText] = useState(
    app.settings.betUnitValue === 0 ? '' : String(app.settings.betUnitValue),
  );
  const [message, setMessage] = useState('');
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
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
    } catch {
      setMessage("Couldn't read that file.");
    }
  };

  const doImportCsv = async () => {
    const csv = pendingCsv!;
    setPendingCsv(null);
    try {
      const parsed = parseCsv(csv);
      const count = await app.importSessions(parsed.sessions);
      const skipped = parsed.skippedRows > 0 ? ` (${parsed.skippedRows} rows skipped)` : '';
      setMessage(`Imported ${count} sessions${skipped}.`);
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
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
    <main className="page">
      <h1>Settings</h1>

      {message && (
        <div className="card" role="status" style={{ borderLeft: '4px solid var(--gold-500)' }}>
          {message}
        </div>
      )}

      <SectionCard title="Starting bankroll">
        <p className="muted" style={{ margin: 0 }}>
          Added to your session profits and transactions to show your current bankroll.
        </p>
        <div className="row">
          <label className="field grow">
            <span>Amount ({app.settings.currency})</span>
            <input
              type="text"
              inputMode="decimal"
              value={bankrollText}
              onChange={(e) => setBankrollText(e.target.value.replace(/[^0-9.]/g, ''))}
            />
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

      <SectionCard title="Default view">
        <p className="muted" style={{ margin: 0 }}>
          Focus the app on the games you play. Applied to session lists, stats and new sessions.
        </p>
        <div className="segmented" role="group" aria-label="Default view">
          {(
            [
              ['ALL', 'All games'],
              ['CASH', 'Cash'],
              ['TOURNAMENT', 'Tourneys'],
            ] as ['ALL' | SessionType, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={app.settings.defaultSessionType === value}
              onClick={() => app.updateSettings({ defaultSessionType: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Sports betting">
        <p className="muted" style={{ margin: 0 }}>
          Unit size shows your betting results in units alongside money; the odds format applies
          to entering and displaying bet prices.
        </p>
        <div className="row">
          <label className="field grow">
            <span>Unit size ({app.settings.currency}, 0 = off)</span>
            <input
              type="text"
              inputMode="decimal"
              value={unitText}
              onChange={(e) => setUnitText(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </label>
          <button
            type="button"
            className="btn"
            style={{ alignSelf: 'flex-end' }}
            onClick={() =>
              app.updateSettings({ betUnitValue: Number.parseFloat(unitText) || 0 })
            }
          >
            Save
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Odds format">
          {(
            [
              ['AMERICAN', 'American (-110)'],
              ['DECIMAL', 'Decimal (1.91)'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={app.settings.oddsFormat === value}
              onClick={() => app.updateSettings({ oddsFormat: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </SectionCard>

      <VenuesStakesCard />

      <SectionCard title="CSV export & import">
        <p className="muted" style={{ margin: 0 }}>
          Export all {app.sessions.length} sessions to a spreadsheet-friendly CSV, or import
          sessions from a previous export (Android or web — same format).
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-outline"
            disabled={app.sessions.length === 0}
            onClick={() => exportFile('bankrolledge_export.csv', buildCsv(app.sessions), 'text/csv')}
          >
            Export
          </button>
          <button type="button" className="btn btn-outline" onClick={() => csvInput.current?.click()}>
            Import CSV
          </button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => readPicked(e, setPendingCsv)}
          />
        </div>
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

      <PrivacyCard />

      <SectionCard title="About">
        <p style={{ margin: 0, fontWeight: 600 }}>BankrollEdge</p>
        <p className="muted" style={{ margin: 0 }}>
          A bankroll tracker for poker, casino table games and sports betting. Web version
          1.10.0 — works fully offline; all data stays on this device. Install it from your
          browser menu for an app-like experience.
        </p>
      </SectionCard>

      <ConfirmDialog
        open={pendingCsv !== null}
        title="Import sessions?"
        message="Sessions from this CSV are ADDED to your existing data (nothing is deleted). Rows that can't be read are skipped."
        confirmLabel="Import"
        onConfirm={doImportCsv}
        onCancel={() => setPendingCsv(null)}
      />
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
  );
}

function VenuesStakesCard() {
  const venues = useStoreList(venueStore);
  const stakes = useStoreList(stakeStore);
  const poker = stakes.items
    .filter((s) => s.kind === 'POKER')
    .sort((a, b) => a.smallBlind - b.smallBlind || a.bigBlind - b.bigBlind);
  const table = stakes.items
    .filter((s) => s.kind === 'TABLE')
    .sort((a, b) => a.minBet - b.minBet || a.maxBet - b.maxBet);
  const sortedVenues = [...venues.items].sort((a, b) => a.name.localeCompare(b.name));

  const [venueName, setVenueName] = useState('');
  const [pkSb, setPkSb] = useState('');
  const [pkBb, setPkBb] = useState('');
  const [tbMin, setTbMin] = useState('');
  const [tbMax, setTbMax] = useState('');
  const dec = (v: string) => v.replace(/[^0-9.]/g, '');

  const addVenue = async () => {
    const n = venueName.trim();
    if (!n) return;
    if (!venues.items.some((v) => v.name.toLowerCase() === n.toLowerCase())) {
      await venues.save({ id: 0, name: n });
    }
    setVenueName('');
  };
  const addPoker = async () => {
    const a = Number.parseFloat(pkSb) || 0;
    const b = Number.parseFloat(pkBb) || 0;
    if (a <= 0 && b <= 0) return;
    await stakes.save({ id: 0, kind: 'POKER', smallBlind: a, bigBlind: b, minBet: 0, maxBet: 0 });
    setPkSb('');
    setPkBb('');
  };
  const addTable = async () => {
    const a = Number.parseFloat(tbMin) || 0;
    const b = Number.parseFloat(tbMax) || 0;
    if (a <= 0 && b <= 0) return;
    await stakes.save({ id: 0, kind: 'TABLE', smallBlind: 0, bigBlind: 0, minBet: a, maxBet: b });
    setTbMin('');
    setTbMax('');
  };

  return (
    <SectionCard title="Venues & stakes">
      <p className="muted" style={{ margin: 0 }}>
        Saved here, these appear as dropdown choices when you log a session — pick one instead of
        retyping it. You can also add new ones straight from the session screen.
      </p>

      <div className="col" style={{ gap: 8 }}>
        <span className="overline">Venues</span>
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
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="overline">Cash game stakes</span>
        {poker.length === 0 && (
          <p className="muted small" style={{ margin: 0 }}>No saved blinds yet.</p>
        )}
        {poker.map((p) => (
          <div className="row-between" key={p.id}>
            <span>{stakePresetLabel(p)}</span>
            <button
              type="button"
              className="back"
              aria-label={`Delete ${stakePresetLabel(p)}`}
              onClick={() => stakes.remove(p.id)}
            >
              🗑
            </button>
          </div>
        ))}
        <div className="row">
          <label className="field grow">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Small blind"
              value={pkSb}
              onChange={(e) => setPkSb(dec(e.target.value))}
            />
          </label>
          <label className="field grow">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Big blind"
              value={pkBb}
              onChange={(e) => setPkBb(dec(e.target.value))}
            />
          </label>
          <button type="button" className="btn" onClick={addPoker}>Add</button>
        </div>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="overline">Table game stakes</span>
        {table.length === 0 && (
          <p className="muted small" style={{ margin: 0 }}>No saved table stakes yet.</p>
        )}
        {table.map((p) => (
          <div className="row-between" key={p.id}>
            <span>{stakePresetLabel(p)}</span>
            <button
              type="button"
              className="back"
              aria-label={`Delete ${stakePresetLabel(p)}`}
              onClick={() => stakes.remove(p.id)}
            >
              🗑
            </button>
          </div>
        ))}
        <div className="row">
          <label className="field grow">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Min bet"
              value={tbMin}
              onChange={(e) => setTbMin(dec(e.target.value))}
            />
          </label>
          <label className="field grow">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Max bet"
              value={tbMax}
              onChange={(e) => setTbMax(dec(e.target.value))}
            />
          </label>
          <button type="button" className="btn" onClick={addTable}>Add</button>
        </div>
      </div>
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
