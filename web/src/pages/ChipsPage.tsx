// Chip distribution calculator: chips per player from your physical set,
// with inventory warnings and rebuy planning via the players field.
import { useMemo, useState } from 'react';
import { planChips, Denomination } from '../domain/chips';
import { TopBar, useBack } from '../components/common';

interface DenomRow {
  value: string;
  available: string;
}

const DEFAULT_SET: DenomRow[] = [
  { value: '25', available: '160' },
  { value: '100', available: '160' },
  { value: '500', available: '80' },
  { value: '1000', available: '60' },
];

export default function ChipsPage() {
  const back = useBack('/more');
  const [players, setPlayers] = useState('8');
  const [stack, setStack] = useState('10000');
  const [rows, setRows] = useState<DenomRow[]>(DEFAULT_SET);

  const plan = useMemo(() => {
    const denoms: Denomination[] = rows.map((r) => ({
      value: Number.parseFloat(r.value) || 0,
      available: Number.parseInt(r.available, 10) || 0,
    }));
    return planChips(
      Number.parseInt(players, 10) || 0,
      Number.parseFloat(stack) || 0,
      denoms,
    );
  }, [players, stack, rows]);

  const setRow = (index: number, patch: Partial<DenomRow>) =>
    setRows((prev) => prev.map((r, ri) => (ri === index ? { ...r, ...patch } : r)));

  return (
    <>
      <TopBar title="Tournament Chip stack setup" onBack={back} />
      <main className="page page--with-topbar">
        <div className="row">
          <label className="field grow">
            <span>Players (add expected rebuys as extra players)</span>
            <input
              type="text"
              inputMode="numeric"
              value={players}
              onChange={(e) => setPlayers(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="field grow">
            <span>Starting stack</span>
            <input
              type="text"
              inputMode="numeric"
              value={stack}
              onChange={(e) => setStack(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>

        <section className="card col">
          <h2>Your chip set</h2>
          <div className="row muted small">
            <span className="grow">Denomination</span>
            <span className="grow">Chips available</span>
            <span style={{ width: 44 }} />
          </div>
          {rows.map((r, index) => (
            <div key={index} className="row">
              <input
                className="grow"
                type="text"
                inputMode="numeric"
                aria-label={`Denomination ${index + 1} value`}
                value={r.value}
                style={{ minHeight: 44, width: '100%' }}
                onChange={(e) => setRow(index, { value: e.target.value.replace(/\D/g, '') })}
              />
              <input
                className="grow"
                type="text"
                inputMode="numeric"
                aria-label={`Denomination ${index + 1} available count`}
                value={r.available}
                style={{ minHeight: 44, width: '100%' }}
                onChange={(e) => setRow(index, { available: e.target.value.replace(/\D/g, '') })}
              />
              <button
                type="button"
                className="back"
                aria-label={`Remove denomination ${index + 1}`}
                onClick={() => setRows((prev) => prev.filter((_, ri) => ri !== index))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setRows((prev) => [...prev, { value: '', available: '' }])}
          >
            + Denomination
          </button>
        </section>

        <section className="card col">
          <h2>Recommended per player</h2>
          {plan.allocations.map((a) => (
            <div key={a.value} className="row-between">
              <span>
                <strong>{a.perPlayer}×</strong> {a.value}-chips
              </span>
              <span className={`muted small ${a.totalUsed > a.available ? 'neg' : ''}`}>
                uses {a.totalUsed} / {a.available}
              </span>
            </div>
          ))}
          <div className="row-between" style={{ fontWeight: 700 }}>
            <span>Stack value</span>
            <span className={plan.exact ? 'pos' : 'neg'}>
              {plan.perPlayerValue} / {plan.targetStack}
            </span>
          </div>
          <div className="row-between">
            <span className="muted">Chips per player</span>
            <span>{plan.totalChipsPerPlayer}</span>
          </div>
          {plan.warnings.map((w, wi) => (
            <p key={wi} className="neg small" style={{ margin: 0 }} role="alert">
              ⚠ {w.message}
            </p>
          ))}
        </section>
      </main>
    </>
  );
}
