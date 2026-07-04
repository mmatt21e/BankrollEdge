// "What is my stack worth?" — value a single player's stack given the field
// size and the remaining payouts. Cash value assumes the other players are
// evenly stacked (all you enter is your own stack), which is the standard
// quick-ICM assumption. Chip-position metrics work at any field size; the
// ICM cash value reuses the capped exact model from the deal calculator.
import { icmEquity, ICM_MAX_PLAYERS } from './deal';

export type StackPosition =
  | 'Big stack'
  | 'Above average'
  | 'Average'
  | 'Below average'
  | 'Short stack';

export interface StackValueInput {
  /** Your chip stack. */
  stack: number;
  /** Players still in the tournament, including you. */
  players: number;
  /** Total chips in play across the whole field. */
  totalChips: number;
  /** Current big blind (0 = don't compute big blinds). */
  bigBlind: number;
  /** Remaining prize money on the table, one amount per paid place. */
  payouts: number[];
}

export interface StackValueResult {
  chipShare: number;
  averageStack: number;
  stacksVsAverage: number;
  position: StackPosition;
  /** Stack measured in big blinds, or null if no big blind was given. */
  bigBlinds: number | null;
  prizePool: number;
  /** ICM equity assuming opponents are evenly stacked; null above the cap. */
  icmValue: number | null;
  icmSupported: boolean;
  /** Chip-chop value: guaranteed floor + proportional share of the rest. */
  chipChopValue: number;
  /** The pool split evenly, for reference. */
  evenValue: number;
  /**
   * Cash value of a single big blind under each model — the stack value
   * divided by how many big blinds it holds. Null if no big blind was given.
   */
  perBigBlind: { icm: number | null; chipChop: number; even: number } | null;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

function classify(ratio: number): StackPosition {
  if (ratio >= 1.5) return 'Big stack';
  if (ratio >= 1.1) return 'Above average';
  if (ratio >= 0.9) return 'Average';
  if (ratio >= 0.5) return 'Below average';
  return 'Short stack';
}

export function valueStack(input: StackValueInput): StackValueResult {
  const stack = Math.max(0, input.stack);
  const players = Math.max(1, Math.round(input.players));
  const totalChips = Math.max(0, input.totalChips);
  const ladder = input.payouts.map((p) => Math.max(0, p)).sort((a, b) => b - a);
  const pool = round2(sum(ladder));

  const chipShare = totalChips > 0 ? stack / totalChips : 0;
  const averageStack = totalChips / players;
  const stacksVsAverage = averageStack > 0 ? stack / averageStack : 0;

  // Chip chop: everyone is guaranteed the lowest paid place they'll all reach,
  // then the rest of the pool splits by chips. No floor on a bubble deal.
  const floor = ladder.length >= players ? ladder[players - 1] : 0;
  const splitPool = pool - floor * players;
  const chipChopValue = round2(floor + splitPool * chipShare);

  const evenValue = round2(pool / players);

  // ICM with the opponents sharing the remaining chips equally.
  const icmSupported = players <= ICM_MAX_PLAYERS;
  let icmValue: number | null = null;
  if (icmSupported && totalChips > 0 && pool > 0) {
    const opponent = players > 1 ? (totalChips - stack) / (players - 1) : 0;
    const stacks = [stack, ...new Array(players - 1).fill(opponent)];
    icmValue = round2(icmEquity(stacks, ladder)[0]);
  }

  const bigBlinds = input.bigBlind > 0 && stack > 0 ? stack / input.bigBlind : null;
  const perBigBlind =
    bigBlinds !== null
      ? {
          icm: icmValue !== null ? round2(icmValue / bigBlinds) : null,
          chipChop: round2(chipChopValue / bigBlinds),
          even: round2(evenValue / bigBlinds),
        }
      : null;

  return {
    chipShare,
    averageStack,
    stacksVsAverage,
    position: classify(stacksVsAverage),
    bigBlinds,
    prizePool: pool,
    icmValue,
    icmSupported,
    chipChopValue,
    evenValue,
    perBigBlind,
  };
}
