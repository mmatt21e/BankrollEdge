// Add/edit a session with a live net-result preview. Quick logging stays
// fast: the essentials are up top, and money details / quality tracking live
// in collapsible sections. Numeric fields are held as raw strings and parsed
// on save so partial input never crashes.
import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAppState, useStoreList } from '../hooks/useAppState';
import {
  Session,
  SessionType,
  GameType,
  TableGameType,
  VenueType,
  Venue,
  SleepQuality,
  AlcoholLevel,
  GameQuality,
  YesNo,
  StakePreset,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  emptySession,
  isTournamentStyle,
  profit,
  gameTypeLabel,
  tableGameLabel,
  stakePresetLabel,
  pokerGameOptions,
  tableGameOptions,
} from '../models/types';
import { money, signedMoney, signedUnits, toDateInput, toTimeInput } from '../domain/format';
import { stakeStore, venueStore } from '../storage/db';
import { ConfirmDialog, MoneyInput, TopBar, profitClass, useBack } from '../components/common';
import { StakesPicker, VenuePicker } from '../components/pickers';

interface FormState {
  sessionType: SessionType;
  gameType: GameType;
  venueType: VenueType;
  location: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  hours: string;
  minutes: string;
  smallBlind: string;
  bigBlind: string;
  buyIn: string;
  rebuysAddons: string;
  addOns: string;
  cashOut: string;
  tips: string;
  rake: string;
  expenses: string;
  position: string;
  fieldSize: string;
  bountyPerBounty: string;
  bountyCount: string;
  reentries: string;
  tableGame: TableGameType;
  tableMinBet: string;
  tableMaxBet: string;
  // Preserved on round-trip so legacy data isn't lost; no longer edited in the
  // UI — unit display is now a global setting under Table games.
  unitValue: string;
  unitsMin: string;
  unitsMax: string;
  handsPlayed: string;
  tableSize: string;
  tagsText: string; // comma-separated
  currency: string;
  notes: string;
  focus: number;
  tilt: number;
  discipline: number;
  sleep: SleepQuality;
  alcohol: AlcoholLevel;
  gameQuality: GameQuality;
  leftAtStopLoss: YesNo;
  stopLoss: string;
  stopWin: string;
}

const numStr = (v: number) => (v === 0 ? '' : String(v));

function fromSession(s: Session): FormState {
  return {
    sessionType: s.sessionType,
    gameType: s.gameType,
    venueType: s.venueType,
    location: s.location,
    date: toDateInput(s.startTime),
    time: toTimeInput(s.startTime),
    hours: s.durationMinutes > 0 ? String(Math.floor(s.durationMinutes / 60)) : '',
    minutes: s.durationMinutes > 0 ? String(s.durationMinutes % 60) : '',
    smallBlind: numStr(s.smallBlind),
    bigBlind: numStr(s.bigBlind),
    buyIn: numStr(s.buyIn),
    rebuysAddons: numStr(s.rebuysAddons),
    addOns: numStr(s.addOns),
    cashOut: numStr(s.cashOut),
    tips: numStr(s.tips),
    rake: numStr(s.rake),
    expenses: numStr(s.expenses),
    position: s.position > 0 ? String(s.position) : '',
    fieldSize: s.fieldSize > 0 ? String(s.fieldSize) : '',
    bountyPerBounty: numStr(s.bountyPerBounty),
    bountyCount: s.bountyCount > 0 ? String(s.bountyCount) : '',
    reentries: s.reentries > 0 ? String(s.reentries) : '',
    tableGame: s.tableGame,
    tableMinBet: numStr(s.tableMinBet),
    tableMaxBet: numStr(s.tableMaxBet),
    unitValue: numStr(s.unitValue),
    unitsMin: numStr(s.unitsMin),
    unitsMax: numStr(s.unitsMax),
    handsPlayed: s.handsPlayed > 0 ? String(s.handsPlayed) : '',
    tableSize: s.tableSize > 0 ? String(s.tableSize) : '',
    tagsText: s.tags.join(', '),
    currency: s.currency,
    notes: s.notes,
    focus: s.focus,
    tilt: s.tilt,
    discipline: s.discipline,
    sleep: s.sleep,
    alcohol: s.alcohol,
    gameQuality: s.gameQuality,
    leftAtStopLoss: s.leftAtStopLoss,
    stopLoss: numStr(s.stopLoss),
    stopWin: numStr(s.stopWin),
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
  const isTable = form.sessionType === 'TABLE';
  return {
    id,
    sessionType: form.sessionType,
    gameType: isTable ? 'OTHER' : form.gameType,
    venueType: form.venueType,
    location: form.location.trim(),
    startTime: new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).getTime(),
    durationMinutes: i(form.hours) * 60 + i(form.minutes),
    smallBlind: isTable ? 0 : f(form.smallBlind),
    bigBlind: isTable ? 0 : f(form.bigBlind),
    buyIn: f(form.buyIn),
    rebuysAddons: f(form.rebuysAddons),
    addOns: f(form.addOns),
    cashOut: f(form.cashOut),
    tips: f(form.tips),
    rake: f(form.rake),
    expenses: f(form.expenses),
    position: i(form.position),
    fieldSize: i(form.fieldSize),
    bountyPerBounty: f(form.bountyPerBounty),
    bountyCount: i(form.bountyCount),
    reentries: i(form.reentries),
    tableGame: form.tableGame,
    tableMinBet: f(form.tableMinBet),
    tableMaxBet: f(form.tableMaxBet),
    unitValue: f(form.unitValue),
    unitsMin: f(form.unitsMin),
    unitsMax: f(form.unitsMax),
    handsPlayed: i(form.handsPlayed),
    tableSize: i(form.tableSize),
    tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
    currency: form.currency,
    notes: form.notes.trim(),
    focus: form.focus,
    tilt: form.tilt,
    discipline: form.discipline,
    sleep: form.sleep,
    alcohol: form.alcohol,
    gameQuality: form.gameQuality,
    leftAtStopLoss: form.leftAtStopLoss,
    stopLoss: f(form.stopLoss),
    stopWin: f(form.stopWin),
  };
}

export default function EditorPage() {
  const app = useAppState();
  const { id } = useParams();
  const [params] = useSearchParams();

  const sessionId = id ? Number(id) : 0;
  const existing = sessionId > 0 ? app.getSession(sessionId) : undefined;
  const isEditing = !!existing;

  const venueList = useStoreList(venueStore);
  const stakeList = useStoreList(stakeStore);
  // Presets offered in the picker = saved presets PLUS any stakes seen in the
  // data (recorded or imported), deduped by label — the same treatment venues
  // and games get, so imported stakes are pickable everywhere.
  const mergePresets = (saved: StakePreset[], recorded: StakePreset[]) => {
    const seen = new Set(saved.map(stakePresetLabel));
    return [...saved, ...recorded.filter((p) => !seen.has(stakePresetLabel(p)))];
  };
  const pokerPresets = mergePresets(
    stakeList.items.filter((s) => s.kind === 'POKER'),
    app.recordedStakes.filter((s) => s.kind === 'POKER'),
  ).sort((a, b) => a.smallBlind - b.smallBlind || a.bigBlind - b.bigBlind);
  const tablePresets = mergePresets(
    stakeList.items.filter((s) => s.kind === 'TABLE'),
    app.recordedStakes.filter((s) => s.kind === 'TABLE'),
  ).sort((a, b) => a.minBet - b.minBet || a.maxBet - b.maxBet);

  // A live session that's being logged carries its captured setup (game,
  // venue, stakes, buy-in) in the active-session draft — prefill from it.
  const liveParam = params.get('live');
  // ?live=<startedAt> hands a specific running session's draft to the editor
  // ('1' is the legacy single-session form — take the oldest one).
  const draft = liveParam
    ? liveParam === '1'
      ? app.activeSessions[0] ?? null
      : app.activeSessions.find((a) => String(a.startedAt) === liveParam) ?? null
    : null;
  const [form, setForm] = useState<FormState>(() => {
    if (existing) return fromSession(existing);
    if (draft) {
      const duration = Number(params.get('duration')) || 0;
      return fromSession({
        ...emptySession(draft.startedAt),
        durationMinutes: duration,
        sessionType: draft.sessionType,
        gameType: draft.gameType,
        tableGame: draft.tableGame,
        venueType: draft.venueType,
        location: draft.location,
        smallBlind: draft.smallBlind,
        bigBlind: draft.bigBlind,
        buyIn: draft.buyIn,
        rebuysAddons: draft.rebuys,
        bountyPerBounty: draft.bountyPerBounty,
        bountyCount: draft.bountyCount,
        currency: draft.currency,
      });
    }
    const start = Number(params.get('start')) || Date.now();
    const duration = Number(params.get('duration')) || 0;
    // The Sessions/Tables tabs pass ?type= so their + opens the right discipline.
    const typeParam = params.get('type');
    const forcedType = SESSION_TYPES.includes(typeParam as SessionType)
      ? (typeParam as SessionType)
      : null;
    return fromSession({
      ...emptySession(start),
      durationMinutes: duration,
      currency: app.settings.currency,
      sessionType:
        forcedType ??
        (app.settings.defaultSessionType !== 'ALL'
          ? app.settings.defaultSessionType
          : app.settings.showPoker
            ? 'CASH'
            : 'TABLE'),
    });
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Guards against double-taps on Save — each submit of a new session would
  // otherwise insert a duplicate record.
  const [saving, setSaving] = useState(false);
  // Back protection: leaving with unsaved edits asks first.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const initialForm = useRef(JSON.stringify(form));
  const goBack = useBack(form.sessionType === 'TABLE' ? '/tables' : '/sessions');
  const onBack = () => {
    if (JSON.stringify(form) !== initialForm.current) setConfirmLeave(true);
    else goBack();
  };

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const isTournament = isTournamentStyle({ sessionType: form.sessionType } as Session);
  const isTable = form.sessionType === 'TABLE';
  const preview = useMemo(() => profit(toSession(form, sessionId)), [form, sessionId]);
  // Table results display in units when the global setting is on and a unit
  // value is configured (Settings → Table games).
  const showUnits = isTable && app.settings.showTableUnits && app.settings.tableUnitValue > 0;

  /** "Repeat last session setup": copy game/venue/stakes from the newest session. */
  const repeatLast = () => {
    const last = app.sessions[0];
    if (!last) return;
    set({
      sessionType: last.sessionType,
      gameType: last.gameType,
      venueType: last.venueType,
      location: last.location,
      smallBlind: numStr(last.smallBlind),
      bigBlind: numStr(last.bigBlind),
      buyIn: numStr(last.buyIn),
      tableSize: last.tableSize > 0 ? String(last.tableSize) : '',
      tagsText: last.tags.join(', '),
      currency: last.currency,
      tableGame: last.tableGame,
      tableMinBet: numStr(last.tableMinBet),
      tableMaxBet: numStr(last.tableMaxBet),
      unitValue: numStr(last.unitValue),
      unitsMin: numStr(last.unitsMin),
      unitsMax: numStr(last.unitsMax),
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await app.saveSession(toSession(form, sessionId));
      // The live session is now logged — retire its draft so the timer resets.
      if (draft) app.clearSession(draft.startedAt);
      goBack();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setConfirmDelete(false);
    if (existing) await app.deleteSession(existing.id);
    goBack();
  };

  // The venue dropdown offers saved venues PLUS every location seen in the
  // data (recorded or imported), so imported venues are pickable everywhere.
  const savedVenueNames = new Set(venueList.items.map((v) => v.name.toLowerCase()));
  const mergedVenues: Venue[] = [
    ...venueList.items,
    ...app.availableLocations
      .filter((loc) => !savedVenueNames.has(loc.toLowerCase()))
      .map((name) => ({ id: 0, name })),
  ];

  // Money fields show the session currency's symbol; plain decimal fields
  // (unit counts) don't.
  const moneyField = (label: string, key: keyof FormState) => (
    <label className="field grow" key={key}>
      <span>{label}</span>
      <MoneyInput
        currency={form.currency}
        value={form[key] as string}
        onChange={(v) => set({ [key]: v } as Partial<FormState>)}
      />
    </label>
  );
  // Amounts are always entered in dollars; unit display is a read-only setting.
  const amountField = moneyField;

  const pokerGames = pokerGameOptions(app.settings, app.recordedPokerGames);
  const pokerGamesAll = pokerGames.some((o) => o.value === form.gameType)
    ? pokerGames
    : [...pokerGames, { value: form.gameType, label: gameTypeLabel(form.gameType) }];
  const tableGames = tableGameOptions(app.settings, app.recordedTableGames);
  const tableGamesAll = tableGames.some((o) => o.value === form.tableGame)
    ? tableGames
    : [...tableGames, { value: form.tableGame, label: tableGameLabel(form.tableGame) }];
  const intField = (label: string, key: keyof FormState) => (
    <label className="field grow" key={key}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={form[key] as string}
        onChange={(e) => set({ [key]: e.target.value.replace(/\D/g, '') } as Partial<FormState>)}
      />
    </label>
  );
  const ratingRow = (label: string, key: 'focus' | 'tilt' | 'discipline') => (
    <div className="field">
      <span>{label}</span>
      <div className="chips" role="group" aria-label={label}>
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={form[key] === v}
            onClick={() => set({ [key]: v } as Partial<FormState>)}
          >
            {v === 0 ? '—' : v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <TopBar
        title={isEditing ? 'Edit session' : 'New session'}
        onBack={onBack}
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
        {!isEditing && app.sessions.length > 0 && (
          <button type="button" className="btn btn-outline" onClick={repeatLast}>
            ↺ Repeat last session setup
          </button>
        )}

        <label className="field">
          <span>Session type</span>
          <select
            value={form.sessionType}
            onChange={(e) => set({ sessionType: e.target.value as SessionType })}
          >
            {SESSION_TYPES.filter(
              (t) =>
                t === form.sessionType ||
                (t === 'TABLE' ? app.settings.showTableGames : app.settings.showPoker),
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
              {tableGamesAll.map((g) => (
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
              {pokerGamesAll.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Venue / location</span>
          <VenuePicker
            value={form.location}
            venues={mergedVenues}
            onSelect={(name) => set({ location: name })}
            onCreate={async (name) => {
              await venueList.save({ id: 0, name });
            }}
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

        {!isTournament && !isTable && (
          <>
            <label className="field">
              <span>Stakes (blinds)</span>
              <StakesPicker
                kind="POKER"
                a={f(form.smallBlind)}
                b={f(form.bigBlind)}
                presets={pokerPresets}
                onSelect={(a, b) => set({ smallBlind: numStr(a), bigBlind: numStr(b) })}
                onCreate={async (a, b) => {
                  await stakeList.save({ id: 0, kind: 'POKER', smallBlind: a, bigBlind: b, minBet: 0, maxBet: 0 });
                }}
              />
            </label>
            <div className="row">
              {moneyField('Small blind', 'smallBlind')}
              {moneyField('Big blind', 'bigBlind')}
            </div>
          </>
        )}

        {isTable && (
          <>
            <label className="field">
              <span>Table stakes (min / max bet)</span>
              <StakesPicker
                kind="TABLE"
                a={f(form.tableMinBet)}
                b={f(form.tableMaxBet)}
                presets={tablePresets}
                onSelect={(a, b) => set({ tableMinBet: numStr(a), tableMaxBet: numStr(b) })}
                onCreate={async (a, b) => {
                  await stakeList.save({ id: 0, kind: 'TABLE', smallBlind: 0, bigBlind: 0, minBet: a, maxBet: b });
                }}
              />
            </label>
            <div className="row">
              {moneyField('Table min bet', 'tableMinBet')}
              {moneyField('Table max bet', 'tableMaxBet')}
            </div>
          </>
        )}

        {amountField(isTournament ? 'Buy-in (entry + fee)' : 'Buy-in (total)', 'buyIn')}
        {amountField(isTournament ? 'Rebuys / re-entries' : 'Additional buy-ins', 'rebuysAddons')}
        {isTournament && moneyField('Add-ons', 'addOns')}
        {amountField(isTournament ? 'Prize won' : 'Cash out', 'cashOut')}

        {isTournament && (
          <>
            <div className="row">
              {intField('Finish position', 'position')}
              {intField('Field size', 'fieldSize')}
            </div>
            {intField('Re-entries (extra bullets fired)', 'reentries')}
            <div className="row">
              {moneyField('Bounty per knockout', 'bountyPerBounty')}
              {intField('Bounties collected', 'bountyCount')}
            </div>
            {f(form.bountyPerBounty) > 0 && i(form.bountyCount) > 0 && (
              <p className="muted small" style={{ margin: 0 }}>
                Bounty winnings: {money(f(form.bountyPerBounty) * i(form.bountyCount), form.currency)}
              </p>
            )}
          </>
        )}

        <details className="card">
          <summary>Money details (tips, rake, expenses)</summary>
          <div className="col" style={{ marginTop: 10 }}>
            {moneyField('Dealer tips', 'tips')}
            {moneyField('Rake paid (informational — not deducted)', 'rake')}
            {moneyField('Travel / food / other expenses (deducted)', 'expenses')}
          </div>
        </details>

        <details className="card">
          <summary>More details (tags, hands, table size)</summary>
          <div className="col" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Tags (comma-separated, e.g. "deepstack, friday")</span>
              <input type="text" value={form.tagsText} onChange={(e) => set({ tagsText: e.target.value })} />
            </label>
            <div className="row">
              {intField('Hands played', 'handsPlayed')}
              {intField('Table size', 'tableSize')}
            </div>
          </div>
        </details>

        <details className="card">
          <summary>Session quality (optional)</summary>
          <div className="col" style={{ marginTop: 10 }}>
            {ratingRow('Focus (1–5)', 'focus')}
            {ratingRow('Tilt (1–5)', 'tilt')}
            {ratingRow('Discipline (1–5)', 'discipline')}
            <div className="row">
              <label className="field grow">
                <span>Sleep</span>
                <select value={form.sleep} onChange={(e) => set({ sleep: e.target.value as SleepQuality })}>
                  <option value="">—</option>
                  <option value="POOR">Poor</option>
                  <option value="OK">OK</option>
                  <option value="GOOD">Good</option>
                </select>
              </label>
              <label className="field grow">
                <span>Alcohol</span>
                <select value={form.alcohol} onChange={(e) => set({ alcohol: e.target.value as AlcoholLevel })}>
                  <option value="">—</option>
                  <option value="NONE">None</option>
                  <option value="LIGHT">Light</option>
                  <option value="HEAVY">Heavy</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Game quality</span>
              <select
                value={form.gameQuality}
                onChange={(e) => set({ gameQuality: e.target.value as GameQuality })}
              >
                <option value="">—</option>
                <option value="BAD">Bad</option>
                <option value="AVERAGE">Average</option>
                <option value="GOOD">Good</option>
                <option value="GREAT">Great</option>
              </select>
            </label>
            <div className="row">
              {moneyField('Stop-loss', 'stopLoss')}
              {moneyField('Stop-win', 'stopWin')}
            </div>
            <label className="field">
              <span>Left at planned stop-loss?</span>
              <select
                value={form.leftAtStopLoss}
                onChange={(e) => set({ leftAtStopLoss: e.target.value as YesNo })}
              >
                <option value="">—</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
              </select>
            </label>
          </div>
        </details>

        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>

        {isEditing && !isTable && (
          <Link to={`/tools/hands?session=${sessionId}`} className="muted">
            ✎ Add a hand note for this session →
          </Link>
        )}

        <div className="card row-between">
          <h2>Net result</h2>
          <span className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
            <span className={`money ${profitClass(preview)}`} style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {signedMoney(preview, form.currency)}
            </span>
            {showUnits && (
              <span className="muted small">
                {signedUnits(preview / app.settings.tableUnitValue)} units
              </span>
            )}
          </span>
        </div>

        <button type="submit" className="btn btn-block" disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add session'}
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
      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="What you've typed on this screen hasn't been saved."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirmLeave(false);
          goBack();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </>
  );
}
