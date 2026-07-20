import { describe, it, expect } from 'vitest';
import { todayId, dayOfWeek } from './dateUtils';

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
