// Add-able pick-lists for the session editor: choose a saved venue or stakes
// preset from a dropdown, or pick "➕ Add new…" to create one inline (which
// saves it to the managed list and selects it). The session itself still
// stores plain values — these only drive the pick-list.
import { useState } from 'react';
import { StakePreset, Venue, stakePresetLabel } from '../models/types';

const ADD = '__add__';

/** Venue dropdown backed by the saved-venue list. `value` is the raw location
 *  string stored on the session, so a venue that isn't saved (e.g. from an old
 *  session) still shows as the current selection. */
export function VenuePicker({
  value,
  venues,
  onSelect,
  onCreate,
}: {
  value: string;
  venues: Venue[];
  onSelect: (name: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  if (adding) {
    const cancel = () => {
      setAdding(false);
      setName('');
    };
    const save = async () => {
      const trimmed = name.trim();
      if (!trimmed) return cancel();
      if (!venues.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) {
        await onCreate(trimmed);
      }
      onSelect(trimmed);
      cancel();
    };
    return (
      <div className="row">
        <input
          className="grow"
          type="text"
          autoFocus
          placeholder="New venue name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), save())}
        />
        <button type="button" className="btn" onClick={save}>
          Save
        </button>
        <button type="button" className="btn btn-outline" onClick={cancel}>
          Cancel
        </button>
      </div>
    );
  }

  const names = venues.map((v) => v.name).sort((a, b) => a.localeCompare(b));
  const orphan = value && !names.includes(value) ? value : '';
  return (
    <select
      value={value}
      onChange={(e) => (e.target.value === ADD ? setAdding(true) : onSelect(e.target.value))}
    >
      <option value={ADD}>➕ Add new venue…</option>
      <option value="">— none —</option>
      {orphan && <option value={orphan}>{orphan}</option>}
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

/** Stakes dropdown backed by the saved-preset list. `a`/`b` are the current raw
 *  numbers (small/big blind, or table min/max); selecting a preset fills them. */
export function StakesPicker({
  kind,
  a,
  b,
  presets,
  onSelect,
  onCreate,
}: {
  kind: StakePreset['kind'];
  a: number;
  b: number;
  presets: StakePreset[];
  onSelect: (a: number, b: number) => void;
  onCreate: (a: number, b: number) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [aText, setAText] = useState('');
  const [bText, setBText] = useState('');

  const toPreset = (min: number, max: number): StakePreset =>
    kind === 'POKER'
      ? { id: 0, kind, smallBlind: min, bigBlind: max, minBet: 0, maxBet: 0 }
      : { id: 0, kind, smallBlind: 0, bigBlind: 0, minBet: min, maxBet: max };

  if (adding) {
    const cancel = () => {
      setAdding(false);
      setAText('');
      setBText('');
    };
    const save = async () => {
      const na = Number.parseFloat(aText) || 0;
      const nb = Number.parseFloat(bText) || 0;
      if (na <= 0 && nb <= 0) return cancel();
      const label = stakePresetLabel(toPreset(na, nb));
      if (!presets.some((p) => stakePresetLabel(p) === label)) await onCreate(na, nb);
      onSelect(na, nb);
      cancel();
    };
    const numInput = (
      label: string,
      text: string,
      setText: (v: string) => void,
      auto = false,
    ) => (
      <label className="field grow">
        <span>{label}</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus={auto}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
        />
      </label>
    );
    return (
      <div className="col" style={{ gap: 8 }}>
        <div className="row">
          {kind === 'POKER'
            ? numInput('Small blind', aText, setAText, true)
            : numInput('Min bet', aText, setAText, true)}
          {kind === 'POKER'
            ? numInput('Big blind', bText, setBText)
            : numInput('Max bet', bText, setBText)}
        </div>
        <div className="row">
          <button type="button" className="btn grow" onClick={save}>
            Save preset
          </button>
          <button type="button" className="btn btn-outline" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const currentLabel = a > 0 || b > 0 ? stakePresetLabel(toPreset(a, b)) : '';
  const match = presets.find((p) => stakePresetLabel(p) === currentLabel);
  const value = match ? String(match.id) : currentLabel ? 'current' : '';
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === ADD) setAdding(true);
        else if (v === '') onSelect(0, 0);
        else if (v !== 'current') {
          const p = presets.find((x) => String(x.id) === v);
          if (p) onSelect(kind === 'POKER' ? p.smallBlind : p.minBet, kind === 'POKER' ? p.bigBlind : p.maxBet);
        }
      }}
    >
      <option value={ADD}>➕ Add new stakes…</option>
      <option value="">— none —</option>
      {!match && currentLabel && <option value="current">{currentLabel} (current)</option>}
      {presets.map((p) => (
        <option key={p.id} value={String(p.id)}>
          {stakePresetLabel(p)}
        </option>
      ))}
    </select>
  );
}
