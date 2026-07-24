// M-ratio: how many orbits your tournament stack survives at the current
// level (Harrington zones), plus the effective M short-handed adjustment.
import { useState } from 'react';
import { TopBar, useBack } from '../components/common';

const ZONES: { min: number; name: string; advice: string; cls: string }[] = [
  { min: 20, name: 'Green zone', advice: 'Full freedom — every play is available.', cls: 'pos' },
  { min: 10, name: 'Yellow zone', advice: 'Tighten up; speculative hands lose value.', cls: '' },
  { min: 6, name: 'Orange zone', advice: 'First-in aggression; no calling raises.', cls: '' },
  { min: 1, name: 'Red zone', advice: 'Push or fold — find a hand to shove.', cls: 'neg' },
  { min: 0, name: 'Dead zone', advice: 'Any two cards; you need chips now.', cls: 'neg' },
];

export default function MRatioPage() {
  const back = useBack('/tools');
  const [stack, setStack] = useState('');
  const [sb, setSb] = useState('');
  const [bb, setBb] = useState('');
  const [ante, setAnte] = useState('');
  const [playersText, setPlayersText] = useState('9');

  const numField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <label className="field grow">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
    </label>
  );

  const n = (v: string) => Number.parseInt(v, 10) || 0;
  const players = Math.min(10, Math.max(2, n(playersText) || 9));
  const orbitCost = n(sb) + n(bb) + n(ante) * players;
  const m = orbitCost > 0 ? n(stack) / orbitCost : 0;
  const effectiveM = m * (players / 10);
  const zone = ZONES.find((z) => m >= z.min) ?? ZONES[ZONES.length - 1];

  return (
    <>
      <TopBar title="M-ratio" onBack={back} />
      <main className="page page--with-topbar">
        <p className="muted" style={{ margin: 0 }}>
          M = your stack divided by one orbit's cost (small blind + big blind + antes). It says
          how long you can wait before blinding out.
        </p>
        <div className="row">{numField('Your stack', stack, setStack)}</div>
        <div className="row">
          {numField('Small blind', sb, setSb)}
          {numField('Big blind', bb, setBb)}
        </div>
        <div className="row">
          {numField('Ante (per player)', ante, setAnte)}
          {numField('Players at the table', playersText, setPlayersText)}
        </div>

        {orbitCost > 0 && n(stack) > 0 && (
          <section className="card col" style={{ gap: 6 }}>
            <div className="overline">Your M</div>
            <div className={`money money-lg ${zone.cls}`}>
              {m.toFixed(1)} — {zone.name}
            </div>
            <p className="muted" style={{ margin: 0 }}>{zone.advice}</p>
            <p className="muted small" style={{ margin: 0 }}>
              Effective M (adjusted for {players}-handed): {effectiveM.toFixed(1)} • one orbit
              costs {orbitCost.toLocaleString()}
            </p>
          </section>
        )}
      </main>
    </>
  );
}
