// Settings → Data & backup: CSV export/import, JSON backup & restore
// (replace or merge), and the clear-data danger zone.
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, type ClearScope, type RestoreMode } from '../hooks/useAppState';
import { buildCsv } from '../domain/csv';
import { buildBetsCsv } from '../domain/bets';
import { backupToJson, backupFromJson } from '../domain/backup';
import { exportFile, readFileAsText } from '../services/files';
import {
  ConfirmDialog,
  MessageBanner,
  SectionCard,
  TopBar,
  useBack,
  useSectionHighlight,
} from '../components/common';
import {
  eventStore,
  handNoteStore,
  homeGameStore,
  playerNoteStore,
  stakeStore,
  structureStore,
  venueStore,
  walletStore,
} from '../storage/db';

export default function DataSettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const back = useBack('/settings');
  useSectionHighlight();
  const canSession = app.settings.showPoker || app.settings.showTableGames;
  const [message, setMessage] = useState('');
  const [pendingBackup, setPendingBackup] = useState<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  const readPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPendingBackup(await readFileAsText(file));
    } catch (err) {
      setMessage(`Couldn't read “${file.name}”: ${(err as Error).message}.`);
    }
  };

  const doRestore = async (mode: RestoreMode) => {
    const json = pendingBackup!;
    setPendingBackup(null);
    try {
      const backup = backupFromJson(json);
      await app.restoreBackup(backup, mode);
      setMessage(
        `${mode === 'replace' ? 'Restored' : 'Added'} ${backup.sessions.length} sessions and ${backup.transactions.length} transactions.`,
      );
    } catch (err) {
      setMessage(`Restore failed: ${(err as Error).message} Your existing data was not changed.`);
    }
  };

  return (
    <>
      <TopBar title="Data & backup" onBack={back} />
      <main className="page page--with-topbar">
        <MessageBanner>{message}</MessageBanner>

        <SectionCard id="csv" title="CSV export & import">
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
                Import maps columns from any app's CSV — with one-tap presets for Pokerbase,
                Poker Bankroll Tracker and Poker Income.
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
                Import maps columns from any app or sportsbook CSV — American or decimal odds
                are both understood.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard id="backup" title="Backup & restore">
          <p className="muted" style={{ margin: 0 }}>
            Save everything (sessions, bankroll transactions and settings) to a JSON file, or
            restore from a previous backup. Backup files are interchangeable with the Android
            app.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-outline"
              onClick={async () => {
                // Gather the tool collections so the backup covers everything.
                const [handNotes, homeGames, structures, events, venues, stakes, wallets, playerNotes] =
                  await Promise.all([
                    handNoteStore.list(),
                    homeGameStore.list(),
                    structureStore.list(),
                    eventStore.list(),
                    venueStore.list(),
                    stakeStore.list(),
                    walletStore.list(),
                    playerNoteStore.list(),
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
                      wallets,
                      playerNotes,
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
              onChange={readPicked}
            />
          </div>
        </SectionCard>

        <ClearDataCard onResult={setMessage} />

        <RestoreChoiceDialog
          open={pendingBackup !== null}
          onChoose={doRestore}
          onCancel={() => setPendingBackup(null)}
        />
      </main>
    </>
  );
}

/** Asks how to apply a picked backup: replace everything or add to what's
 *  here. Same backdrop/dialog pattern as ConfirmDialog. */
function RestoreChoiceDialog({
  open,
  onChoose,
  onCancel,
}: {
  open: boolean;
  onChoose: (mode: RestoreMode) => void;
  onCancel: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div role="alertdialog" aria-modal="true" aria-label="Restore backup" className="dialog">
        <h2>Restore backup</h2>
        <p className="muted" style={{ margin: 0 }}>
          How should this backup be applied?
        </p>
        <div className="col" style={{ gap: 8 }}>
          <button type="button" ref={firstRef} className="btn" onClick={() => onChoose('merge')}>
            Add to current data
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            Keeps everything you have and adds the backup's sessions, bets, transactions and
            tool data. This device's settings are kept.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => onChoose('replace')}>
            Replace all data
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            Deletes ALL current data first, then restores the backup — including its bankroll
            settings. This can't be undone.
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
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
    <SectionCard id="clear" title="Clear data">
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
