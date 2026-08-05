import { describe, it, expect } from 'vitest';
import { previousDueDateBefore, applyCompletion } from './streakLogic';

describe('previousDueDateBefore', () => {
  it('returns yesterday for a daily cadence', () => {
    expect(previousDueDateBefore('2026-08-05', 'daily')).toBe('2026-08-04');
  });

  it('returns the most recent prior matching weekday for a weekly cadence', () => {
    // 2026-08-05 is a Wednesday (dow 3); the prior Wednesday is 2026-07-29.
    expect(previousDueDateBefore('2026-08-05', 'weekly', [3])).toBe('2026-07-29');
  });

  it('finds the closest prior day among several configured weekdays', () => {
    // Mon/Wed/Fri; closest day before Wed 2026-08-05 is Mon 2026-08-03.
    expect(previousDueDateBefore('2026-08-05', 'weekly', [1, 3, 5])).toBe('2026-08-03');
  });

  it('returns undefined when no weekly days are configured', () => {
    expect(previousDueDateBefore('2026-08-05', 'weekly', [])).toBeUndefined();
  });
});

describe('applyCompletion', () => {
  const dailyItem = { cadence: 'daily' as const, points: 0, currentStreak: 0, lastCompletedDate: undefined };

  it('awards 1 point and starts a streak of 1 on first-ever completion', () => {
    const result = applyCompletion(dailyItem, '2026-08-05');
    expect(result).toEqual({ points: 1, currentStreak: 1, lastCompletedDate: '2026-08-05' });
  });

  it('continues the streak when the previous due day was completed', () => {
    const item = { cadence: 'daily' as const, points: 10, currentStreak: 3, lastCompletedDate: '2026-08-04' };
    const result = applyCompletion(item, '2026-08-05');
    expect(result).toEqual({ points: 11, currentStreak: 4, lastCompletedDate: '2026-08-05' });
  });

  it('resets the streak to 1 when a due day was skipped', () => {
    const item = { cadence: 'daily' as const, points: 10, currentStreak: 5, lastCompletedDate: '2026-08-02' };
    const result = applyCompletion(item, '2026-08-05');
    expect(result).toEqual({ points: 11, currentStreak: 1, lastCompletedDate: '2026-08-05' });
  });

  it('continues a weekly streak across the correct prior weekday', () => {
    const item = {
      cadence: 'weekly' as const,
      weeklyDays: [3],
      points: 2,
      currentStreak: 2,
      lastCompletedDate: '2026-07-29',
    };
    const result = applyCompletion(item, '2026-08-05');
    expect(result).toEqual({ points: 3, currentStreak: 3, lastCompletedDate: '2026-08-05' });
  });

  it('treats missing points/currentStreak as 0', () => {
    const result = applyCompletion({ cadence: 'daily' as const }, '2026-08-05');
    expect(result).toEqual({ points: 1, currentStreak: 1, lastCompletedDate: '2026-08-05' });
  });
});
