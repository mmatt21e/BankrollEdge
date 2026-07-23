// Tiny helpers shared by the domain calculators — one definition each for
// cent rounding and calendar labels, so the session and bet aggregations
// (and the money tools) can't drift apart.

/** Round to cents. */
export const round2 = (v: number): number => Math.round(v * 100) / 100;

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Chart label for a month: "Jan '26". */
export const monthLabel = (d: Date): string =>
  `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear() % 100).padStart(2, '0')}`;

/** Sortable numeric month key: 2026-01 → 202601. */
export const monthSortKey = (d: Date): number => d.getFullYear() * 100 + d.getMonth() + 1;

/** Day-of-week index with Monday first (0 = Monday … 6 = Sunday). */
export const mondayIndex = (d: Date): number => (d.getDay() + 6) % 7;
