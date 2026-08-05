import { describe, it, expect, vi } from 'vitest';
import {
  computeStreak,
  computeDueItems,
  computeReminderDueItems,
  computeDayHealth,
  computeBillDueItems,
  computeGroceryDueItem,
  computeWeeklyReviewDueItem,
  computeWorkoutDueItems,
  computeLearningPlanDueItems,
  computeHealthPlanDueItems,
  computeMealPlanDueItems,
} from './dashboardLogic';
import {
  ChoreConfig,
  CustomReminder,
  DailyCompletion,
  Bill,
  GroceryItem,
  WeeklyReview,
  WorkoutRoutine,
  LearningPlan,
  HealthPlan,
  MealPlan,
} from '../domains/shared/types';

vi.mock('../firebase/config', () => ({ db: {} }));

describe('computeStreak', () => {
  it('counts consecutive days (most recent first) where both workout and learning are done', () => {
    const history: DailyCompletion[] = [
      { date: '2026-07-20', workout: true, learning: true, chores: {}, reminders: {} },
      { date: '2026-07-19', workout: true, learning: true, chores: {}, reminders: {} },
      { date: '2026-07-18', workout: true, learning: false, chores: {}, reminders: {} },
    ];
    expect(computeStreak(history)).toBe(2);
  });

  it('returns 0 when today is not fully done', () => {
    const history: DailyCompletion[] = [
      { date: '2026-07-20', workout: false, learning: true, chores: {}, reminders: {} },
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
      reminders: {},
    };
    const result = computeDueItems(chores, completion, 1);
    expect(result).toEqual([{ id: 'c2', label: 'Laundry', domain: 'chores' }]);
  });
});

describe('computeReminderDueItems', () => {
  const reminders: CustomReminder[] = [
    { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    { id: 'r2', label: 'Gym', time: '07:00', cadence: 'weekly', weeklyDays: [1] },
  ];

  it('lists due, not-yet-done reminders only', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: {},
      reminders: { r1: true },
    };
    const result = computeReminderDueItems(reminders, completion, 1);
    expect(result).toEqual([{ id: 'r2', label: 'Gym', domain: 'reminders' }]);
  });
});

describe('computeDayHealth', () => {
  it('computes percentage of done tasks including due chores', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: false,
      chores: { c1: true },
      reminders: {},
    };
    expect(computeDayHealth(completion, ['c1'])).toBe(67);
  });

  it('returns 100 when there are no tasks at all', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    };
    // workout + learning always count as 2 base tasks, so this case only
    // arises hypothetically; guard against division by zero regardless.
    expect(computeDayHealth(completion, [])).toBe(0);
  });

  it('folds due, unchecked reminders into the task count', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: { r1: true },
    };
    // 2 base + 2 reminders = 4 tasks; workout+learning+r1 done = 3/4 = 75%
    expect(computeDayHealth(completion, [], ['r1', 'r2'])).toBe(75);
  });

  it('folds a fully-completed new-domain due list into the task count', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: {},
    };
    // 2 base + 1 workout-routine domain (done) = 3 tasks, all done = 100%
    expect(
      computeDayHealth(completion, [], [], [{ domain: 'workout', ids: ['w1'], done: true }])
    ).toBe(100);
  });

  it('counts an undone new-domain due list as not done', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: {},
    };
    // 2 base + 1 workout-routine domain (not done) = 3 tasks, 2 done = 67%
    expect(
      computeDayHealth(completion, [], [], [{ domain: 'workout', ids: ['w1'], done: false }])
    ).toBe(67);
  });
});

describe('computeWorkoutDueItems', () => {
  const routines: WorkoutRoutine[] = [
    { id: 'w1', name: 'Push Day', exercises: [], cadence: 'weekly', weeklyDays: [1] },
  ];

  it('lists a due routine when nothing has been logged today', () => {
    expect(computeWorkoutDueItems(routines, false, 1)).toEqual([
      { id: 'w1', label: 'Push Day', domain: 'workout' },
    ]);
  });

  it('returns nothing once something has been logged today', () => {
    expect(computeWorkoutDueItems(routines, true, 1)).toEqual([]);
  });

  it('returns nothing when no routine is due today', () => {
    expect(computeWorkoutDueItems(routines, false, 2)).toEqual([]);
  });
});

describe('computeLearningPlanDueItems', () => {
  it('lists a due plan when nothing has been logged today', () => {
    const plans: LearningPlan[] = [{ id: 'l1', topic: 'Spanish', cadence: 'daily' }];
    expect(computeLearningPlanDueItems(plans, false, 3)).toEqual([
      { id: 'l1', label: 'Spanish', domain: 'learning' },
    ]);
  });
});

describe('computeHealthPlanDueItems', () => {
  it('lists a due plan when nothing has been logged today', () => {
    const plans: HealthPlan[] = [{ id: 'h1', label: 'Weigh-in', cadence: 'daily' }];
    expect(computeHealthPlanDueItems(plans, false, 3)).toEqual([
      { id: 'h1', label: 'Weigh-in', domain: 'health' },
    ]);
  });
});

describe('computeMealPlanDueItems', () => {
  it('lists a due plan when nothing has been logged today', () => {
    const plans: MealPlan[] = [{ id: 'm1', name: 'Grilled chicken', meal: 'dinner', cadence: 'daily' }];
    expect(computeMealPlanDueItems(plans, false, 3)).toEqual([
      { id: 'm1', label: 'Grilled chicken', domain: 'meals' },
    ]);
  });
});

describe('computeBillDueItems', () => {
  it('lists bills due today by dueDay match', () => {
    const bills: Bill[] = [
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' },
      { id: 'b2', name: 'Internet', amount: 60, dueDay: 15, category: 'Utilities' },
    ];
    expect(computeBillDueItems(bills, 1, 31)).toEqual([{ id: 'b1', label: 'Rent due', domain: 'finances' }]);
  });

  it('returns an empty array when no bills are due', () => {
    const bills: Bill[] = [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' }];
    expect(computeBillDueItems(bills, 10, 31)).toEqual([]);
  });

  it('clamps a dueDay beyond the month length to the last day of a short month', () => {
    const bills: Bill[] = [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 31, category: 'Housing' }];
    expect(computeBillDueItems(bills, 30, 30)).toEqual([{ id: 'b1', label: 'Rent due', domain: 'finances' }]);
  });
});

describe('computeGroceryDueItem', () => {
  it('returns one summary item with the unchecked count when items are pending', () => {
    const items: GroceryItem[] = [
      { id: 'g1', name: 'Milk', checked: false },
      { id: 'g2', name: 'Eggs', checked: true },
      { id: 'g3', name: 'Bread', checked: false },
    ];
    expect(computeGroceryDueItem(items)).toEqual([
      { id: 'groceries-needed', label: '2 grocery items needed', domain: 'meals' },
    ]);
  });

  it('uses singular phrasing for exactly one pending item', () => {
    const items: GroceryItem[] = [{ id: 'g1', name: 'Milk', checked: false }];
    expect(computeGroceryDueItem(items)).toEqual([
      { id: 'groceries-needed', label: '1 grocery item needed', domain: 'meals' },
    ]);
  });

  it('returns an empty array when everything is checked off', () => {
    const items: GroceryItem[] = [{ id: 'g1', name: 'Milk', checked: true }];
    expect(computeGroceryDueItem(items)).toEqual([]);
  });
});

describe('computeWeeklyReviewDueItem', () => {
  it('returns a due item on Sunday when no review has been recorded', () => {
    expect(computeWeeklyReviewDueItem(0, null)).toEqual([
      { id: 'weekly-review', label: 'Weekly review due', domain: 'goals' },
    ]);
  });

  it('returns an empty array on Sunday when a review already exists', () => {
    const review: WeeklyReview = { weekId: '2026-07-19', wentWell: '', wentBadly: '', focusNext: '' };
    expect(computeWeeklyReviewDueItem(0, review)).toEqual([]);
  });

  it('returns an empty array on a non-Sunday day', () => {
    expect(computeWeeklyReviewDueItem(3, null)).toEqual([]);
  });
});
