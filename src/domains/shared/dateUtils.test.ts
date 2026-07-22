import { describe, it, expect } from 'vitest';
import { todayId, dayOfWeek, dayOfMonth, daysInMonth, weekId } from './dateUtils';

describe('todayId', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2026, 6, 20); // July 20, 2026 (month is 0-indexed)
    expect(todayId(date)).toBe('2026-07-20');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(todayId(date)).toBe('2026-01-05');
  });
});

describe('dayOfWeek', () => {
  it('returns 0 for a Sunday date id', () => {
    expect(dayOfWeek('2026-07-19')).toBe(0);
  });

  it('returns 1 for a Monday date id', () => {
    expect(dayOfWeek('2026-07-20')).toBe(1);
  });
});

describe('dayOfMonth', () => {
  it('returns the day-of-month number for a date id', () => {
    expect(dayOfMonth('2026-07-20')).toBe(20);
  });

  it('returns single-digit days without padding', () => {
    expect(dayOfMonth('2026-07-05')).toBe(5);
  });
});

describe('daysInMonth', () => {
  it('returns 31 for a 31-day month', () => {
    expect(daysInMonth('2026-07-05')).toBe(31);
  });

  it('returns 30 for a 30-day month', () => {
    expect(daysInMonth('2026-04-05')).toBe(30);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth('2026-02-10')).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth('2024-02-10')).toBe(29);
  });
});

describe('weekId', () => {
  it('returns the same date when given a Sunday', () => {
    expect(weekId('2026-07-19')).toBe('2026-07-19');
  });

  it('returns the preceding Sunday for a mid-week date', () => {
    expect(weekId('2026-07-22')).toBe('2026-07-19');
  });

  it('returns the preceding Sunday even when it falls in the previous month', () => {
    expect(weekId('2026-08-01')).toBe('2026-07-26');
  });
});
