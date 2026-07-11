// Guided CSV import with column mapping — bring session history in from other
// poker apps or spreadsheets. Pick/paste a CSV, we auto-match the columns, you
// adjust the mapping, preview the result, then import (adds to existing data).
import { ChangeEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  MAP_FIELDS,
  MapFieldGroup,
  ColumnMapping,
  DateFormat,
  analyzeCsv,
  guessMapping,
  applyMapping,
} from '../domain/importMap';
import { SessionType, SESSION_TYPES, SESSION_TYPE_LABELS, profit } from '../models/types';
import { signedMoney, formatDate } from '../domain/format';
import { readFileAsText } from '../services/files';
import { SectionCard, TopBar, profitClass } from '../components/common';

const GROUPS: MapFieldGroup[] = ['Essentials', 'Money', 'Game details', 'Extras'];

export default function ImportPage() {
  const navigate = useNavigate();
  const { importSessions, settings } = useAppState();

  const [raw, setRaw] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>('AUTO');
  const [defaultType, setDefaultType] = useState<SessionType>('CASH');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (text: string) => {
    const { headers: h, rows: r } = analyzeCsv(text);
    setRaw(text);
    setHeaders(h);
    setRows(r);
    setMapping(guessMapping(h));
    setMessage('');
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      load(await readFileAsText(file));
    } catch {
      setMessage("Couldn't read that file.");
    }
  };

  const result = useMemo(() => {
    if (headers.length === 0 || mapping.date === undefined) return null;
    return applyMapping(rows, mapping, {
      dateFormat,
      defaultCurrency: settings.currency,
      defaultSessionType: defaultType,
    });
  }, [headers.length, rows, mapping, dateFormat, defaultType, settings.currency]);

  const setField = (key: string, value: string) =>
    setMapping((prev) => {
      const next = { ...prev };
      if (value === '') delete next[key as keyof ColumnMapping];
      else next[key as keyof ColumnMapping] = Number(value);
      return next;
    });

  const doImport = async () => {
    if (!result || result.sessions.length === 0) return;
    setBusy(true);
    const count = await importSessions(result.sessions);
    const skipped = result.skipped > 0 ? ` (${result.skipped} rows skipped)` : '';
    setBusy(false);
    setMessage(`Imported ${count} sessions${skipped}.`);
    // Reset so the same file isn't imported twice by accident.
    setRaw('');
    setHeaders([]);
    setRows([]);
    setMapping({});
  };

  const loaded = headers.length > 0;
  const dateMapped = mapping.date !== undefined;
  const hasResult = mapping.cashOut !== undefined || mapping.net !== undefined;

  return (
    <>
      <TopBar title="Import from another app" onBack={() => navigate(-1)} />
      <main className="page" style={{ paddingTop: 0 }}>
        {message && (
          <div className="card" role="status" style={{ borderLeft: '4px solid var(--gold-500)' }}>
            {message}
          </div>
        )}

        {!loaded && (
          <SectionCard title="Choose a CSV">
            <p className="muted" style={{ margin: 0 }}>
              Export your history from the other app as a CSV, then load it here. It doesn't
              need to match BankrollEdge's format — you'll map the columns on the next step.
              Only a date column is required.
            </p>
            <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                hidden
                onChange={onPickFile}
              />
            </label>
            <details>
              <summary className="muted small" style={{ cursor: 'pointer' }}>
                …or paste CSV text
              </summary>
              <textarea
                rows={5}
                placeholder="Date,Location,Buy In,Cash Out&#10;2026-01-05,Bellagio,300,540"
                style={{ width: '100%', marginTop: 8 }}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline"
                style={{ marginTop: 8 }}
                disabled={raw.trim() === ''}
                onClick={() => load(raw)}
              >
                Load pasted text
              </button>
            </details>
          </SectionCard>
        )}

        {loaded && (
          <>
            <SectionCard title="Map your columns">
              <p className="muted" style={{ margin: 0 }}>
                Detected {headers.length} columns and {rows.length} rows. We've guessed the
                matches below — adjust any that are wrong. Anything left as
                “Not imported” is skipped.
              </p>

              <div className="row">
                <label className="field grow">
                  <span>Date format (for ambiguous dates)</span>
                  <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                    <option value="AUTO">Auto-detect</option>
                    <option value="MDY">MM/DD/YYYY (US)</option>
                    <option value="DMY">DD/MM/YYYY</option>
                    <option value="YMD">YYYY/MM/DD</option>
                  </select>
                </label>
                <label className="field grow">
                  <span>Default type (unmapped rows)</span>
                  <select value={defaultType} onChange={(e) => setDefaultType(e.target.value as SessionType)}>
                    {SESSION_TYPES.map((t) => (
                      <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
              </div>

              {GROUPS.map((group) => (
                <div key={group}>
                  <div className="overline" style={{ marginTop: 8 }}>{group}</div>
                  {MAP_FIELDS.filter((f) => f.group === group).map((f) => (
                    <label className="field" key={f.key}>
                      <span>
                        {f.label}
                        {f.required && <span className="neg"> *</span>}
                        {f.hint && <span className="muted small"> — {f.hint}</span>}
                      </span>
                      <select
                        value={mapping[f.key] ?? ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                      >
                        <option value="">— Not imported —</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Preview">
              {!dateMapped ? (
                <p className="neg" role="alert" style={{ margin: 0 }}>
                  Map the <strong>Date / time</strong> column to continue.
                </p>
              ) : result ? (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    <strong>{result.sessions.length}</strong> sessions will be imported
                    {result.skipped > 0 && (
                      <> · <span className="neg">{result.skipped} skipped</span> (unreadable date)</>
                    )}
                    .
                  </p>
                  {!hasResult && (
                    <p className="neg small" role="alert" style={{ margin: 0 }}>
                      No cash-out or net-profit column mapped — every session will import as a
                      break-even/loss. Map one of those for correct results.
                    </p>
                  )}
                  {mapping.cashOut !== undefined && mapping.net !== undefined && (
                    <p className="muted small" style={{ margin: 0 }}>
                      Both cash-out and net mapped — cash-out is used; net is ignored.
                    </p>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Date</th><th>Type</th><th>Location</th>
                          <th style={{ textAlign: 'right' }}>Buy-in</th>
                          <th style={{ textAlign: 'right' }}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.sessions.slice(0, 6).map((s, i) => {
                          const p = profit(s);
                          return (
                            <tr key={i}>
                              <td>{formatDate(s.startTime)}</td>
                              <td>{SESSION_TYPE_LABELS[s.sessionType]}</td>
                              <td>{s.location || '—'}</td>
                              <td className="money" style={{ textAlign: 'right' }}>{s.buyIn || '—'}</td>
                              <td className={`money ${profitClass(p)}`} style={{ textAlign: 'right' }}>
                                {signedMoney(p, s.currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {result.sessions.length > 6 && (
                    <p className="muted small" style={{ margin: 0 }}>
                      …and {result.sessions.length - 6} more.
                    </p>
                  )}
                </>
              ) : null}

              <div className="row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setHeaders([]);
                    setRows([]);
                    setRaw('');
                    setMapping({});
                  }}
                >
                  Choose a different file
                </button>
                <button
                  type="button"
                  className="btn grow"
                  disabled={busy || !result || result.sessions.length === 0}
                  onClick={doImport}
                >
                  {busy ? 'Importing…' : `Import ${result?.sessions.length ?? 0} sessions`}
                </button>
              </div>
            </SectionCard>
          </>
        )}
      </main>
    </>
  );
}
