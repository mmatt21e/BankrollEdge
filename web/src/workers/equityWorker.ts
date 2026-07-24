// Web worker running the Monte-Carlo equity simulation off the UI thread.
// Trials run in chunks; each chunk posts a progress message, and chunk
// results are averaged (each chunk uses its own derived seed).
import {
  EquityPlayer,
  EquityResult,
  GameVariant,
  computeEquity,
} from '../domain/poker/equity';
import { Card } from '../domain/poker/cards';

export interface EquityRequest {
  id: number;
  variant: GameVariant;
  players: EquityPlayer[];
  board: Card[];
  trials: number;
  seed: number;
}

export type EquityResponse =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'result'; result: EquityResult };

const CHUNK = 2500;

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { id, variant, players, board, trials, seed } = e.data;
  const chunks = Math.max(1, Math.ceil(trials / CHUNK));
  const per = Math.ceil(trials / chunks);
  let acc: EquityResult | null = null;

  for (let c = 0; c < chunks; c++) {
    const r = computeEquity(variant, players, board, per, seed + c * 7919);
    if (!acc) {
      acc = r;
    } else {
      const w = c / (c + 1);
      const merge = (a: number[], b: number[]) => a.map((v, i) => v * w + b[i] * (1 - w));
      acc = {
        equity: merge(acc.equity, r.equity),
        winHigh: merge(acc.winHigh, r.winHigh),
        tieHigh: merge(acc.tieHigh, r.tieHigh),
        winLow: acc.winLow && r.winLow ? merge(acc.winLow, r.winLow) : null,
        trials: acc.trials + r.trials,
      };
    }
    (self as unknown as Worker).postMessage({
      id,
      type: 'progress',
      done: Math.min(trials, (c + 1) * per),
      total: trials,
    } satisfies EquityResponse);
  }

  (self as unknown as Worker).postMessage({ id, type: 'result', result: acc! } satisfies EquityResponse);
};
