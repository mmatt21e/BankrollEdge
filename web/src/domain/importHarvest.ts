// After a session import, imported venues / stakes / game types should become
// first-class managed entries — indistinguishable from ones created in the app
// (they show up in the pick-lists AND the Settings management screens). These
// pure helpers compute which new entries an import introduces; useAppState
// persists them into the venue/stakes stores and the custom-game settings.
import {
  GAME_TYPES,
  Session,
  StakePreset,
  TABLE_GAMES,
  Venue,
  stakePresetLabel,
} from '../models/types';

/** New venues in the imported sessions, not already saved (case-insensitive by
 *  name). Returned as unsaved rows (id 0) ready to persist. */
export function harvestVenues(imported: Session[], existing: Venue[]): Venue[] {
  const seen = new Set(existing.map((v) => v.name.trim().toLowerCase()));
  const out: Venue[] = [];
  for (const s of imported) {
    const name = s.location.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push({ id: 0, name });
    }
  }
  return out;
}

const stakeKey = (p: StakePreset) => `${p.kind}:${stakePresetLabel(p)}`;

/** New stakes presets in the imported sessions, not already saved. Non-table
 *  sessions contribute POKER blinds; table sessions contribute TABLE min/max. */
export function harvestStakes(imported: Session[], existing: StakePreset[]): StakePreset[] {
  const seen = new Set(existing.map(stakeKey));
  const out: StakePreset[] = [];
  for (const s of imported) {
    let preset: StakePreset | null = null;
    if (s.sessionType === 'TABLE') {
      if (s.tableMinBet > 0 || s.tableMaxBet > 0)
        preset = { id: 0, kind: 'TABLE', smallBlind: 0, bigBlind: 0, minBet: s.tableMinBet, maxBet: s.tableMaxBet };
    } else if (s.smallBlind > 0 || s.bigBlind > 0) {
      preset = { id: 0, kind: 'POKER', smallBlind: s.smallBlind, bigBlind: s.bigBlind, minBet: 0, maxBet: 0 };
    }
    if (preset && !seen.has(stakeKey(preset))) {
      seen.add(stakeKey(preset));
      out.push(preset);
    }
  }
  return out;
}

/** Custom (non-built-in) game names introduced by the imported sessions, split
 *  by poker vs table and excluding names already in the user's custom lists. */
export function harvestCustomGames(
  imported: Session[],
  existingPoker: string[],
  existingTable: string[],
): { poker: string[]; table: string[] } {
  const builtinPoker = new Set<string>(GAME_TYPES);
  const builtinTable = new Set<string>(TABLE_GAMES);
  const knownPoker = new Set(existingPoker);
  const knownTable = new Set(existingTable);
  const poker: string[] = [];
  const table: string[] = [];
  for (const s of imported) {
    if (s.sessionType === 'TABLE') {
      const g = (s.tableGame || '').trim();
      if (g && !builtinTable.has(g) && !knownTable.has(g)) {
        knownTable.add(g);
        table.push(g);
      }
    } else {
      const g = (s.gameType || '').trim();
      if (g && !builtinPoker.has(g) && !knownPoker.has(g)) {
        knownPoker.add(g);
        poker.push(g);
      }
    }
  }
  return { poker, table };
}
