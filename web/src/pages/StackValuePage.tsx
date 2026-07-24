// "My stack value" — a single player checks what their stack is worth right
// now: chip position (share, vs average, big blinds) and cash equity (ICM,
// chip chop, even) against the remaining payouts.
import { useMemo, useState } from 'react';
import { valueStack, StackPosition } from '../domain/stackValue';
import { ICM_MAX_PLAYERS } from '../domain/deal';
import { geometricPercentages } from '../domain/payout';
import { money, percent, ordinal } from '../domain/format';
import { useAppState } from '../hooks/useAppState';
import { TopBar, useBack } from '../components/common';

interface PayoutRow {
  amount: string;
}

const DEFAULT_PAYOUTS: PayoutRow[] = [
  { amount: '500' },
  { amount: '300' },
  { amount: '200' },
  { amount: '150' },
  { amount: '120' },
  { amount: '100' },
];

const POSITION_CLASS: Record<StackPosition, string> = {
  'Big stack': 'pos',
  'Above average': 'pos',
  Average: 'muted',
  'Below average': 'neg',
  'Short stack': 'neg',
};

export default function StackValuePage() {
  const back = useBack('/more');
  const currency = useAppState().settings.currency;

  const [stack, setStack] = useState('320000');
  const [players, setPlayers] = useState('6');
  const [totalChips, setTotalChips] = useState('1200000');
  const [bigBlind, setBigBlind] = useState('8000');
  const [payoutMode, setPayoutMode] = useState<'LADDER' | 'POOL'>('LADDER');
  const [payouts, setPayouts] = useState<PayoutRow[]>(DEFAULT_PAYOUTS);
  const [poolTotal, setPoolTotal] = useState('10000');
  const [paidPlaces, setPaidPlaces] = useState('9');

  const n = (v: string) => Number.parseFloat(v) || 0;
  const stackN = n(stack);
  const playersN = Math.max(1, Math.round(n(players)));
  const totalChipsN = n(totalChips);
  const paidPlacesN = Math.max(1, Math.round(n(paidPlaces)));

  // Either an exact per-place ladder, or a total pool spread across N places
  // on the standard geometric curve so ICM/chip-chop still have a structure.
  const ladder = useMemo(() => {
    if (payoutMode === 'POOL') {
      const total = n(poolTotal);
      return geometricPercentages(paidPlacesN).map((pct) => (total * pct) / 100);
    }
    return payouts.map((p) => n(p.amount));
  }, [payoutMode, payouts, poolTotal, paidPlacesN]);

  const result = useMemo(
    () =>
      valueStack({
        stack: stackN,
        players: playersN,
        totalChips: totalChipsN,
        bigBlind: n(bigBlind),
        payouts: ladder,
      }),
    [stackN, playersN, totalChipsN, bigBlind, ladder],
  );

  const setPayout = (index: number, amount: string) =>
    setPayouts((prev) => prev.map((r, ri) => (ri === index ? { amount } : r)));

  const stackExceedsTotal = totalChipsN > 0 && stackN > totalChipsN;

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    hint?: string,
  ) => (
    <label className="field grow" key={label}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      />
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );

  return (
    <>
      <TopBar title="My stack value" onBack={back} />
      <main className="page page--with-topbar">
        <div className="row">
          {field('My stack', stack, setStack)}
          {field('Players left', players, setPlayers)}
        </div>
        <div className="row">
          {field('Total chips in play', totalChips, setTotalChips)}
          {field('Big blind', bigBlind, setBigBlind, 'optional')}
        </div>

        {stackExceedsTotal && (
          <p className="neg small" role="alert" style={{ margin: 0 }}>
            ⚠ Your stack is larger than the total chips in play — check the totals.
          </p>
        )}

        <section className="card col">
          <h2>Chip position</h2>
          <div className="row-between">
            <span className="muted">Chip share</span>
            <span style={{ fontWeight: 600 }}>{percent(result.chipShare)}</span>
          </div>
          <div className="row-between">
            <span className="muted">Average stack</span>
            <span>{Math.round(result.averageStack).toLocaleString()}</span>
          </div>
          <div className="row-between">
            <span className="muted">Your stack vs average</span>
            <span style={{ fontWeight: 600 }}>{result.stacksVsAverage.toFixed(2)}×</span>
          </div>
          <div className="row-between" style={{ fontWeight: 700 }}>
            <span>Position</span>
            <span className={POSITION_CLASS[result.position]}>{result.position}</span>
          </div>
          {result.bigBlinds !== null && (
            <div className="row-between">
              <span className="muted">Big blinds</span>
              <span>{result.bigBlinds.toFixed(1)} BB</span>
            </div>
          )}
        </section>

        <div className="field">
          <span>Prize input</span>
          <div className="chips" role="group" aria-label="Prize input mode">
            <button
              type="button"
              className="chip"
              aria-pressed={payoutMode === 'LADDER'}
              onClick={() => setPayoutMode('LADDER')}
            >
              Remaining payouts
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={payoutMode === 'POOL'}
              onClick={() => setPayoutMode('POOL')}
            >
              Total prize pool
            </button>
          </div>
        </div>

        {payoutMode === 'LADDER' && (
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
        )}

        {payoutMode === 'POOL' && (
          <section className="card col">
            <h2>Total prize pool</h2>
            <div className="row">
              {field('Prize pool', poolTotal, setPoolTotal)}
              {field('Paid places', paidPlaces, setPaidPlaces)}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Spread across {paidPlacesN} place{paidPlacesN === 1 ? '' : 's'} on a standard
              payout curve. Switch to "Remaining payouts" for an exact ladder.
            </p>
            <div className="row-between" style={{ fontWeight: 700 }}>
              <span>Prize pool</span>
              <span className="money">{money(result.prizePool, currency)}</span>
            </div>
          </section>
        )}

        <section className="card col">
          <h2>Cash value of your stack</h2>
          <div className="row-between" style={{ fontWeight: 700 }}>
            <span>
              ICM value
              {result.icmValue !== null && (
                <span className="muted small"> (opponents assumed even)</span>
              )}
            </span>
            <span className="money">
              {result.icmValue !== null ? money(result.icmValue, currency) : '—'}
              {result.perBigBlind?.icm != null && (
                <span className="muted small"> · {money(result.perBigBlind.icm, currency)}/BB</span>
              )}
            </span>
          </div>
          {!result.icmSupported && (
            <p className="muted small" style={{ margin: 0 }}>
              ICM is a final-table metric — shown for {ICM_MAX_PLAYERS} players or fewer. Use the
              chip-chop value below as a proportional estimate for larger fields.
            </p>
          )}
          <div className="row-between">
            <span className="muted">Chip-chop value</span>
            <span className="money">
              {money(result.chipChopValue, currency)}
              {result.perBigBlind && (
                <span className="muted small"> · {money(result.perBigBlind.chipChop, currency)}/BB</span>
              )}
            </span>
          </div>
          <div className="row-between">
            <span className="muted">Even split</span>
            <span className="money">
              {money(result.evenValue, currency)}
              {result.perBigBlind && (
                <span className="muted small"> · {money(result.perBigBlind.even, currency)}/BB</span>
              )}
            </span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            ICM is the fair value of your chips against the payout ladder; because chips lose value
            as you accumulate them, a big stack's ICM value sits below its raw chip share.
            {result.perBigBlind
              ? ' The /BB figure is what one big blind of your stack is worth.'
              : ' Enter a big blind to see the cash value of each big blind.'}
          </p>
        </section>
      </main>
    </>
  );
}

