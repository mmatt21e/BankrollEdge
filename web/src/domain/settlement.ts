// Home-game settlement math. Money conservation: total in (buy-ins + rebuys +
// add-ons) must equal total cash-outs; any difference is surfaced as the
// unresolved balance (chips still on the table, host cut, or a typo).
import { HomeGamePlayer } from '../models/types';

export interface PlayerNet {
  playerId: number;
  name: string;
  totalIn: number;
  cashOut: number;
  net: number; // cashOut - totalIn
  paid: boolean;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface Settlement {
  totalBuyIns: number;
  totalRebuys: number;
  totalAddOns: number;
  totalIn: number;
  totalCashOuts: number;
  /** totalIn - totalCashOuts. 0 when the night balances. */
  unresolved: number;
  nets: PlayerNet[]; // sorted winners first
  /** Minimal-count transfer suggestions (winners paid by losers). */
  transfers: Transfer[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function computeSettlement(players: HomeGamePlayer[]): Settlement {
  const totalBuyIns = round2(players.reduce((a, p) => a + p.buyIn, 0));
  const totalRebuys = round2(players.reduce((a, p) => a + p.rebuys, 0));
  const totalAddOns = round2(players.reduce((a, p) => a + p.addOns, 0));
  const totalIn = round2(totalBuyIns + totalRebuys + totalAddOns);
  const totalCashOuts = round2(players.reduce((a, p) => a + p.cashOut, 0));

  const nets: PlayerNet[] = players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      totalIn: round2(p.buyIn + p.rebuys + p.addOns),
      cashOut: p.cashOut,
      net: round2(p.cashOut - (p.buyIn + p.rebuys + p.addOns)),
      paid: p.paid,
    }))
    .sort((a, b) => b.net - a.net);

  return {
    totalBuyIns,
    totalRebuys,
    totalAddOns,
    totalIn,
    totalCashOuts,
    unresolved: round2(totalIn - totalCashOuts),
    nets,
    transfers: suggestTransfers(nets),
  };
}

/**
 * Greedy debtor→creditor matching: repeatedly pay the biggest creditor from
 * the biggest debtor. Produces at most (players - 1) transfers.
 */
function suggestTransfers(nets: PlayerNet[]): Transfer[] {
  const creditors = nets
    .filter((n) => n.net > 0.004)
    .map((n) => ({ name: n.name, left: n.net }));
  const debtors = nets
    .filter((n) => n.net < -0.004)
    .map((n) => ({ name: n.name, left: -n.net }));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = round2(Math.min(creditors[ci].left, debtors[di].left));
    if (pay > 0) {
      transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount: pay });
    }
    creditors[ci].left = round2(creditors[ci].left - pay);
    debtors[di].left = round2(debtors[di].left - pay);
    if (creditors[ci].left <= 0.004) ci++;
    if (debtors[di].left <= 0.004) di++;
  }
  return transfers;
}

/** Random seat draw: returns playerId → seat (1-based), shuffled. */
export function drawSeats(playerIds: number[], random: () => number = Math.random): Map<number, number> {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return new Map(shuffled.map((id, index) => [id, index + 1]));
}
