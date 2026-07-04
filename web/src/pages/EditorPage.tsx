// Port of Android EditorScreen: add/edit a session with a live net-result
// preview. Numeric fields are held as raw strings and parsed on save, so
// partial input never crashes (same approach as the Android EditorViewModel).
import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  Session,
  SessionType,
  GameType,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  emptySession,
  profit,
} from '../models/types';
import { signedMoney } from '../domain/format';
import { ConfirmDialog, TopBar, profitClass } from '../components/common';

interface FormState {
  sessionType: SessionType;
  gameType: GameType;
  location: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  hours: string;
  minutes: string;
  smallBlind: string;
  bigBlind: string;
  buyIn: string;
  rebuysAddons: string;
  cashOut: string;
  tips: string;
  position: string;
  fieldSize: string;
  currency: string;
  notes: string;
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
const numStr = (v: number) => (v === 0 ? '' : String(v));

function fromSession(s: Session): FormState {
  return {
    sessionType: s.sessionType,
    gameType: s.gameType,
    location: s.location,
    date: toDateInput(s.startTime),
    time: toTimeInput(s.startTime),
    hours: s.durationMinutes > 0 ? String(Math.floor(s.durationMinutes / 60)) : '',
    minutes: s.durationMinutes > 0 ? String(s.durationMinutes % 60) : '',
    smallBlind: numStr(s.smallBlind),
    bigBlind: numStr(s.bigBlind),
    buyIn: numStr(s.buyIn),
    rebuysAddons: numStr(s.rebuysAddons),
    cashOut: numStr(s.cashOut),
    tips: numStr(s.tips),
    position: s.position > 0 ? String(s.position) : '',
    fieldSize: s.fieldSize > 0 ? String(s.fieldSize) : '',
    currency: s.currency,
    notes: s.notes,
  };
}

const f = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const i = (v: string) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

function toSession(form: FormState, id: number): Session {
  const [y, mo, d] = form.date.split('-').map(Number);
  const [h, mi] = form.time.split(':').map(Number);
  return {
    id,
    sessionType: form.sessionType,
    gameType: form.gameType,
    location: form.location.trim(),
    startTime: new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).getTime(),
    durationMinutes: i(form.hours) * 60 + i(form.minutes),
    smallBlind: f(form.smallBlind),
    bigBlind: f(form.bigBlind),
    buyIn: f(form.buyIn),
    rebuysAddons: f(form.rebuysAddons),
    cashOut: f(form.cashOut),
    tips: f(form.tips),
    position: i(form.position),
    fieldSize: i(form.fieldSize),
    currency: form.currency,
    notes: form.notes.trim(),
  };
}

export default function EditorPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();

  const sessionId = id ? Number(id) : 0;
  const existing = sessionId > 0 ? app.getSession(sessionId) : undefined;
  const isEditing = !!existing;

  const [form, setForm] = useState<FormState>(() => {
    if (existing) return fromSession(existing);
    // Timer prefill via ?start=&duration=; otherwise defaults from settings.
    const start = Number(params.get('start')) || Date.now();
    const duration = Number(params.get('duration')) || 0;
    const base = fromSession({
      ...emptySession(start),
      durationMinutes: duration,
      currency: app.settings.currency,
      sessionType:
        app.settings.defaultSessionType === 'TOURNAMENT' ? 'TOURNAMENT' : 'CASH',
    });
    return base;
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const isTournament = form.sessionType === 'TOURNAMENT';
  const preview = useMemo(() => profit(toSession(form, sessionId)), [form, sessionId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await app.saveSession(toSession(form, sessionId));
    navigate(-1);
  };

  const onDelete = async () => {
    setConfirmDelete(false);
    if (existing) await app.deleteSession(existing.id);
    navigate(-1);
  };

  const moneyField = (label: string, key: keyof FormState) => (
    <label className="field grow">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={form[key] as string}
        onChange={(e) => set({ [key]: e.target.value.replace(/[^0-9.]/g, '') } as Partial<FormState>)}
      />
    </label>
  );
  const intField = (label: string, key: keyof FormState) => (
    <label className="field grow">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={form[key] as string}
        onChange={(e) => set({ [key]: e.target.value.replace(/\D/g, '') } as Partial<FormState>)}
      />
    </label>
  );

  return (
    <>
      <TopBar
        title={isEditing ? 'Edit session' : 'New session'}
        onBack={() => navigate(-1)}
        action={
          isEditing ? (
            <button
              type="button"
              className="back"
              aria-label="Delete session"
              onClick={() => setConfirmDelete(true)}
            >
              🗑
            </button>
          ) : undefined
        }
      />
      <form className="page" style={{ paddingTop: 0 }} onSubmit={onSubmit}>
        <div className="segmented" role="group" aria-label="Session type">
          {SESSION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={form.sessionType === t}
              onClick={() => set({ sessionType: t })}
            >
              {SESSION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Game</span>
          <select
            value={form.gameType}
            onChange={(e) => set({ gameType: e.target.value as GameType })}
          >
            {GAME_TYPES.map((g) => (
              <option key={g} value={g}>{GAME_TYPE_LABELS[g]}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Venue / location</span>
          <input
            type="text"
            value={form.location}
            onChange={(e) => set({ location: e.target.value })}
          />
        </label>

        <div className="row">
          <label className="field grow">
            <span>Date</span>
            <input type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className="field grow">
            <span>Start time</span>
            <input type="time" required value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </label>
        </div>

        <div className="row">
          {intField('Hours', 'hours')}
          {intField('Minutes', 'minutes')}
        </div>

        {!isTournament && (
          <div className="row">
            {moneyField('Small blind', 'smallBlind')}
            {moneyField('Big blind', 'bigBlind')}
          </div>
        )}

        {moneyField(isTournament ? 'Buy-in (entry + fee)' : 'Buy-in (total)', 'buyIn')}
        {moneyField(isTournament ? 'Rebuys / add-ons / re-entries' : 'Additional buy-ins', 'rebuysAddons')}
        {moneyField(isTournament ? 'Prize won' : 'Cash out', 'cashOut')}
        {moneyField('Dealer tips', 'tips')}

        {isTournament && (
          <div className="row">
            {intField('Finish position', 'position')}
            {intField('Field size', 'fieldSize')}
          </div>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>

        <div className="card row-between">
          <h2>Net result</h2>
          <span className={`money ${profitClass(preview)}`} style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {signedMoney(preview, form.currency)}
          </span>
        </div>

        <button type="submit" className="btn btn-block">
          {isEditing ? 'Save changes' : 'Add session'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this session?"
        message="This removes the session and its result from your bankroll. This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
