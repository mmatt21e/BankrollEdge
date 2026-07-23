// Port of Android Formatters/DateTimeUtils — money, percent, durations, dates.

const currencyFmt = (code: string): Intl.NumberFormat => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    });
  }
};

export const money = (amount: number, code: string): string =>
  currencyFmt(code).format(amount);

/** Just the symbol for a currency code: USD → $, EUR → €, JPY → ¥. */
export function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency: code })
        .formatToParts(1)
        .find((p) => p.type === 'currency')?.value ?? '$'
    );
  } catch {
    return '$';
  }
}

/** Always shows the sign: "+$1,250.00" / "-$40.00". */
export const signedMoney = (amount: number, code: string): string =>
  `${amount < 0 ? '-' : '+'}${currencyFmt(code).format(Math.abs(amount))}`;

/** Compact for chart labels: $1.2k, -$3.4k, $850. */
export function compactMoney(amount: number, code: string): string {
  let symbol = '$';
  try {
    symbol =
      new Intl.NumberFormat('en', { style: 'currency', currency: code })
        .formatToParts(1)
        .find((p) => p.type === 'currency')?.value ?? '$';
  } catch {
    // keep default
  }
  const sign = amount < 0 ? '-' : '';
  const v = Math.abs(amount);
  const body =
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `${(v / 1_000).toFixed(1)}k`
    : String(Math.round(v));
  return `${sign}${symbol}${body}`;
}

export const percent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

/** Signed betting-unit amount: "+12.5u" / "-3u". */
export function signedUnits(units: number): string {
  const v = Math.abs(units);
  const body = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `${units < 0 ? '-' : '+'}${body}u`;
}

/** Signed amount as units when unit display is enabled (and a unit value is
 *  set), otherwise as money — used for table-game amounts. */
export function signedUnitsOrMoney(
  amount: number,
  currency: string,
  showUnits: boolean,
  unitValue: number,
): string {
  return showUnits && unitValue > 0 ? signedUnits(amount / unitValue) : signedMoney(amount, currency);
}

/** Minutes → "3h 20m" / "45m". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export const perHour = (amount: number, code: string): string =>
  `${signedMoney(amount, code)}/hr`;

export const formatDate = (epochMillis: number): string =>
  new Date(epochMillis).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const formatDateTime = (epochMillis: number): string =>
  new Date(epochMillis).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** 0 → "12a", 13 → "1p" — x-axis labels for the hourly chart. */
export const hourLabel = (hour: number): string =>
  hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Epoch millis → the value for an <input type="date">: "2026-07-23". */
export function toDateInput(epochMillis: number): string {
  const d = new Date(epochMillis);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Epoch millis → the value for an <input type="time">: "19:30". */
export function toTimeInput(epochMillis: number): string {
  const d = new Date(epochMillis);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** hh:mm:ss for the live timer. */
export function elapsedClock(millis: number): string {
  const total = Math.max(0, Math.floor(millis / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}
