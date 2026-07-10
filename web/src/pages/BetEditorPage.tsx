// Add/edit a sports bet. Odds can be entered in American or decimal format;
// parlays/teasers get a legs builder with an auto-combined price. A payout
// preview updates live, and the status chips double as the settle flow.
import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  SportsBet,
  Sport,
  BetType,
  BetStatus,
  LegResult,
  OddsFormat,
  SPORTS,
  SPORT_LABELS,
  BET_TYPES,
  BET_TYPE_LABELS,
  BET_STATUSES,
  BET_STATUS_LABELS,
  emptyBet,
} from '../models/types';
import {
  americanToDecimal,
  decimalToAmerican,
  effectiveOdds,
  betProfit,
  toWin,
  impliedProbability,
} from '../domain/bets';
import { money, signedMoney, percent } from '../domain/format';
import { ConfirmDialog, MoneyInput, TopBar, profitClass } from '../components/common';

interface LegForm {
  pick: string;
  odds: string; // in the current entry format
  result: LegResult;
}

interface FormState {
  sport: Sport;
  betType: BetType;
  event: string;
  pick: string;
  sportsbook: string;
  date: string; // placed, yyyy-MM-dd
  time: string; // placed, HH:mm
  odds: string; // in the current entry format
  stake: string;
  status: BetStatus;
  cashOutAmount: string;
  freeBet: boolean;
  closingOdds: string;
  eventDate: string;
  eventTime: string;
  legs: LegForm[];
  tagsText: string;
  notes: string;
  currency: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toTimeInput = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const f = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Decimal odds → the text shown in an entry field for the given format. */
function oddsToInput(decimal: number, format: OddsFormat): string {
  if (decimal <= 1) return '';
  if (format === 'DECIMAL') return String(Math.round(decimal * 10000) / 10000);
  const am = decimalToAmerican(decimal);
  return am > 0 ? `+${am}` : String(am);
}

/** Entry-field text → decimal odds for the given format (0 = unset/bad). */
function inputToOdds(text: string, format: OddsFormat): number {
  const n = Number.parseFloat(text.replace('+', ''));
  if (!Number.isFinite(n) || n === 0) return 0;
  return format === 'DECIMAL' ? (n > 1 ? n : 0) : americanToDecimal(n);
}

function fromBet(b: SportsBet, format: OddsFormat): FormState {
  return {
    sport: b.sport,
    betType: b.betType,
    event: b.event,
    pick: b.pick,
    sportsbook: b.sportsbook,
    date: toDateInput(b.placedAt),
    time: toTimeInput(b.placedAt),
    odds: oddsToInput(b.odds, format),
    stake: b.stake === 0 ? '' : String(b.stake),
    status: b.status,
    cashOutAmount: b.cashOutAmount === 0 ? '' : String(b.cashOutAmount),
    freeBet: b.freeBet,
    closingOdds: oddsToInput(b.closingOdds, format),
    eventDate: b.eventStart > 0 ? toDateInput(b.eventStart) : '',
    eventTime: b.eventStart > 0 ? toTimeInput(b.eventStart) : '',
    legs: b.legs.map((l) => ({ pick: l.pick, odds: oddsToInput(l.odds, format), result: l.result })),
    tagsText: b.tags.join(', '),
    notes: b.notes,
    currency: b.currency,
  };
}

function toBet(form: FormState, id: number, format: OddsFormat): SportsBet {
  const [y, mo, d] = form.date.split('-').map(Number);
  const [h, mi] = form.time.split(':').map(Number);
  let eventStart = 0;
  if (form.eventDate) {
    const [ey, emo, ed] = form.eventDate.split('-').map(Number);
    const [eh, emi] = (form.eventTime || '00:00').split(':').map(Number);
    eventStart = new Date(ey, (emo || 1) - 1, ed || 1, eh || 0, emi || 0).getTime();
  }
  const legs = form.legs
    .filter((l) => l.pick.trim() !== '' || l.odds.trim() !== '')
    .map((l) => ({ pick: l.pick.trim(), odds: inputToOdds(l.odds, format), result: l.result }));
  return {
    id,
    placedAt: new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).getTime(),
    eventStart,
    sport: form.sport,
    event: form.event.trim(),
    pick: form.pick.trim(),
    betType: form.betType,
    legs,
    odds: inputToOdds(form.odds, format),
    stake: f(form.stake),
    status: form.status,
    cashOutAmount: f(form.cashOutAmount),
    freeBet: form.freeBet,
    closingOdds: inputToOdds(form.closingOdds, format),
    sportsbook: form.sportsbook.trim(),
    tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
    notes: form.notes.trim(),
    currency: form.currency,
  };
}

export default function BetEditorPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const { id } = useParams();

  const betId = id ? Number(id) : 0;
  const existing = betId > 0 ? app.getBet(betId) : undefined;
  const isEditing = !!existing;

  const [format, setFormat] = useState<OddsFormat>(app.settings.oddsFormat);
  const [form, setForm] = useState<FormState>(() =>
    existing
      ? fromBet(existing, app.settings.oddsFormat)
      : fromBet({ ...emptyBet(Date.now()), currency: app.settings.currency }, app.settings.oddsFormat),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const hasLegs = form.betType === 'PARLAY' || form.betType === 'TEASER';
  const preview = useMemo(() => toBet(form, betId, format), [form, betId, format]);
  const odds = effectiveOdds(preview);
  const win = toWin(preview);
  const settledProfit = betProfit(preview);

  /** Re-express every odds field when the entry format flips. */
  const switchFormat = (next: OddsFormat) => {
    if (next === format) return;
    const convert = (text: string) => oddsToInput(inputToOdds(text, format), next);
    setFormat(next);
    set({
      odds: convert(form.odds),
      closingOdds: convert(form.closingOdds),
      legs: form.legs.map((l) => ({ ...l, odds: convert(l.odds) })),
    });
  };

  /** "Repeat last bet": copy sport/book/type/stake from the newest bet. */
  const repeatLast = () => {
    const last = app.bets[0];
    if (!last) return;
    set({
      sport: last.sport,
      betType: last.betType,
      sportsbook: last.sportsbook,
      stake: last.stake > 0 ? String(last.stake) : '',
      currency: last.currency,
    });
  };

  const setLeg = (i: number, patch: Partial<LegForm>) =>
    set({ legs: form.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await app.saveBet(toBet(form, betId, format));
    navigate('/bets');
  };

  const onDelete = async () => {
    setConfirmDelete(false);
    if (existing) await app.deleteBet(existing.id);
    navigate('/bets');
  };

  const oddsPlaceholder = format === 'AMERICAN' ? 'e.g. -110 or +150' : 'e.g. 1.91';

  return (
    <>
      <TopBar
        title={isEditing ? 'Edit bet' : 'New bet'}
        onBack={() => navigate(-1)}
        action={
          isEditing ? (
            <button
              type="button"
              className="back"
              aria-label="Delete bet"
              onClick={() => setConfirmDelete(true)}
            >
              🗑
            </button>
          ) : undefined
        }
      />
      <form className="page" style={{ paddingTop: 0 }} onSubmit={onSubmit}>
        {!isEditing && app.bets.length > 0 && (
          <button type="button" className="btn btn-outline" onClick={repeatLast}>
            ↺ Repeat last bet setup
          </button>
        )}

        <div className="row">
          <label className="field grow">
            <span>Sport</span>
            <select value={form.sport} onChange={(e) => set({ sport: e.target.value as Sport })}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>{SPORT_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span>Bet type</span>
            <select
              value={form.betType}
              onChange={(e) => set({ betType: e.target.value as BetType })}
            >
              {BET_TYPES.map((t) => (
                <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Event / matchup (e.g. "Chiefs @ Bills")</span>
          <input type="text" value={form.event} onChange={(e) => set({ event: e.target.value })} />
        </label>

        {!hasLegs && (
          <label className="field">
            <span>Pick (e.g. "Chiefs -3.5")</span>
            <input type="text" value={form.pick} onChange={(e) => set({ pick: e.target.value })} />
          </label>
        )}

        <label className="field">
          <span>Sportsbook</span>
          <input
            type="text"
            list="sportsbooks"
            value={form.sportsbook}
            onChange={(e) => set({ sportsbook: e.target.value })}
          />
          <datalist id="sportsbooks">
            {app.availableSportsbooks.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>

        <div className="row">
          <label className="field grow">
            <span>Date placed</span>
            <input type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className="field grow">
            <span>Time</span>
            <input type="time" required value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </label>
        </div>

        <div className="segmented" role="group" aria-label="Odds format">
          {(['AMERICAN', 'DECIMAL'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              aria-pressed={format === fmt}
              onClick={() => switchFormat(fmt)}
            >
              {fmt === 'AMERICAN' ? 'American' : 'Decimal'}
            </button>
          ))}
        </div>

        {hasLegs ? (
          <section className="card col">
            <h2>Legs</h2>
            {form.legs.map((leg, i) => (
              <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
                <label className="field grow">
                  <span>Pick {i + 1}</span>
                  <input
                    type="text"
                    value={leg.pick}
                    onChange={(e) => setLeg(i, { pick: e.target.value })}
                  />
                </label>
                <label className="field" style={{ width: 90 }}>
                  <span>Odds</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={format === 'AMERICAN' ? '-110' : '1.91'}
                    value={leg.odds}
                    onChange={(e) => setLeg(i, { odds: e.target.value })}
                  />
                </label>
                {form.status !== 'PENDING' && (
                  <label className="field" style={{ width: 92 }}>
                    <span>Result</span>
                    <select
                      value={leg.result}
                      onChange={(e) => setLeg(i, { result: e.target.value as LegResult })}
                    >
                      <option value="">—</option>
                      <option value="WON">Won</option>
                      <option value="LOST">Lost</option>
                      <option value="PUSH">Push</option>
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  aria-label={`Remove leg ${i + 1}`}
                  onClick={() => set({ legs: form.legs.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => set({ legs: [...form.legs, { pick: '', odds: '', result: '' }] })}
            >
              + Add leg
            </button>
            {odds > 1 && (
              <p className="muted small" style={{ margin: 0 }}>
                Combined odds: {oddsToInput(odds, format)} (pushed legs drop out)
              </p>
            )}
          </section>
        ) : (
          <label className="field">
            <span>Odds ({format === 'AMERICAN' ? 'American' : 'decimal'})</span>
            <input
              type="text"
              inputMode="text"
              placeholder={oddsPlaceholder}
              value={form.odds}
              onChange={(e) => set({ odds: e.target.value.replace(/[^0-9+\-.]/g, '') })}
            />
          </label>
        )}

        <div className="row">
          <label className="field grow">
            <span>Stake</span>
            <MoneyInput
              currency={form.currency}
              value={form.stake}
              onChange={(v) => set({ stake: v })}
            />
          </label>
          <label className="field grow" style={{ justifyContent: 'flex-end' }}>
            <span>Free / bonus bet</span>
            <div className="chips">
              <button
                type="button"
                className="chip"
                aria-pressed={form.freeBet}
                onClick={() => set({ freeBet: !form.freeBet })}
              >
                {form.freeBet ? 'Yes — no stake at risk' : 'No'}
              </button>
            </div>
          </label>
        </div>

        <div className="field">
          <span>Status</span>
          <div className="chips" role="group" aria-label="Bet status">
            {BET_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={form.status === s}
                onClick={() => set({ status: s })}
              >
                {BET_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {form.status === 'CASHED_OUT' && (
          <label className="field">
            <span>Cash-out amount returned</span>
            <MoneyInput
              currency={form.currency}
              value={form.cashOutAmount}
              onChange={(v) => set({ cashOutAmount: v })}
            />
          </label>
        )}

        <details className="card">
          <summary>More details (event time, closing line, tags)</summary>
          <div className="col" style={{ marginTop: 10 }}>
            <div className="row">
              <label className="field grow">
                <span>Event date</span>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => set({ eventDate: e.target.value })}
                />
              </label>
              <label className="field grow">
                <span>Event time</span>
                <input
                  type="time"
                  value={form.eventTime}
                  onChange={(e) => set({ eventTime: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>Closing odds ({format === 'AMERICAN' ? 'American' : 'decimal'}) — for CLV</span>
              <input
                type="text"
                placeholder={oddsPlaceholder}
                value={form.closingOdds}
                onChange={(e) => set({ closingOdds: e.target.value.replace(/[^0-9+\-.]/g, '') })}
              />
            </label>
            <label className="field">
              <span>Tags (comma-separated, e.g. "primetime, fade-public")</span>
              <input
                type="text"
                value={form.tagsText}
                onChange={(e) => set({ tagsText: e.target.value })}
              />
            </label>
          </div>
        </details>

        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>

        <div className="card col" style={{ gap: 4 }}>
          <div className="row-between">
            <h2>{form.status === 'PENDING' ? 'To win' : 'Net result'}</h2>
            <span
              className={`money ${profitClass(form.status === 'PENDING' ? win : settledProfit)}`}
              style={{ fontSize: '1.5rem', fontWeight: 700 }}
            >
              {form.status === 'PENDING'
                ? signedMoney(win, form.currency)
                : signedMoney(settledProfit, form.currency)}
            </span>
          </div>
          {odds > 1 && (
            <div className="muted small">
              {oddsToInput(odds, format)} • implied {percent(impliedProbability(odds))} • returns{' '}
              {money(preview.freeBet ? win : f(form.stake) + win, form.currency)} on a win
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-block">
          {isEditing ? 'Save changes' : 'Add bet'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this bet?"
        message="This removes the bet and its result from your bankroll. This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
