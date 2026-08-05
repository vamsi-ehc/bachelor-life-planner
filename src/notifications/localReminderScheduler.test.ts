import { describe, it, expect } from 'vitest';
import { parseHHMM, todayFireTime, localDateId } from './localReminderScheduler';

describe('parseHHMM', () => {
  it('converts HH:MM into hours and minutes', () => {
    expect(parseHHMM('06:45')).toEqual({ hours: 6, minutes: 45 });
    expect(parseHHMM('00:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseHHMM('23:59')).toEqual({ hours: 23, minutes: 59 });
  });
});

describe('todayFireTime', () => {
  it('returns a Date for later today when the configured time has not passed', () => {
    const now = new Date(2026, 6, 23, 6, 0, 0);
    const result = todayFireTime('06:45', now);
    expect(result).toEqual(new Date(2026, 6, 23, 6, 45, 0, 0));
  });

  it('returns null when the configured time has already passed today', () => {
    const now = new Date(2026, 6, 23, 7, 0, 0);
    const result = todayFireTime('06:45', now);
    expect(result).toBeNull();
  });

  it('returns null when the configured time is exactly now', () => {
    const now = new Date(2026, 6, 23, 6, 45, 0, 0);
    const result = todayFireTime('06:45', now);
    expect(result).toBeNull();
  });
});

describe('localDateId', () => {
  it('formats a date as YYYY-MM-DD using local fields', () => {
    expect(localDateId(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateId(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
