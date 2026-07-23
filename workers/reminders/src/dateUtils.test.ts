import { describe, it, expect } from 'vitest';
import { zonedDateId, zonedMinutesSinceMidnight, zonedWeekday } from './dateUtils';

describe('zonedDateId', () => {
  it('formats the date in UTC', () => {
    expect(zonedDateId(new Date('2026-07-23T10:00:00Z'), 'UTC')).toBe('2026-07-23');
  });

  it('rolls the date back a day for a negative-offset timezone before local midnight', () => {
    // 2026-07-23T02:00:00Z is 2026-07-22T21:00:00 in America/New_York (UTC-5 in July... actually UTC-4 DST)
    expect(zonedDateId(new Date('2026-07-23T02:00:00Z'), 'America/New_York')).toBe('2026-07-22');
  });
});

describe('zonedMinutesSinceMidnight', () => {
  it('returns 0 at midnight UTC', () => {
    expect(zonedMinutesSinceMidnight(new Date('2026-07-23T00:00:00Z'), 'UTC')).toBe(0);
  });

  it('returns 405 at 06:45 UTC', () => {
    expect(zonedMinutesSinceMidnight(new Date('2026-07-23T06:45:00Z'), 'UTC')).toBe(405);
  });

  it('accounts for a fixed non-UTC offset (Asia/Kolkata, UTC+5:30, no DST)', () => {
    // 2026-07-23T01:15:00Z is 2026-07-23T06:45:00 in Asia/Kolkata
    expect(zonedMinutesSinceMidnight(new Date('2026-07-23T01:15:00Z'), 'Asia/Kolkata')).toBe(405);
  });
});

describe('zonedWeekday', () => {
  it('returns 0 for a Sunday (2026-07-19 is a Sunday)', () => {
    expect(zonedWeekday(new Date('2026-07-19T12:00:00Z'), 'UTC')).toBe(0);
  });

  it('returns 4 for a Thursday (2026-07-23 is a Thursday)', () => {
    expect(zonedWeekday(new Date('2026-07-23T12:00:00Z'), 'UTC')).toBe(4);
  });
});
