// Manage a game-type pick list: remove built-ins (hide), restore them, and
// add custom games (stored by name). Used by the Poker and Table games
// settings pages.
import { useState } from 'react';
import { GameOption } from '../models/types';
import { SectionCard } from './common';

export function GameListEditor({
  title,
  description,
  builtins,
  hidden,
  custom,
  onChange,
}: {
  title: string;
  description: string;
  /** Every built-in option (key + label). */
  builtins: GameOption[];
  /** Built-in keys the user removed. */
  hidden: string[];
  /** User-added game names. */
  custom: string[];
  onChange: (next: { hidden: string[]; custom: string[] }) => void;
}) {
  const [name, setName] = useState('');
  const visibleBuiltins = builtins.filter((b) => !hidden.includes(b.value));
  const hiddenBuiltins = builtins.filter((b) => hidden.includes(b.value));
  const visibleCount = visibleBuiltins.length + custom.length;

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const lower = n.toLowerCase();
    // Typing a removed built-in's name restores it instead of duplicating it.
    const builtin = builtins.find(
      (b) => b.label.toLowerCase() === lower || b.value.toLowerCase() === lower,
    );
    if (builtin) {
      if (hidden.includes(builtin.value)) {
        onChange({ hidden: hidden.filter((h) => h !== builtin.value), custom });
      }
    } else if (!custom.some((c) => c.toLowerCase() === lower)) {
      onChange({ hidden, custom: [...custom, n] });
    }
    setName('');
  };

  return (
    <SectionCard title={title}>
      <p className="muted" style={{ margin: 0 }}>{description}</p>

      {visibleBuiltins.map((b) => (
        <div className="row-between" key={b.value}>
          <span>{b.label}</span>
          <button
            type="button"
            className="back"
            aria-label={`Remove ${b.label}`}
            disabled={visibleCount <= 1}
            onClick={() => onChange({ hidden: [...hidden, b.value], custom })}
          >
            🗑
          </button>
        </div>
      ))}
      {custom.map((c) => (
        <div className="row-between" key={c}>
          <span>{c}</span>
          <button
            type="button"
            className="back"
            aria-label={`Remove ${c}`}
            disabled={visibleCount <= 1}
            onClick={() => onChange({ hidden, custom: custom.filter((x) => x !== c) })}
          >
            🗑
          </button>
        </div>
      ))}

      <div className="row">
        <label className="field grow">
          <input
            type="text"
            placeholder="Add a game"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          />
        </label>
        <button type="button" className="btn" onClick={add}>Add</button>
      </div>

      {hiddenBuiltins.length > 0 && (
        <>
          <span className="overline">Removed — tap to restore</span>
          <div className="chips chips-wrap">
            {hiddenBuiltins.map((b) => (
              <button
                key={b.value}
                type="button"
                className="chip"
                onClick={() =>
                  onChange({ hidden: hidden.filter((h) => h !== b.value), custom })
                }
              >
                + {b.label}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="muted small" style={{ margin: 0 }}>
        Existing sessions keep their game even if it's removed here; removing only hides it
        from the pickers.
      </p>
    </SectionCard>
  );
}
