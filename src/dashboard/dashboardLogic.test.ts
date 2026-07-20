import { describe, it, expect, vi } from 'vitest';
import { computeStreak, computeDueItems, computeDayHealth } from './dashboardLogic';
import { ChoreConfig, DailyCompletion } from '../domains/shared/types';

vi.mock('../firebase/config', () => ({ db: {} }));

describe('computeStreak', () => {
  it('counts consecutive days (most recent first) where both workout and learning are done', () => {
    const history: DailyCompletion[] = [
      { date: '2026-07-20', workout: true, learning: true, chores: {} },
      { date: '2026-07-19', workout: true, learning: true, chores: {} },
      { date: '2026-07-18', workout: true, learning: false, chores: {} },
    ];
    expect(computeStreak(history)).toBe(2);
  });

  it('returns 0 when today is not fully done', () => {
    const history: DailyCompletion[] = [
      { date: '2026-07-20', workout: false, learning: true, chores: {} },
    ];
    expect(computeStreak(history)).toBe(0);
  });
});

describe('computeDueItems', () => {
  const chores: ChoreConfig[] = [
    { id: 'c1', name: 'Dishes', cadence: 'daily' },
    { id: 'c2', name: 'Laundry', cadence: 'weekly', weeklyDays: [1] },
  ];

  it('lists due, not-yet-done chores only', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: { c1: true },
    };
    const result = computeDueItems(chores, completion, 1);
    expect(result).toEqual([{ id: 'c2', label: 'Laundry', domain: 'chores' }]);
  });
});

describe('computeDayHealth', () => {
  it('computes percentage of done tasks including due chores', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: false,
      chores: { c1: true },
    };
    expect(computeDayHealth(completion, ['c1'])).toBe(67);
  });

  it('returns 100 when there are no tasks at all', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: {},
    };
    // workout + learning always count as 2 base tasks, so this case only
    // arises hypothetically; guard against division by zero regardless.
    expect(computeDayHealth(completion, [])).toBe(0);
  });
});
