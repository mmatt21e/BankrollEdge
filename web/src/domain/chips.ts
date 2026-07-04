// Chip distribution calculator. Heuristic: players get more of the smaller
// denominations (for betting/change), with the target stack topped up by
// larger chips; inventory limits are respected and shortfalls reported.

export interface Denomination {
  value: number;
  /** Chips physically available across the whole set. */
  available: number;
}

export interface ChipAllocation {
  value: number;
  perPlayer: number;
  totalUsed: number;
  available: number;
}

export interface ChipPlanWarning {
  message: string;
}

export interface ChipPlan {
  perPlayerValue: number;
  targetStack: number;
  allocations: ChipAllocation[];
  totalChipsPerPlayer: number;
  warnings: ChipPlanWarning[];
  /** True when each player's stack hits the target exactly. */
  exact: boolean;
}

/**
 * Small denominations get descending "ideal share" weights of the stack value
 * (35 / 25 / 15 / ... %), then the largest denomination fills the remainder.
 * A final change-making pass fixes any leftover with smaller chips.
 */
export function planChips(
  players: number,
  targetStack: number,
  denominationsIn: Denomination[],
): ChipPlan {
  const warnings: ChipPlanWarning[] = [];
  const denoms = denominationsIn
    .filter((d) => d.value > 0 && d.available > 0)
    .sort((a, b) => a.value - b.value);

  if (players <= 0 || targetStack <= 0 || denoms.length === 0) {
    return {
      perPlayerValue: 0,
      targetStack,
      allocations: [],
      totalChipsPerPlayer: 0,
      warnings: [{ message: 'Enter players, a starting stack and at least one denomination.' }],
      exact: false,
    };
  }

  const perPlayer = new Map<number, number>(denoms.map((d) => [d.value, 0]));
  const maxPerPlayer = new Map<number, number>(
    denoms.map((d) => [d.value, Math.floor(d.available / players)]),
  );

  let remaining = targetStack;

  // Value share targeted at each of the smaller denominations.
  const SHARES = [0.35, 0.25, 0.15, 0.1, 0.05];
  const smalls = denoms.slice(0, -1);
  smalls.forEach((d, i) => {
    const budget = targetStack * (SHARES[i] ?? 0.05);
    let count = Math.min(Math.floor(budget / d.value), maxPerPlayer.get(d.value)!);
    // Keep at least 4 of the smallest chip when possible — needed for change.
    if (i === 0) count = Math.max(count, Math.min(4, maxPerPlayer.get(d.value)!));
    count = Math.min(count, Math.floor(remaining / d.value));
    perPlayer.set(d.value, count);
    remaining -= count * d.value;
  });

  // Fill the remainder from the largest denomination downward.
  for (const d of [...denoms].reverse()) {
    const room = maxPerPlayer.get(d.value)! - perPlayer.get(d.value)!;
    const take = Math.min(room, Math.floor(remaining / d.value));
    if (take > 0) {
      perPlayer.set(d.value, perPlayer.get(d.value)! + take);
      remaining -= take * d.value;
    }
  }

  if (remaining > 0) {
    warnings.push({
      message: `Short ${remaining} in chip value per player — add smaller denominations or more chips.`,
    });
  }

  const allocations: ChipAllocation[] = denoms.map((d) => {
    const count = perPlayer.get(d.value)!;
    return {
      value: d.value,
      perPlayer: count,
      totalUsed: count * players,
      available: d.available,
    };
  });

  for (const a of allocations) {
    if (a.totalUsed > a.available) {
      warnings.push({
        message: `Not enough ${a.value}-chips: need ${a.totalUsed}, have ${a.available}.`,
      });
    }
  }

  const perPlayerValue = allocations.reduce((sum, a) => sum + a.perPlayer * a.value, 0);
  return {
    perPlayerValue,
    targetStack,
    allocations,
    totalChipsPerPlayer: allocations.reduce((sum, a) => sum + a.perPlayer, 0),
    warnings,
    exact: perPlayerValue === targetStack,
  };
}
