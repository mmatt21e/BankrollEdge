// Settings → Table games: the table-games pick list and table-stakes presets.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useStoreList } from '../hooks/useAppState';
import { TABLE_GAMES, TABLE_GAME_LABELS, stakePresetLabel } from '../models/types';
import { MoneyInput, SectionCard, TopBar } from '../components/common';
import { GameListEditor } from '../components/GameListEditor';
import { stakeStore } from '../storage/db';

export default function TableGamesSettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const stakes = useStoreList(stakeStore);
  const table = stakes.items
    .filter((s) => s.kind === 'TABLE')
    .sort((a, b) => a.minBet - b.minBet || a.maxBet - b.maxBet);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

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
        <GameListEditor
          title="Table games"
          description="The games offered when you log a table-game session. Remove ones you never play or add your own."
          builtins={TABLE_GAMES.map((g) => ({ value: g, label: TABLE_GAME_LABELS[g] }))}
          hidden={app.settings.hiddenTableGames}
          custom={app.settings.customTableGames}
          onChange={({ hidden, custom }) =>
            app.updateSettings({ hiddenTableGames: hidden, customTableGames: custom })
          }
        />

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
              <MoneyInput value={min} onChange={setMin} placeholder="Min bet" ariaLabel="Min bet" />
            </label>
            <label className="field grow">
              <MoneyInput value={max} onChange={setMax} placeholder="Max bet" ariaLabel="Max bet" />
            </label>
            <button type="button" className="btn" onClick={add}>Add</button>
          </div>
        </SectionCard>
      </main>
    </>
  );
}
