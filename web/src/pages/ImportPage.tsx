// Guided CSV import with column mapping — brings history in from other apps or
// spreadsheets for either poker/table sessions (?type=sessions, default) or
// sports bets (?type=bets). Pick/paste a CSV, we auto-match the columns, you
// adjust the mapping, preview the result, then import (adds to existing data).
import { ChangeEvent, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  MAP_FIELDS,
  MapField,
  DateFormat,
  analyzeCsv,
  guessMapping,
  applyMapping,
} from '../domain/importMap';
import {
  BET_MAP_FIELDS,
  OddsInputFormat,
  guessBetMapping,
  applyBetMapping,
} from '../domain/betImportMap';
import { betProfit } from '../domain/bets';
import {
  SessionType,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  SPORT_LABELS,
  profit,
} from '../models/types';
import { signedMoney, formatDate } from '../domain/format';
import { readFileAsText, describeCsvProblem, formatBytes } from '../services/files';
import { SectionCard, TopBar, profitClass } from '../components/common';

interface PreviewRow {
  cells: { text: string; align?: 'right'; className?: string }[];
}
interface BuiltImport {
  count: number;
  skipped: number;
  previewHeaders: string[];
  previewRows: PreviewRow[];
  run: () => Promise<number>;
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { importSessions, importBets, settings } = useAppState();
  const [params] = useSearchParams();
  const kind = params.get('type') === 'bets' ? 'bets' : 'sessions';

  const fields: MapField[] = kind === 'bets' ? BET_MAP_FIELDS : MAP_FIELDS;
  const requiredKey = kind === 'bets' ? 'placedAt' : 'date';
  const noun = kind === 'bets' ? 'bets' : 'sessions';
  const groups = useMemo(() => [...new Set(fields.map((f) => f.group))], [fields]);

  const [raw, setRaw] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>('AUTO');
  const [oddsFormat, setOddsFormat] = useState<OddsInputFormat>('AUTO');
  const [defaultType, setDefaultType] = useState<SessionType>('CASH');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setHeaders([]);
    setRows([]);
    setRaw('');
    setMapping({});
  };

  /** Validates the text and, if it's usable, loads it. On any problem it sets
   *  a specific message and returns false. [source] names the origin for the
   *  message, e.g. '“trades.csv”' or 'the pasted text'. */
  const load = (text: string, source: string): boolean => {
    const problem = describeCsvProblem(text, source);
    if (problem) {
      setMessage(`Couldn't use ${source}: ${problem}.`);
      return false;
    }
    const { headers: h, rows: r } = analyzeCsv(text);
    if (h.length === 0) {
      setMessage(`No columns found in ${source}. Make sure it's a comma-separated CSV with a header row.`);
      return false;
    }
    if (h.length === 1 && !text.includes(',')) {
      setMessage(
        `${source} has only one column — it may use tabs or semicolons instead of commas. Re-export it as comma-separated (CSV) and try again.`,
      );
      return false;
    }
    setRaw(text);
    setHeaders(h);
    setRows(r);
    setMapping(kind === 'bets' ? guessBetMapping(h) : guessMapping(h));
    setMessage('');
    return true;
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const named = `“${file.name}”`;
    try {
      const text = await readFileAsText(file);
      load(text, named);
    } catch (err) {
      // Surface the actual reason (empty, unreadable cloud file, denied, …).
      setMessage(`Couldn't read ${named} (${formatBytes(file.size)}): ${(err as Error).message}.`);
    }
  };

  const built: BuiltImport | null = useMemo(() => {
    if (headers.length === 0 || mapping[requiredKey] === undefined) return null;
    if (kind === 'bets') {
      const r = applyBetMapping(rows, mapping, {
        dateFormat,
        oddsFormat,
        defaultCurrency: settings.currency,
      });
      return {
        count: r.bets.length,
        skipped: r.skipped,
        previewHeaders: ['Date', 'Sport', 'Pick', 'Stake', 'Net'],
        previewRows: r.bets.slice(0, 6).map((b) => {
          const p = betProfit(b);
          return {
            cells: [
              { text: formatDate(b.placedAt) },
              { text: SPORT_LABELS[b.sport] },
              { text: b.pick || b.event || '—' },
              { text: b.stake ? String(b.stake) : '—', align: 'right' },
              { text: signedMoney(p, b.currency), align: 'right', className: profitClass(p) },
            ],
          };
        }),
        run: () => importBets(r.bets),
      };
    }
    const r = applyMapping(rows, mapping, {
      dateFormat,
      defaultCurrency: settings.currency,
      defaultSessionType: defaultType,
    });
    return {
      count: r.sessions.length,
      skipped: r.skipped,
      previewHeaders: ['Date', 'Type', 'Location', 'Buy-in', 'Net'],
      previewRows: r.sessions.slice(0, 6).map((s) => {
        const p = profit(s);
        return {
          cells: [
            { text: formatDate(s.startTime) },
            { text: SESSION_TYPE_LABELS[s.sessionType] },
            { text: s.location || '—' },
            { text: s.buyIn ? String(s.buyIn) : '—', align: 'right' },
            { text: signedMoney(p, s.currency), align: 'right', className: profitClass(p) },
          ],
        };
      }),
      run: () => importSessions(r.sessions),
    };
  }, [kind, headers.length, rows, mapping, dateFormat, oddsFormat, defaultType, settings.currency, requiredKey, importBets, importSessions]);

  const setField = (key: string, value: string) =>
    setMapping((prev) => {
      const next = { ...prev };
      if (value === '') delete next[key];
      else next[key] = Number(value);
      return next;
    });

  const doImport = async () => {
    if (!built || built.count === 0) return;
    setBusy(true);
    const count = await built.run();
    const skipped = built.skipped > 0 ? ` (${built.skipped} rows skipped)` : '';
    setBusy(false);
    setMessage(`Imported ${count} ${noun}${skipped}.`);
    reset();
  };

  const loaded = headers.length > 0;
  const dateMapped = mapping[requiredKey] !== undefined;
  // Warn if nothing determines the result of each row.
  const resultWarning =
    kind === 'bets'
      ? mapping.status === undefined && mapping.net === undefined
        ? 'No result/status or net-profit column mapped — every bet will import as pending (no profit). Map one of those.'
        : ''
      : mapping.cashOut === undefined && mapping.net === undefined
        ? 'No cash-out or net-profit column mapped — every session will import as a break-even/loss. Map one of those.'
        : '';

  return (
    <>
      <TopBar
        title={kind === 'bets' ? 'Import bets from another app' : 'Import from another app'}
        onBack={() => navigate(-1)}
      />
      <main className="page" style={{ paddingTop: 0 }}>
        {message && (
          <div className="card" role="status" style={{ borderLeft: '4px solid var(--gold-500)' }}>
            {message}
          </div>
        )}

        {!loaded && (
          <SectionCard title="Choose a CSV">
            <p className="muted" style={{ margin: 0 }}>
              Export your {noun} from the other app or sportsbook as a CSV, then load it here. It
              doesn't need to match BankrollEdge's format — you'll map the columns next. Only a
              date column is required.
            </p>
            <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
              Choose CSV file
              <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={onPickFile} />
            </label>
            <details>
              <summary className="muted small" style={{ cursor: 'pointer' }}>…or paste CSV text</summary>
              <textarea
                rows={5}
                placeholder={
                  kind === 'bets'
                    ? 'Date,Sport,Pick,Odds,Stake,Result&#10;2026-01-05,NFL,Chiefs -3.5,-110,100,Won'
                    : 'Date,Location,Buy In,Cash Out&#10;2026-01-05,Bellagio,300,540'
                }
                style={{ width: '100%', marginTop: 8 }}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline"
                style={{ marginTop: 8 }}
                disabled={raw.trim() === ''}
                onClick={() => load(raw, 'the pasted text')}
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
                Detected {headers.length} columns and {rows.length} rows. We've guessed the matches
                below — adjust any that are wrong. Anything left as “Not imported” is skipped.
              </p>

              <div className="row">
                <label className="field grow">
                  <span>Date format (ambiguous dates)</span>
                  <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                    <option value="AUTO">Auto-detect</option>
                    <option value="MDY">MM/DD/YYYY (US)</option>
                    <option value="DMY">DD/MM/YYYY</option>
                    <option value="YMD">YYYY/MM/DD</option>
                  </select>
                </label>
                {kind === 'bets' ? (
                  <label className="field grow">
                    <span>Odds format</span>
                    <select value={oddsFormat} onChange={(e) => setOddsFormat(e.target.value as OddsInputFormat)}>
                      <option value="AUTO">Auto-detect</option>
                      <option value="AMERICAN">American (+150 / -110)</option>
                      <option value="DECIMAL">Decimal (2.50)</option>
                    </select>
                  </label>
                ) : (
                  <label className="field grow">
                    <span>Default type (unmapped rows)</span>
                    <select value={defaultType} onChange={(e) => setDefaultType(e.target.value as SessionType)}>
                      {SESSION_TYPES.map((t) => (
                        <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {groups.map((group) => (
                <div key={group}>
                  <div className="overline" style={{ marginTop: 8 }}>{group}</div>
                  {fields.filter((f) => f.group === group).map((f) => (
                    <label className="field" key={f.key}>
                      <span>
                        {f.label}
                        {f.required && <span className="neg"> *</span>}
                        {f.hint && <span className="muted small"> — {f.hint}</span>}
                      </span>
                      <select value={mapping[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
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
                  Map the <strong>{kind === 'bets' ? 'Date placed' : 'Date / time'}</strong> column
                  to continue.
                </p>
              ) : built ? (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    <strong>{built.count}</strong> {noun} will be imported
                    {built.skipped > 0 && (
                      <> · <span className="neg">{built.skipped} skipped</span> (unreadable date)</>
                    )}
                    .
                  </p>
                  {resultWarning && (
                    <p className="neg small" role="alert" style={{ margin: 0 }}>{resultWarning}</p>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          {built.previewHeaders.map((h, i) => (
                            <th key={i} style={{ textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {built.previewRows.map((r, ri) => (
                          <tr key={ri}>
                            {r.cells.map((c, ci) => (
                              <td
                                key={ci}
                                className={`${c.align === 'right' ? 'money' : ''} ${c.className ?? ''}`}
                                style={{ textAlign: c.align ?? 'left' }}
                              >
                                {c.text}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {built.count > 6 && (
                    <p className="muted small" style={{ margin: 0 }}>…and {built.count - 6} more.</p>
                  )}
                </>
              ) : null}

              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-outline" onClick={reset}>
                  Choose a different file
                </button>
                <button
                  type="button"
                  className="btn grow"
                  disabled={busy || !built || built.count === 0}
                  onClick={doImport}
                >
                  {busy ? 'Importing…' : `Import ${built?.count ?? 0} ${noun}`}
                </button>
              </div>
            </SectionCard>
          </>
        )}
      </main>
    </>
  );
}
