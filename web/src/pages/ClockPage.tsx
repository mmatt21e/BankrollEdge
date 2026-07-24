// Tournament blind clock. Setup mode edits/saves structures; run mode shows a
// large clock with pause/prev/next, audio + vibration on level change, a
// final-minute visual warning, and browser full-screen support.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BlindLevel, BlindStructure } from '../models/types';
import {
  ClockState,
  initialClock,
  remainingMs,
  shouldAdvance,
  pause,
  resume,
  goToLevel,
  formatClock,
  defaultStructure,
  playLevelNumber,
} from '../domain/clock';
import { structureStore } from '../storage/db';
import { useStoreList } from '../hooks/useAppState';
import { ConfirmDialog, TopBar, useBack } from '../components/common';

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch {
    // Audio unavailable (e.g. autoplay policy) — vibration may still fire.
  }
  navigator.vibrate?.([300, 100, 300]);
}

export default function ClockPage() {
  const back = useBack('/more');
  const { items: saved, save, remove } = useStoreList<BlindStructure>(structureStore);
  const [structure, setStructure] = useState<Omit<BlindStructure, 'id'> & { id: number }>(() => ({
    id: 0,
    ...defaultStructure(),
  }));
  const [clock, setClock] = useState<ClockState | null>(null);
  // The full-screen clock lives behind ?running=1 so the system back gesture
  // closes the overlay (back to the editor) instead of leaving the page —
  // the clock itself keeps running until Exit is confirmed.
  const [params, setParams] = useSearchParams();

  const startClock = () => {
    setClock(initialClock(Date.now()));
    setParams({ running: '1' });
  };
  const exitClock = () => {
    setClock(null);
    if (params.get('running') === '1') setParams({}, { replace: true });
  };

  return clock !== null && params.get('running') === '1' ? (
    <RunningClock
      structure={structure}
      clock={clock}
      setClock={setClock}
      onExit={exitClock}
    />
  ) : (
    <>
      <TopBar title="Tournament clock" onBack={back} />
      <main className="page page--with-topbar">
        {clock !== null && (
          <button type="button" className="live-start" onClick={() => setParams({ running: '1' })}>
            <span aria-hidden="true">⏱</span> Clock is running — back to the clock
          </button>
        )}
        <StructureEditor
          structure={structure}
          setStructure={setStructure}
          saved={saved}
          onSave={async () => {
            const savedStructure = await save(structure as BlindStructure);
            setStructure(savedStructure);
          }}
          onDelete={async (id) => {
            await remove(id);
            if (structure.id === id) setStructure({ id: 0, ...defaultStructure() });
          }}
        />
        <button
          type="button"
          className="btn btn-block"
          disabled={structure.levels.length === 0}
          onClick={startClock}
        >
          ▶ Start clock
        </button>
      </main>
    </>
  );
}

function StructureEditor({
  structure,
  setStructure,
  saved,
  onSave,
  onDelete,
}: {
  structure: BlindStructure;
  setStructure: (s: BlindStructure) => void;
  saved: BlindStructure[];
  onSave: () => void;
  onDelete: (id: number) => void;
}) {
  const [nameMissing, setNameMissing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BlindStructure | null>(null);
  const setLevel = (index: number, patch: Partial<BlindLevel>) => {
    const levels = structure.levels.map((l, li) => (li === index ? { ...l, ...patch } : l));
    setStructure({ ...structure, levels });
  };
  const removeLevel = (index: number) =>
    setStructure({ ...structure, levels: structure.levels.filter((_, li) => li !== index) });
  const addLevel = (isBreak: boolean) => {
    const lastPlay = [...structure.levels].reverse().find((l) => !l.isBreak);
    const next: BlindLevel = isBreak
      ? { smallBlind: 0, bigBlind: 0, ante: 0, durationMin: 10, isBreak: true }
      : {
          smallBlind: (lastPlay?.smallBlind ?? 25) * 2 || 25,
          bigBlind: (lastPlay?.bigBlind ?? 50) * 2 || 50,
          ante: lastPlay?.ante ?? 0,
          durationMin: lastPlay?.durationMin ?? 20,
          isBreak: false,
        };
    setStructure({ ...structure, levels: [...structure.levels, next] });
  };

  const saveTemplate = () => {
    if (structure.name.trim() === '') {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    onSave();
  };

  const numInput = (
    value: number,
    onChange: (v: number) => void,
    label: string,
  ) => (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={value === 0 ? '' : String(value)}
      placeholder="0"
      style={{ width: '100%', minHeight: 40 }}
      onChange={(e) => onChange(Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
    />
  );

  return (
    <>
      {saved.length > 0 && (
        <section className="card col">
          <h2>Saved templates</h2>
          {saved.map((s) => (
            <div key={s.id} className="row-between">
              <button
                type="button"
                className="btn btn-outline grow"
                onClick={() => setStructure(s)}
              >
                {s.name} ({s.levels.length} levels)
              </button>
              <button
                type="button"
                className="back"
                aria-label={`Delete template ${s.name}`}
                onClick={() => setPendingDelete(s)}
              >
                🗑
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="card col">
        <label className="field">
          <span>Structure name</span>
          <input
            type="text"
            value={structure.name}
            onChange={(e) => {
              setStructure({ ...structure, name: e.target.value });
              if (e.target.value.trim() !== '') setNameMissing(false);
            }}
          />
        </label>
        {nameMissing && (
          <p className="neg small" style={{ margin: 0 }}>
            Give the template a name before saving it.
          </p>
        )}
        <label className="field">
          <span>Late registration closes after level (0 = none)</span>
          <input
            type="text"
            inputMode="numeric"
            value={structure.lateRegEndLevel === 0 ? '' : String(structure.lateRegEndLevel)}
            placeholder="0"
            onChange={(e) =>
              setStructure({
                ...structure,
                lateRegEndLevel: Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 0,
              })
            }
          />
        </label>

        <div className="overline">Levels (SB / BB / ante / minutes)</div>
        {structure.levels.map((l, index) => (
          <div key={index} className="row" style={{ alignItems: 'center' }}>
            <span className="muted small" style={{ width: 26 }}>
              {l.isBreak ? '☕' : playLevelNumber(structure.levels, index)}
            </span>
            {l.isBreak ? (
              <span className="grow muted">Break</span>
            ) : (
              <>
                <span className="grow">{numInput(l.smallBlind, (v) => setLevel(index, { smallBlind: v }), `Level ${index + 1} small blind`)}</span>
                <span className="grow">{numInput(l.bigBlind, (v) => setLevel(index, { bigBlind: v }), `Level ${index + 1} big blind`)}</span>
                <span className="grow">{numInput(l.ante, (v) => setLevel(index, { ante: v }), `Level ${index + 1} ante`)}</span>
              </>
            )}
            <span style={{ width: 64 }}>{numInput(l.durationMin, (v) => setLevel(index, { durationMin: v }), `Level ${index + 1} minutes`)}</span>
            <button type="button" className="back" aria-label={`Remove level ${index + 1}`} onClick={() => removeLevel(index)}>
              ✕
            </button>
          </div>
        ))}
        <div className="row">
          <button type="button" className="btn btn-outline grow" onClick={() => addLevel(false)}>
            + Level
          </button>
          <button type="button" className="btn btn-outline grow" onClick={() => addLevel(true)}>
            + Break
          </button>
          <button type="button" className="btn grow" onClick={saveTemplate}>
            Save template
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this template?"
        message={pendingDelete ? `"${pendingDelete.name}" will be removed from your saved blind structures. This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const s = pendingDelete;
          setPendingDelete(null);
          if (s) onDelete(s.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function RunningClock({
  structure,
  clock,
  setClock,
  onExit,
}: {
  structure: BlindStructure;
  clock: ClockState;
  setClock: (c: ClockState) => void;
  onExit: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirmExit, setConfirmExit] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const levels = structure.levels;
  const level = levels[clock.levelIndex];

  // Tick + auto-advance with alert.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (shouldAdvance(clock, level, t)) {
        if (clock.levelIndex < levels.length - 1) {
          beep();
          setClock(goToLevel(clock, clock.levelIndex + 1, levels.length, t));
        } else {
          beep();
          setClock(pause(clock, t));
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [clock, level, levels.length, setClock]);

  // Keep the screen awake while the clock is on the table — a sleeping phone
  // silences level alerts. Best-effort; re-acquired when the tab returns.
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const acquire = () => {
      type WakeLockNav = Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
      };
      (navigator as WakeLockNav).wakeLock
        ?.request('screen')
        .then((l) => {
          lock = l;
        })
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const remaining = remainingMs(clock, level, now);
  const paused = clock.pausedAt > 0;
  const finalMinute = !level.isBreak && remaining <= 60_000 && remaining > 0;
  const nextPlay = levels.slice(clock.levelIndex + 1).find((l) => !l.isBreak);
  const lateRegOpen =
    structure.lateRegEndLevel > 0 &&
    playLevelNumber(levels, clock.levelIndex) <= structure.lateRegEndLevel &&
    !level.isBreak;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  return (
    <div ref={rootRef} className={`clock-screen ${finalMinute ? 'clock-warning' : ''}`}>
      <div className="row-between" style={{ width: '100%', padding: '8px 16px' }}>
        <button type="button" className="btn btn-outline" onClick={() => setConfirmExit(true)}>✕ Exit</button>
        <span className="overline">{structure.name}</span>
        <button type="button" className="btn btn-outline" onClick={toggleFullscreen}>⛶ Full screen</button>
      </div>

      <div className="overline" style={{ fontSize: '1rem' }}>
        {level.isBreak ? 'Break' : `Level ${playLevelNumber(levels, clock.levelIndex)}`}
        {lateRegOpen && ' • Late reg open'}
      </div>

      <div className="clock-time" role="timer" aria-label="Time remaining in level">
        {formatClock(remaining)}
      </div>

      {!level.isBreak && (
        <div className="clock-blinds">
          {level.smallBlind} / {level.bigBlind}
          {level.ante > 0 && <span className="clock-ante"> ante {level.ante}</span>}
        </div>
      )}

      {nextPlay && (
        <div className="muted" style={{ fontSize: '1.05rem' }}>
          Next: {nextPlay.smallBlind} / {nextPlay.bigBlind}
          {nextPlay.ante > 0 ? ` (${nextPlay.ante})` : ''}
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={clock.levelIndex === 0}
          onClick={() => setClock(goToLevel(clock, clock.levelIndex - 1, levels.length, Date.now()))}
        >
          ‹ Prev
        </button>
        <button
          type="button"
          className="btn"
          style={{ minWidth: 130 }}
          onClick={() =>
            setClock(paused ? resume(clock, Date.now()) : pause(clock, Date.now()))
          }
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={clock.levelIndex >= levels.length - 1}
          onClick={() => setClock(goToLevel(clock, clock.levelIndex + 1, levels.length, Date.now()))}
        >
          Next ›
        </button>
      </div>

      <ConfirmDialog
        open={confirmExit}
        title="End the tournament clock?"
        message="The clock and its current level are discarded. Use the back gesture instead to leave this screen with the clock still running."
        confirmLabel="End clock"
        danger
        onConfirm={() => {
          setConfirmExit(false);
          onExit();
        }}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
}
