// Odds / equity calculator: pick a variant, tap card slots to assign hole
// cards and board cards, add players (empty hand = random; NLH hands can use
// a saved range instead), then run the Monte-Carlo simulation in a worker.
import { useEffect, useRef, useState } from 'react';
import { Card, FULL_DECK } from '../domain/poker/cards';
import { CardFace } from '../components/CardFace';
import {
  EquityPlayer,
  EquityResult,
  GameVariant,
  VARIANT_LABELS,
  holeSize,
  isHiLo,
} from '../domain/poker/equity';
import { gridCells, rangePercent } from '../domain/poker/ranges';
import { SavedRange } from '../models/types';
import { useAppState } from '../hooks/useAppState';
import { percent } from '../domain/format';
import { Dialog, TopBar, useBack } from '../components/common';
import type { EquityRequest, EquityResponse } from '../workers/equityWorker';

const VARIANTS = Object.keys(VARIANT_LABELS) as GameVariant[];
const TRIALS = 20_000;

interface PlayerState {
  key: number;
  cards: (Card | null)[];
  range: SavedRange | null;
}

let nextKey = 1;
const emptyPlayer = (size: number): PlayerState => ({
  key: nextKey++,
  cards: new Array(size).fill(null),
  range: null,
});

/** Which slot the next tap on the deck fills: [player index (-1 = board), slot]. */
type Target = { player: number; slot: number } | null;

export default function OddsPage() {
  const app = useAppState();
  const back = useBack('/tools');
  const [variant, setVariant] = useState<GameVariant>('NLH');
  const [players, setPlayers] = useState<PlayerState[]>([emptyPlayer(2), emptyPlayer(2)]);
  const [board, setBoard] = useState<(Card | null)[]>(new Array(5).fill(null));
  const [target, setTarget] = useState<Target>(null);
  const [rangeFor, setRangeFor] = useState<number | null>(null);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/equityWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<EquityResponse>) => {
      if (e.data.id !== requestId.current) return; // stale run
      if (e.data.type === 'progress') setProgress(e.data.done / e.data.total);
      else {
        setResult(e.data.result);
        setProgress(null);
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const size = holeSize(variant);
  const used = new Set<Card>([
    ...players.flatMap((p) => p.cards.filter((c): c is Card => c !== null)),
    ...board.filter((c): c is Card => c !== null),
  ]);

  const changeVariant = (v: GameVariant) => {
    setVariant(v);
    setPlayers((prev) => prev.map((p) => ({ ...p, cards: new Array(holeSize(v)).fill(null), range: null })));
    setBoard(new Array(5).fill(null));
    setResult(null);
  };

  const setCard = (t: NonNullable<Target>, card: Card | null) => {
    if (t.player === -1) {
      setBoard((prev) => prev.map((c, i) => (i === t.slot ? card : c)));
    } else {
      setPlayers((prev) =>
        prev.map((p, i) =>
          i === t.player ? { ...p, cards: p.cards.map((c, j) => (j === t.slot ? card : c)), range: null } : p,
        ),
      );
    }
    setResult(null);
  };

  const calculate = () => {
    const eqPlayers: EquityPlayer[] = players.map((p) => ({
      cards: p.cards.filter((c): c is Card => c !== null),
      range: p.range ? { cells: p.range.cells } : null,
    }));
    const req: EquityRequest = {
      id: ++requestId.current,
      variant,
      players: eqPlayers,
      board: board.filter((c): c is Card => c !== null),
      trials: TRIALS,
      seed: 42,
    };
    setProgress(0);
    setResult(null);
    workerRef.current?.postMessage(req);
  };

  const slotButton = (t: NonNullable<Target>, card: Card | null, label: string) => {
    const selected = target !== null && target.player === t.player && target.slot === t.slot;
    return (
      <button
        type="button"
        className="card-slot"
        aria-label={label}
        aria-pressed={selected}
        style={selected ? { borderColor: 'var(--gold-500)', borderWidth: 2 } : undefined}
        onClick={() => setTarget(selected ? null : t)}
      >
        {card !== null ? <CardFace card={card} /> : ''}
      </button>
    );
  };

  return (
    <>
      <TopBar
        title="Odds calculator"
        onBack={back}
        action={
          <button
            type="button"
            className="chip chip-small"
            aria-label={`Switch to the ${app.settings.deckColors === 'FOUR' ? 'two' : 'four'}-color deck`}
            onClick={() =>
              app.updateSettings({ deckColors: app.settings.deckColors === 'FOUR' ? 'TWO' : 'FOUR' })
            }
          >
            {app.settings.deckColors === 'FOUR' ? '4-color' : '2-color'}
          </button>
        }
      />
      <main className="page page--with-topbar">
        <label className="field">
          <span>Game</span>
          <select value={variant} onChange={(e) => changeVariant(e.target.value as GameVariant)}>
            {VARIANTS.map((v) => (
              <option key={v} value={v}>{VARIANT_LABELS[v]}</option>
            ))}
          </select>
        </label>

        <section className="card col" style={{ gap: 8 }}>
          <div className="overline">Board</div>
          <div className="row" style={{ gap: 6 }}>
            {board.map((c, i) => slotButton({ player: -1, slot: i }, c, `Board card ${i + 1}`))}
          </div>
        </section>

        {players.map((p, pi) => (
          <section key={p.key} className="card col" style={{ gap: 8 }}>
            <div className="row-between">
              <div className="overline">Player {pi + 1}</div>
              <div className="row" style={{ gap: 8 }}>
                {variant === 'NLH' && p.cards.every((c) => c === null) && (
                  <button type="button" className="chip chip-small" onClick={() => setRangeFor(pi)}>
                    {p.range ? `${p.range.name} (${percent(rangePercent(p.range.cells))})` : 'Range…'}
                  </button>
                )}
                {players.length > 2 && (
                  <button
                    type="button"
                    className="back"
                    aria-label={`Remove player ${pi + 1}`}
                    onClick={() => {
                      setPlayers((prev) => prev.filter((_, i) => i !== pi));
                      setResult(null);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {p.cards.map((c, i) => slotButton({ player: pi, slot: i }, c, `Player ${pi + 1} card ${i + 1}`))}
              {result && (
                <span className="col" style={{ marginLeft: 'auto', alignItems: 'flex-end', gap: 0 }}>
                  <span className="stat-value money">{percent(result.equity[pi])}</span>
                  <span className="muted small">
                    win {percent(result.winHigh[pi])}
                    {isHiLo(variant) && result.winLow ? ` • low ${percent(result.winLow[pi])}` : ''}
                  </span>
                </span>
              )}
            </div>
            {p.range && p.cards.every((c) => c === null) && (
              <p className="muted small" style={{ margin: 0 }}>Playing the "{p.range.name}" range.</p>
            )}
          </section>
        ))}

        <div className="row">
          <button
            type="button"
            className="btn btn-outline grow"
            disabled={players.length >= 9}
            onClick={() => {
              setPlayers((prev) => [...prev, emptyPlayer(size)]);
              setResult(null);
            }}
          >
            Add player
          </button>
          <button
            type="button"
            className="btn grow"
            disabled={progress !== null}
            onClick={calculate}
          >
            {progress !== null ? `Calculating… ${Math.round(progress * 100)}%` : 'Calculate'}
          </button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Empty hands play random cards. Equity is a {TRIALS.toLocaleString()}-trial Monte-Carlo
          estimate{isHiLo(variant) ? '; hi/lo pots split half to the best 8-or-better low' : ''}.
        </p>

        {target !== null && (
          <CardPickerDialog
            used={used}
            onPick={(card) => {
              setCard(target, card);
              setTarget(null);
            }}
            onClear={() => {
              setCard(target, null);
              setTarget(null);
            }}
            onClose={() => setTarget(null)}
          />
        )}

        {rangeFor !== null && (
          <RangeDialog
            saved={app.settings.savedRanges}
            initial={players[rangeFor]?.range ?? null}
            onSaveRanges={(ranges) => app.updateSettings({ savedRanges: ranges })}
            onApply={(range) => {
              setPlayers((prev) => prev.map((p, i) => (i === rangeFor ? { ...p, range } : p)));
              setResult(null);
              setRangeFor(null);
            }}
            onClose={() => setRangeFor(null)}
          />
        )}
      </main>
    </>
  );
}

/** Full-deck picker; used cards are disabled. */
function CardPickerDialog({
  used,
  onPick,
  onClear,
  onClose,
}: {
  used: Set<Card>;
  onPick: (card: Card) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog label="Pick a card" onClose={onClose}>
      <h2>Pick a card</h2>
      <div className="deck-grid">
        {FULL_DECK.map((c) => (
          <button
            key={c}
            type="button"
            className="card-slot"
            disabled={used.has(c)}
            onClick={() => onPick(c)}
          >
            <CardFace card={c} />
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-outline" onClick={onClear}>
          Clear slot
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}

/** 13×13 range grid with save/load of named ranges. */
function RangeDialog({
  saved,
  initial,
  onSaveRanges,
  onApply,
  onClose,
}: {
  saved: SavedRange[];
  initial: SavedRange | null;
  onSaveRanges: (ranges: SavedRange[]) => void;
  onApply: (range: SavedRange | null) => void;
  onClose: () => void;
}) {
  const [cells, setCells] = useState<string[]>(initial?.cells ?? []);
  const [name, setName] = useState(initial?.name ?? '');
  const grid = gridCells();

  const toggleCell = (cell: string) =>
    setCells((prev) => (prev.includes(cell) ? prev.filter((c) => c !== cell) : [...prev, cell]));

  const saveNamed = () => {
    const n = name.trim();
    if (n === '' || cells.length === 0) return;
    const others = saved.filter((r) => r.name !== n);
    const id = Math.max(0, ...saved.map((r) => r.id)) + 1;
    onSaveRanges([...others, { id, name: n, cells }]);
  };

  return (
    <Dialog label="Hand range" onClose={onClose}>
      <h2>Hand range</h2>
      <p className="muted small" style={{ margin: 0 }}>
        {cells.length > 0
          ? `${cells.length} cells • ${percent(rangePercent(cells))} of hands`
          : 'Tap cells to build the range (pairs on the diagonal, suited above, offsuit below).'}
      </p>
      <div className="range-grid" role="group" aria-label="Starting-hand grid">
        {grid.flat().map((cell) => (
          <button
            key={cell}
            type="button"
            aria-pressed={cells.includes(cell)}
            className={cells.includes(cell) ? 'on' : ''}
            onClick={() => toggleCell(cell)}
          >
            {cell}
          </button>
        ))}
      </div>
      {saved.length > 0 && (
        <div className="chips chips-wrap">
          {saved.map((r) => (
            <button key={r.id} type="button" className="chip chip-small" onClick={() => { setCells(r.cells); setName(r.name); }}>
              {r.name}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field grow">
          <span>Save as</span>
          <input type="text" value={name} placeholder="Button opening range" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-end' }} disabled={name.trim() === '' || cells.length === 0} onClick={saveNamed}>
          Save
        </button>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-outline" onClick={() => onApply(null)}>
          No range
        </button>
        <button type="button" className="btn" disabled={cells.length === 0} onClick={() => onApply({ id: 0, name: name.trim() || 'Custom', cells })}>
          Use range
        </button>
      </div>
    </Dialog>
  );
}
