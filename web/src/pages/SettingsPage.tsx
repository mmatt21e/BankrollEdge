// Port of Android SettingsScreen: starting bankroll, currency, default view,
// CSV export/import, JSON backup/restore, about.
import { ChangeEvent, useRef, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { SessionType } from '../models/types';
import { buildCsv, parseCsv } from '../domain/csv';
import { backupToJson, backupFromJson } from '../domain/backup';
import { exportFile, readFileAsText } from '../services/files';
import { ConfirmDialog, SectionCard } from '../components/common';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'BRL', 'MXN', 'JPY'];

export default function SettingsPage() {
  const app = useAppState();
  const [bankrollText, setBankrollText] = useState(
    app.settings.startingBankroll === 0 ? '' : String(app.settings.startingBankroll),
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
            onClick={() =>
              exportFile(
                'bankrolledge_backup.json',
                backupToJson(
                  {
                    settings: app.settings,
                    sessions: app.sessions,
                    transactions: app.transactions,
                  },
                  Date.now(),
                ),
                'application/json',
              )
            }
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

      <SectionCard title="About">
        <p style={{ margin: 0, fontWeight: 600 }}>BankrollEdge</p>
        <p className="muted" style={{ margin: 0 }}>
          A poker bankroll tracker for cash games and tournaments. Web version 1.2 — works fully
          offline; all data stays on this device. Install it from your browser menu for an
          app-like experience.
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
