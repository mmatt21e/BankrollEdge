// Settings → Table games: table-stakes presets.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreList } from '../hooks/useAppState';
import { stakePresetLabel } from '../models/types';
import { SectionCard, TopBar } from '../components/common';
import { stakeStore } from '../storage/db';

export default function TableGamesSettingsPage() {
  const navigate = useNavigate();
  const stakes = useStoreList(stakeStore);
  const table = stakes.items
    .filter((s) => s.kind === 'TABLE')
    .sort((a, b) => a.minBet - b.minBet || a.maxBet - b.maxBet);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const dec = (v: string) => v.replace(/[^0-9.]/g, '');

  const add = async () => {
    const a = Number.parseFloat(min) || 0;
    const b = Number.parseFloat(max) || 0;
    if (a <= 0 && b <= 0) return;
    await stakes.save({ id: 0, kind: 'TABLE', smallBlind: 0, bigBlind: 0, minBet: a, maxBet: b });
    setMin('');
    setMax('');
  };

  return (
    <>
      <TopBar title="Table games" onBack={() => navigate(-1)} />
      <main className="page" style={{ paddingTop: 0 }}>
        <SectionCard title="Table game stakes">
          <p className="muted" style={{ margin: 0 }}>
            Saved min/max bet spreads appear as one-tap choices when you log a table-game
            session. You can also add new ones straight from the session screen.
          </p>
          {table.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>No saved table stakes yet.</p>
          )}
          {table.map((p) => (
            <div className="row-between" key={p.id}>
              <span>{stakePresetLabel(p)}</span>
              <button
                type="button"
                className="back"
                aria-label={`Delete ${stakePresetLabel(p)}`}
                onClick={() => stakes.remove(p.id)}
              >
                🗑
              </button>
            </div>
          ))}
          <div className="row">
            <label className="field grow">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Min bet"
                value={min}
                onChange={(e) => setMin(dec(e.target.value))}
              />
            </label>
            <label className="field grow">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Max bet"
                value={max}
                onChange={(e) => setMax(dec(e.target.value))}
              />
            </label>
            <button type="button" className="btn" onClick={add}>Add</button>
          </div>
        </SectionCard>
      </main>
    </>
  );
}
