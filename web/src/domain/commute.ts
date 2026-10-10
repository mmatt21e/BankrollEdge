import { ActiveSession, Session } from '../models/types';

/** Optional whole minutes. Blank and zero both mean no recorded commute. */
export function parseCommuteMinutes(text: string): number | null {
  const value = text.trim();
  if (value === '') return 0;
  if (!/^\d+$/.test(value)) return null;
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) && minutes >= 0 ? minutes : null;
}

/** Old active drafts contain only a measured outbound leg. Preserve that
 *  known duration; never silently infer a return trip. */
export function activeCommuteMinutes(draft: ActiveSession): number {
  return draft.travelMinutes ?? draft.travelOneWayMinutes ?? 0;
}

/** Preserve values that the editor did not change, including timestamp
 *  seconds, whitespace, legacy fields and future optional record fields. */
export function mergeSessionEdits(original: Session, initial: Session, edited: Session): Session {
  const changes = Object.fromEntries(
    Object.entries(edited).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(initial[key as keyof Session]),
    ),
  );
  return { ...original, ...changes, id: original.id };
}
