// Hold'em starting-hand ranges as 13×13 grid cells: "AA", "AKs", "T9o".
// Rows/columns run A → 2; upper triangle = suited, lower = offsuit.
import { Card, RANK_CHARS, rankOf, suitOf } from './cards';

/** Grid cell for a concrete two-card combo. */
export function cellOfPair(a: Card, b: Card): string {
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  if (hi === lo) return `${RANK_CHARS[hi]}${RANK_CHARS[lo]}`;
  const suited = suitOf(a) === suitOf(b);
  return `${RANK_CHARS[hi]}${RANK_CHARS[lo]}${suited ? 's' : 'o'}`;
}

export function pairMatchesCells(a: Card, b: Card, cells: readonly string[]): boolean {
  return cells.includes(cellOfPair(a, b));
}

/** All 169 cells in display order (A high → 2), row-major. */
export function gridCells(): string[][] {
  const ranks = [...RANK_CHARS].reverse(); // A,K,…,2
  return ranks.map((r1, i) =>
    ranks.map((r2, j) => {
      if (i === j) return `${r1}${r2}`;
      // Upper-right triangle = suited (higher rank first).
      return i < j ? `${r1}${r2}s` : `${r2}${r1}o`;
    }),
  );
}

/** Combos a cell represents (pairs 6, suited 4, offsuit 12) — for % display. */
export const cellComboCount = (cell: string): number =>
  cell.length === 2 ? 6 : cell.endsWith('s') ? 4 : 12;

export const rangePercent = (cells: readonly string[]): number =>
  cells.reduce((a, c) => a + cellComboCount(c), 0) / 1326;
