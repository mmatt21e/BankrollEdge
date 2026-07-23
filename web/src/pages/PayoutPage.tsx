// Tournament payout calculator with templates and pool-conserving rounding.
import { useMemo, useState } from 'react';
import {
  PayoutTemplateId,
  PAYOUT_TEMPLATE_LABELS,
  templatePercentages,
  geometricPercentages,
  computePayouts,
} from '../domain/payout';
import { money, percent } from '../domain/format';
import { useAppState } from '../hooks/useAppState';
import { TopBar, useBack } from '../components/common';

export default function PayoutPage() {
  const back = useBack('/tools');
  const currency = useAppState().settings.currency;

  const [entries, setEntries] = useState('9');
  const [rebuys, setRebuys] = useState('');
  const [addOns, setAddOns] = useState('');
  const [buyInAmount, setBuyInAmount] = useState('50');
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [addOnAmount, setAddOnAmount] = useState('');
  const [fee, setFee] = useState('');
  const [poolOverride, setPoolOverride] = useState('');
  const [template, setTemplate] = useState<PayoutTemplateId>('TOP3');
  const [customPlaces, setCustomPlaces] = useState('3');
  const [roundTo, setRoundTo] = useState('5');

  const n = (v: string) => Number.parseFloat(v) || 0;
  const entriesN = Math.max(0, Math.round(n(entries)));

  const percentages = useMemo(() => {
    if (template === 'CUSTOM') {
      return geometricPercentages(Math.max(1, Math.round(n(customPlaces))));
    }
    return templatePercentages(template, entriesN);
  }, [template, customPlaces, entriesN]);

  const result = useMemo(
    () =>
      computePayouts({
        entries: entriesN,
        rebuys: Math.round(n(rebuys)),
        addOns: Math.round(n(addOns)),
        buyInAmount: n(buyInAmount),
        rebuyAmount: n(rebuyAmount),
        addOnAmount: n(addOnAmount),
        fee: n(fee),
        prizePoolOverride: n(poolOverride),
        paidPlaces: percentages.length,
        percentages,
        roundTo: n(roundTo),
      }),
    [entriesN, rebuys, addOns, buyInAmount, rebuyAmount, addOnAmount, fee, poolOverride, percentages, roundTo],
  );

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="field grow" key={label}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ''))}
      />
    </label>
  );

  return (
    <>
      <TopBar title="Payout calculator" onBack={back} />
      <main className="page page--with-topbar">
        <div className="row">
          {field('Entries', entries, setEntries)}
          {field('Buy-in', buyInAmount, setBuyInAmount)}
        </div>
        <div className="row">
          {field('Rebuys', rebuys, setRebuys)}
          {field('Rebuy amount', rebuyAmount, setRebuyAmount)}
        </div>
        <div className="row">
          {field('Add-ons', addOns, setAddOns)}
          {field('Add-on amount', addOnAmount, setAddOnAmount)}
        </div>
        <div className="row">
          {field('House fee (total)', fee, setFee)}
          {field('Prize pool override', poolOverride, setPoolOverride)}
        </div>

        <div className="field">
          <span>Payout template</span>
          <div className="chips" role="group" aria-label="Payout template">
            {(Object.keys(PAYOUT_TEMPLATE_LABELS) as PayoutTemplateId[]).map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={template === t}
                onClick={() => setTemplate(t)}
              >
                {PAYOUT_TEMPLATE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          {template === 'CUSTOM' && field('Paid places', customPlaces, setCustomPlaces)}
          <label className="field grow">
            <span>Round payouts to</span>
            <select value={roundTo} onChange={(e) => setRoundTo(e.target.value)}>
              <option value="0">Exact</option>
              <option value="1">1</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
            </select>
          </label>
        </div>

        <section className="card col">
          <h2>Results</h2>
          <div className="row-between"><span className="muted">Total collected</span><span className="money">{money(result.totalCollected, currency)}</span></div>
          <div className="row-between"><span className="muted">House / fee</span><span className="money">{money(result.fee, currency)}</span></div>
          <div className="row-between" style={{ fontWeight: 700 }}>
            <span>Prize pool</span><span className="money">{money(result.prizePool, currency)}</span>
          </div>
          {result.places.map((p) => (
            <div key={p.place} className="row-between">
              <span>{ordinal(p.place)} <span className="muted small">({percent(p.percentage / 100)})</span></span>
              <span className="money" style={{ fontWeight: 600 }}>{money(p.amount, currency)}</span>
            </div>
          ))}
          {result.places.length > 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Rounding remainders are added to 1st place, so payouts always sum to the pool
              ({money(result.totalPaid, currency)}).
            </p>
          )}
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
