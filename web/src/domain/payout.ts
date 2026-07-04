// Tournament payout calculator: prize pool assembly, percentage templates,
// and rounding that always conserves the pool (remainder goes to 1st place).

export interface PayoutInput {
  entries: number;
  rebuys: number;
  addOns: number;
  buyInAmount: number;
  rebuyAmount: number;
  addOnAmount: number;
  /** Flat house fee / rake taken off the top. */
  fee: number;
  /** Override the computed pool entirely (0 = compute from entries). */
  prizePoolOverride: number;
  paidPlaces: number;
  /** Percentages for each place, summing to ~100. */
  percentages: number[];
  /** Round payouts to this step (0 or 1 = exact cents). */
  roundTo: number;
}

export interface PayoutPlace {
  place: number;
  percentage: number;
  amount: number;
}

export interface PayoutResult {
  totalCollected: number;
  fee: number;
  prizePool: number;
  places: PayoutPlace[];
  /** Sum of place amounts — always equals prizePool after rounding. */
  totalPaid: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Standard percentage templates. 'TOP_10PCT' derives places from field size. */
export type PayoutTemplateId = 'WTA' | 'TOP2' | 'TOP3' | 'TOP_10PCT' | 'CUSTOM';

export const PAYOUT_TEMPLATE_LABELS: Record<PayoutTemplateId, string> = {
  WTA: 'Winner take all',
  TOP2: 'Top 2',
  TOP3: 'Top 3',
  TOP_10PCT: '10% of field',
  CUSTOM: 'Custom',
};

export function templatePercentages(template: PayoutTemplateId, entries: number): number[] {
  switch (template) {
    case 'WTA':
      return [100];
    case 'TOP2':
      return [65, 35];
    case 'TOP3':
      return [50, 30, 20];
    case 'TOP_10PCT': {
      const places = Math.max(1, Math.round(entries * 0.1));
      return geometricPercentages(places);
    }
    case 'CUSTOM':
      return [];
  }
}

/** Each place gets ~60% of the previous one, normalized to 100. */
export function geometricPercentages(places: number): number[] {
  const weights = Array.from({ length: places }, (_, i) => 0.6 ** i);
  const total = weights.reduce((a, w) => a + w, 0);
  const raw = weights.map((w) => (w / total) * 100);
  // Round to 1 decimal, forcing the first place to absorb the residue.
  const rounded = raw.map((p) => Math.round(p * 10) / 10);
  const sum = rounded.reduce((a, p) => a + p, 0);
  rounded[0] = Math.round((rounded[0] + 100 - sum) * 10) / 10;
  return rounded;
}

export function computePayouts(input: PayoutInput): PayoutResult {
  const totalCollected = round2(
    input.entries * input.buyInAmount +
      input.rebuys * input.rebuyAmount +
      input.addOns * input.addOnAmount,
  );
  const prizePool =
    input.prizePoolOverride > 0
      ? round2(input.prizePoolOverride)
      : round2(Math.max(0, totalCollected - input.fee));

  const pcts = input.percentages.slice(0, input.paidPlaces);
  const pctTotal = pcts.reduce((a, p) => a + p, 0) || 1;
  const step = input.roundTo > 1 ? input.roundTo : 0;

  const places: PayoutPlace[] = pcts.map((percentage, i) => {
    const exact = (prizePool * percentage) / pctTotal;
    const amount = step > 0 ? Math.floor(exact / step) * step : round2(exact);
    return { place: i + 1, percentage, amount };
  });

  // Rounding conservation: give any remainder to 1st place.
  const paidSoFar = round2(places.reduce((a, p) => a + p.amount, 0));
  const remainder = round2(prizePool - paidSoFar);
  if (places.length > 0 && remainder !== 0) {
    places[0] = { ...places[0], amount: round2(places[0].amount + remainder) };
  }

  return {
    totalCollected,
    fee: input.prizePoolOverride > 0 ? 0 : round2(input.fee),
    prizePool,
    places,
    totalPaid: round2(places.reduce((a, p) => a + p.amount, 0)),
  };
}
