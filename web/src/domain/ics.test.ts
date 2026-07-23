import { describe, it, expect } from 'vitest';
import { buildIcs, escapeIcsText, icsDate } from './ics';
import { CalendarEvent } from '../models/types';

const EVENT: CalendarEvent = {
  id: 7,
  name: 'Sunday Major, Deep',
  location: 'Casino; Main Room',
  buyIn: 150,
  startTime: Date.UTC(2026, 6, 4, 19, 30, 0),
  lateRegEnd: 0,
  notes: 'line1\nline2',
  reminderMinutes: 60,
};

describe('icsDate', () => {
  it('formats UTC basic timestamps', () => {
    expect(icsDate(Date.UTC(2026, 6, 4, 19, 30, 0))).toBe('20260704T193000Z');
    expect(icsDate(0)).toBe('19700101T000000Z');
  });
});

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(EVENT, Date.UTC(2026, 0, 1));

  it('emits a well-formed calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTAMP:20260101T000000Z');
    expect(ics).toContain('DTSTART:20260704T193000Z');
  });

  it('blocks out four hours by default', () => {
    expect(ics).toContain('DTEND:20260704T233000Z');
  });

  it('escapes text fields', () => {
    expect(ics).toContain('SUMMARY:Sunday Major\\, Deep');
    expect(ics).toContain('LOCATION:Casino\\; Main Room');
    expect(ics).toContain('DESCRIPTION:Buy-in: 150\\nline1\\nline2');
  });

  it('adds a display alarm only when a reminder is set', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT60M');
    const silent = buildIcs({ ...EVENT, reminderMinutes: 0 }, 0);
    expect(silent).not.toContain('VALARM');
  });

  it('falls back to a default summary and skips empty fields', () => {
    const bare = buildIcs(
      { ...EVENT, name: '', location: '', buyIn: 0, notes: '', reminderMinutes: 0 },
      0,
    );
    expect(bare).toContain('SUMMARY:Poker session');
    expect(bare).not.toContain('LOCATION:');
    expect(bare).not.toContain('DESCRIPTION:');
  });
});
