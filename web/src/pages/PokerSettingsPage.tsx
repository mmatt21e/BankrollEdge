// Settings → Poker: default view, the poker-games pick list, and cash-game
// stakes presets.
import { useState } from 'react';
import { useAppState, useStoreList } from '../hooks/useAppState';
import {
  GAME_TYPES,
  GAME_TYPE_LABELS,
  SessionType,
  stakePresetLabel,
} from '../models/types';
import { MoneyInput, SectionCard, TopBar, useBack } from '../components/common';
import { GameListEditor } from '../components/GameListEditor';
import { stakeStore } from '../storage/db';

export default function PokerSettingsPage() {
  const app = useAppState();
  const back = useBack('/settings');

  return (
    <>
      <TopBar title="Poker" onBack={back} />
      <main className="page page--with-topbar">
        <SectionCard title="Default session type">
          <p className="muted" style={{ margin: 0 }}>
            The type pre-selected when you log a new session. Lists and the dashboard always
            open showing all games.
          </p>
          <div className="segmented" role="group" aria-label="Default session type">
            {(
              [
                ['ALL', 'All games'],
                ['CASH', 'Cash'],
                ['TOURNAMENT', 'Tourneys'],
              ] as ['ALL' | SessionType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={app.settings.defaultSessionType === value}
                onClick={() => app.updateSettings({ defaultSessionType: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </SectionCard>

        <GameListEditor
          title="Poker games"
          description="The games offered when you log a poker session. Remove ones you never play or add your own."
          builtins={GAME_TYPES.map((g) => ({ value: g, label: GAME_TYPE_LABELS[g] }))}
          hidden={app.settings.hiddenPokerGames}
          custom={app.settings.customPokerGames}
          onChange={({ hidden, custom }) =>
            app.updateSettings({ hiddenPokerGames: hidden, customPokerGames: custom })
          }
        />

        <PokerStakesCard />
      </main>
    </>
  );
}

function PokerStakesCard() {
  const stakes = useStoreList(stakeStore);
  const poker = stakes.items
    .filter((s) => s.kind === 'POKER')
    .sort((a, b) => a.smallBlind - b.smallBlind || a.bigBlind - b.bigBlind);
  const [sb, setSb] = useState('');
  const [bb, setBb] = useState('');

  const add = async () => {
    const a = Number.parseFloat(sb) || 0;
    const b = Number.parseFloat(bb) || 0;
    if (a <= 0 && b <= 0) return;
    await stakes.save({ id: 0, kind: 'POKER', smallBlind: a, bigBlind: b, minBet: 0, maxBet: 0 });
    setSb('');
    setBb('');
  };

  return (
    <SectionCard title="Cash game stakes">
      <p className="muted" style={{ margin: 0 }}>
        Saved blinds appear as one-tap choices when you log a cash session. You can also add
        new ones straight from the session screen.
      </p>
      {poker.length === 0 && (
        <p className="muted small" style={{ margin: 0 }}>No saved blinds yet.</p>
      )}
      {poker.map((p) => (
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
          <MoneyInput value={sb} onChange={setSb} placeholder="Small blind" ariaLabel="Small blind" />
        </label>
        <label className="field grow">
          <MoneyInput value={bb} onChange={setBb} placeholder="Big blind" ariaLabel="Big blind" />
        </label>
        <button type="button" className="btn" onClick={add}>Add</button>
      </div>
    </SectionCard>
  );
}
