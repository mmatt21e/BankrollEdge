// Deal / chop calculator: when the remaining players agree to split the pool,
// work out each person's share by ICM, chip chop, or an even split.
import { useMemo, useState } from 'react';
import {
  DealMethod,
  DEAL_METHOD_LABELS,
  DealPlayer,
  computeDeal,
  ICM_MAX_PLAYERS,
} from '../domain/deal';
import { money, percent } from '../domain/format';
import { useAppState } from '../hooks/useAppState';
import { TopBar, useBack } from '../components/common';

interface PlayerRow {
  name: string;
  chips: string;
}

interface PayoutRow {
  amount: string;
}

const DEFAULT_PLAYERS: PlayerRow[] = [
  { name: 'Player 1', chips: '55000' },
  { name: 'Player 2', chips: '30000' },
  { name: 'Player 3', chips: '15000' },
];

const DEFAULT_PAYOUTS: PayoutRow[] = [
  { amount: '500' },
  { amount: '300' },
  { amount: '200' },
];

const METHODS: DealMethod[] = ['ICM', 'CHIP_CHOP', 'EVEN'];

const METHOD_BLURBS: Record<DealMethod, string> = {
  ICM: 'Chip-weighted equity — the fair value of each stack given the payouts.',
  CHIP_CHOP: 'Everyone takes the smallest payout, then the rest splits by chips.',
  EVEN: 'The remaining pool divided equally, ignoring chip counts.',
};

export default function DealPage() {
  const back = useBack('/tools');
  const currency = useAppState().settings.currency;

  const [players, setPlayers] = useState<PlayerRow[]>(DEFAULT_PLAYERS);
  const [payouts, setPayouts] = useState<PayoutRow[]>(DEFAULT_PAYOUTS);
  const [method, setMethod] = useState<DealMethod>('ICM');
  const [roundTo, setRoundTo] = useState('0');

  const n = (v: string) => Number.parseFloat(v) || 0;

  const dealPlayers = useMemo<DealPlayer[]>(
    () =>
      players.map((p, i) => ({
        name: p.name.trim() || `Player ${i + 1}`,
        chips: n(p.chips),
      })),
    [players],
  );
  const ladder = useMemo(() => payouts.map((p) => n(p.amount)), [payouts]);

  // ICM is exact but enumerates the ladder, so it's capped at a final table.
  const icmSupported = dealPlayers.length <= ICM_MAX_PLAYERS;
  const effectiveMethod: DealMethod =
    method === 'ICM' && !icmSupported ? 'CHIP_CHOP' : method;

  const result = useMemo(
    () => computeDeal(dealPlayers, ladder, effectiveMethod, n(roundTo)),
    [dealPlayers, ladder, effectiveMethod, roundTo],
  );

  // Every method at once for the side-by-side comparison card.
  const comparison = useMemo(
    () => ({
      ICM: icmSupported ? computeDeal(dealPlayers, ladder, 'ICM', n(roundTo)) : null,
      CHIP_CHOP: computeDeal(dealPlayers, ladder, 'CHIP_CHOP', n(roundTo)),
      EVEN: computeDeal(dealPlayers, ladder, 'EVEN', n(roundTo)),
    }),
    [dealPlayers, ladder, roundTo, icmSupported],
  );

  const setPlayer = (index: number, patch: Partial<PlayerRow>) =>
    setPlayers((prev) => prev.map((r, ri) => (ri === index ? { ...r, ...patch } : r)));
  const setPayout = (index: number, amount: string) =>
    setPayouts((prev) => prev.map((r, ri) => (ri === index ? { amount } : r)));

  const morePayoutsThanPlayers = ladder.filter((a) => a > 0).length > players.length;
  const fewerPayoutsThanPlayers = ladder.filter((a) => a > 0).length < players.length;

  return (
    <>
      <TopBar title="Deal / chop calculator" onBack={back} />
      <main className="page page--with-topbar">
        <section className="card col">
          <h2>Players still in</h2>
          <div className="row muted small">
            <span className="grow">Name</span>
            <span className="grow">Chip stack</span>
            <span style={{ width: 44 }} />
          </div>
          {players.map((r, index) => (
            <div key={index} className="row">
              <input
                className="grow"
                type="text"
                aria-label={`Player ${index + 1} name`}
                value={r.name}
                style={{ minHeight: 44, width: '100%' }}
                onChange={(e) => setPlayer(index, { name: e.target.value })}
              />
              <input
                className="grow"
                type="text"
                inputMode="numeric"
                aria-label={`Player ${index + 1} chip stack`}
                value={r.chips}
                style={{ minHeight: 44, width: '100%' }}
                onChange={(e) => setPlayer(index, { chips: e.target.value.replace(/\D/g, '') })}
              />
              <button
                type="button"
                className="back"
                aria-label={`Remove player ${index + 1}`}
                disabled={players.length <= 2}
                onClick={() => setPlayers((prev) => prev.filter((_, ri) => ri !== index))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPlayers((prev) => [...prev, { name: `Player ${prev.length + 1}`, chips: '' }])}
          >
            + Player
          </button>
          <div className="row-between muted small">
            <span>Total chips</span>
            <span>{result.totalChips.toLocaleString()}</span>
          </div>
        </section>

        <section className="card col">
          <h2>Remaining payouts</h2>
          <p className="muted small" style={{ margin: 0 }}>
            The prize money still on the table, biggest first. Order doesn't matter.
          </p>
          {payouts.map((r, index) => (
            <div key={index} className="row">
              <span className="muted" style={{ minWidth: 64 }}>{ordinal(index + 1)}</span>
              <input
                className="grow"
                type="text"
                inputMode="decimal"
                aria-label={`${ordinal(index + 1)} place payout`}
                value={r.amount}
                style={{ minHeight: 44, width: '100%' }}
                onChange={(e) => setPayout(index, e.target.value.replace(/[^0-9.]/g, ''))}
              />
              <button
                type="button"
                className="back"
                aria-label={`Remove ${ordinal(index + 1)} place payout`}
                disabled={payouts.length <= 1}
                onClick={() => setPayouts((prev) => prev.filter((_, ri) => ri !== index))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPayouts((prev) => [...prev, { amount: '' }])}
          >
            + Payout place
          </button>
          <div className="row-between" style={{ fontWeight: 700 }}>
            <span>Prize pool</span>
            <span className="money">{money(result.prizePool, currency)}</span>
          </div>
        </section>

        <div className="field">
          <span>Method</span>
          <div className="chips" role="group" aria-label="Deal method">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
              >
                {DEAL_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: '4px 0 0' }}>{METHOD_BLURBS[method]}</p>
        </div>

        <div className="row">
          <label className="field grow">
            <span>Round shares to</span>
            <select value={roundTo} onChange={(e) => setRoundTo(e.target.value)}>
              <option value="0">Exact</option>
              <option value="1">1</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
            </select>
          </label>
        </div>

        {morePayoutsThanPlayers && (
          <p className="neg small" role="alert" style={{ margin: 0 }}>
            ⚠ There are more paid places than players — extra low payouts are ignored.
          </p>
        )}
        {fewerPayoutsThanPlayers && (
          <p className="muted small" style={{ margin: 0 }}>
            Fewer payouts than players (a bubble deal): the chip chop has no guaranteed floor.
          </p>
        )}
        {method === 'ICM' && !icmSupported && (
          <p className="neg small" role="alert" style={{ margin: 0 }}>
            ⚠ ICM is available for {ICM_MAX_PLAYERS} players or fewer — showing chip chop instead.
          </p>
        )}

        <section className="card col">
          <h2>{DEAL_METHOD_LABELS[effectiveMethod]} result</h2>
          {result.shares.map((s, i) => (
            <div key={i} className="row-between">
              <span>
                {s.name} <span className="muted small">({percent(s.chipPct)} of chips)</span>
              </span>
              <span className="money" style={{ fontWeight: 600 }}>{money(s.amount, currency)}</span>
            </div>
          ))}
          <div className="row-between" style={{ fontWeight: 700 }}>
            <span>Total paid</span>
            <span className="money">{money(result.totalPaid, currency)}</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Shares always sum to the pool; any rounding remainder goes to the chip leader.
          </p>
        </section>

        <section className="card col">
          <h2>Compare methods</h2>
          <div className="row muted small">
            <span className="grow">Player</span>
            <span style={{ width: 84, textAlign: 'right' }}>ICM</span>
            <span style={{ width: 84, textAlign: 'right' }}>Chip chop</span>
            <span style={{ width: 84, textAlign: 'right' }}>Even</span>
          </div>
          {result.shares.map((s, i) => (
            <div key={i} className="row">
              <span className="grow">{s.name}</span>
              <span className="money small" style={{ width: 84, textAlign: 'right' }}>
                {comparison.ICM ? money(comparison.ICM.shares[i].amount, currency) : '—'}
              </span>
              <span className="money small" style={{ width: 84, textAlign: 'right' }}>
                {money(comparison.CHIP_CHOP.shares[i].amount, currency)}
              </span>
              <span className="money small" style={{ width: 84, textAlign: 'right' }}>
                {money(comparison.EVEN.shares[i].amount, currency)}
              </span>
            </div>
          ))}
          <p className="muted small" style={{ margin: 0 }}>
            ICM values chips fairly against the payout ladder; chip chop rewards big stacks more.
          </p>
        </section>
      </main>
    </>
  );
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? 'th'
    : n % 10 === 1 ? 'st'
    : n % 10 === 2 ? 'nd'
    : n % 10 === 3 ? 'rd'
    : 'th';
  return `${n}${suffix}`;
}
