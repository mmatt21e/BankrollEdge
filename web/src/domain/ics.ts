// iCalendar (.ics) generation for poker events — the portable way to get
// reminders onto both Android and iOS without any calendar-API integration:
// the user opens the file and their calendar app imports the event + alarm.
import { CalendarEvent } from '../models/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC timestamp in iCal basic format: 20260704T193000Z */
export function icsDate(epochMillis: number): string {
  const d = new Date(epochMillis);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function escapeIcsText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n');
}

export function buildIcs(event: CalendarEvent, now: number): string {
  const descriptionParts = [
    event.buyIn > 0 ? `Buy-in: ${event.buyIn}` : '',
    event.lateRegEnd > 0 ? `Late reg ends: ${new Date(event.lateRegEnd).toLocaleString()}` : '',
    event.notes,
  ].filter(Boolean);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BankrollEdge//Poker Calendar//EN',
    'BEGIN:VEVENT',
    `UID:bankrolledge-${event.id}-${event.startTime}@bankrolledge`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.startTime)}`,
    // Default 4h block; poker end times are unknowable anyway.
    `DTEND:${icsDate(event.startTime + 4 * 3_600_000)}`,
    `SUMMARY:${escapeIcsText(event.name || 'Poker session')}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
    descriptionParts.length ? `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}` : '',
  ];

  if (event.reminderMinutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(event.name || 'Poker session')}`,
      `TRIGGER:-PT${Math.round(event.reminderMinutes)}M`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}
