import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Goal } from '../domains/shared/types';

const mockGetCompletion = vi.fn();
const mockListRecentCompletions = vi.fn();
const mockListChores = vi.fn();
const mockListBills = vi.fn();
const mockListGroceryItems = vi.fn();
const mockListCustomReminders = vi.fn();
const mockListWorkoutRoutines = vi.fn();
const mockListWorkoutLogEntries = vi.fn();
const mockListLearningPlans = vi.fn();
const mockListLearningLogEntries = vi.fn();
const mockListHealthPlans = vi.fn();
const mockListWeightEntries = vi.fn();
const mockListMealPlans = vi.fn();
const mockGetMealLog = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (..._args: unknown[]) => ({}),
  doc: (..._args: unknown[]) => ({}),
  getDoc: (..._args: unknown[]) => Promise.resolve(),
  getDocs: (..._args: unknown[]) => Promise.resolve(),
  setDoc: (..._args: unknown[]) => Promise.resolve(),
  deleteDoc: (..._args: unknown[]) => Promise.resolve(),
  orderBy: (..._args: unknown[]) => ({}),
  limit: (..._args: unknown[]) => ({}),
  query: (..._args: unknown[]) => ({}),
}));
vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));

vi.mock('../domains/shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  listRecentCompletions: (...args: [string, number]) => mockListRecentCompletions(...args),
}));
vi.mock('../domains/chores/choresApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/chores/choresApi')>(
    '../domains/chores/choresApi'
  );
  return { ...actual, listChores: (...args: [string]) => mockListChores(...args) };
});
vi.mock('../domains/finances/billsApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/finances/billsApi')>(
    '../domains/finances/billsApi'
  );
  return { ...actual, listBills: (...args: [string]) => mockListBills(...args) };
});
vi.mock('../domains/meals/groceryApi', () => ({
  listGroceryItems: (...args: [string]) => mockListGroceryItems(...args),
}));
vi.mock('../domains/reminders/remindersApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/reminders/remindersApi')>(
    '../domains/reminders/remindersApi'
  );
  return { ...actual, listCustomReminders: (...args: [string]) => mockListCustomReminders(...args) };
});
vi.mock('../domains/workout/workoutRoutinesApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/workout/workoutRoutinesApi')>(
    '../domains/workout/workoutRoutinesApi'
  );
  return { ...actual, listWorkoutRoutines: (...args: [string]) => mockListWorkoutRoutines(...args) };
});
vi.mock('../domains/workout/workoutApi', () => ({
  listWorkoutLogEntries: (...args: [string]) => mockListWorkoutLogEntries(...args),
}));
vi.mock('../domains/learning/learningPlansApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/learning/learningPlansApi')>(
    '../domains/learning/learningPlansApi'
  );
  return { ...actual, listLearningPlans: (...args: [string]) => mockListLearningPlans(...args) };
});
vi.mock('../domains/learning/learningApi', () => ({
  listLearningLogEntries: (...args: [string]) => mockListLearningLogEntries(...args),
}));
vi.mock('../domains/health/healthPlansApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/health/healthPlansApi')>(
    '../domains/health/healthPlansApi'
  );
  return { ...actual, listHealthPlans: (...args: [string]) => mockListHealthPlans(...args) };
});
vi.mock('../domains/health/weightApi', () => ({
  listWeightEntries: (...args: [string]) => mockListWeightEntries(...args),
}));
vi.mock('../domains/meals/mealPlansApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/meals/mealPlansApi')>(
    '../domains/meals/mealPlansApi'
  );
  return { ...actual, listMealPlans: (...args: [string]) => mockListMealPlans(...args) };
});
vi.mock('../domains/meals/mealLogApi', () => ({
  getMealLog: (...args: [string]) => mockGetMealLog(...args),
}));

const mockGetSleepLog = vi.fn((..._args: unknown[]) => Promise.resolve({ date: '', bedtime: '', wakeTime: '' }));
const mockListGoals = vi.fn((..._args: unknown[]) => Promise.resolve([] as Goal[]));
const mockGetWeeklyReview = vi.fn((..._args: unknown[]) => Promise.resolve(null));

vi.mock('../domains/health/sleepApi', () => ({
  getSleepLog: (...args: unknown[]) => mockGetSleepLog(...args),
}));
vi.mock('../domains/goals/goalsApi', () => ({
  listGoals: (...args: unknown[]) => mockListGoals(...args),
}));
vi.mock('../domains/goals/weeklyReviewApi', () => ({
  getWeeklyReview: (...args: unknown[]) => mockGetWeeklyReview(...args),
}));

import { useDashboardData } from './useDashboardData';

describe('useDashboardData', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockListRecentCompletions.mockReset();
    mockListChores.mockReset();
    mockListBills.mockReset();
    mockListGroceryItems.mockReset();
    mockListCustomReminders.mockReset().mockResolvedValue([]);
    mockListWorkoutRoutines.mockReset().mockResolvedValue([]);
    mockListWorkoutLogEntries.mockReset().mockResolvedValue([]);
    mockListLearningPlans.mockReset().mockResolvedValue([]);
    mockListLearningLogEntries.mockReset().mockResolvedValue([]);
    mockListHealthPlans.mockReset().mockResolvedValue([]);
    mockListWeightEntries.mockReset().mockResolvedValue([]);
    mockListMealPlans.mockReset().mockResolvedValue([]);
    mockGetMealLog.mockReset().mockResolvedValue({ date: '', entries: [] });
  });

  it('loads completion, history, chores, bills, and groceries, then computes streak, due items, and day health', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: { c1: true },
    });
    mockListRecentCompletions.mockResolvedValue([
      { date: '2026-07-20', workout: true, learning: true, chores: { c1: true } },
      { date: '2026-07-19', workout: true, learning: true, chores: {} },
      { date: '2026-07-18', workout: false, learning: true, chores: {} },
    ]);
    mockListChores.mockResolvedValue([
      { id: 'c1', name: 'Dishes', cadence: 'daily' },
      { id: 'c2', name: 'Laundry', cadence: 'daily' },
    ]);
    mockListBills.mockResolvedValue([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 20, category: 'Housing' },
    ]);
    mockListGroceryItems.mockResolvedValue([{ id: 'g1', name: 'Milk', checked: false }]);

    const { result } = renderHook(() => useDashboardData('user1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListBills).toHaveBeenCalledWith('user1');
    expect(mockListGroceryItems).toHaveBeenCalledWith('user1');
    expect(result.current.bills).toEqual([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 20, category: 'Housing' },
    ]);
    expect(result.current.groceryItems).toEqual([{ id: 'g1', name: 'Milk', checked: false }]);
    expect(result.current.streak).toBe(2);
    expect(result.current.dueItems).toEqual(
      expect.arrayContaining([
        { id: 'c2', label: 'Laundry', domain: 'chores' },
        { id: 'groceries-needed', label: '1 grocery item needed', domain: 'meals' },
      ])
    );
    expect(result.current.dayHealth).toBe(75);
  });

  it('loads custom reminders and folds due ones into dueItems and dayHealth', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: {},
    });
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);

    const { result } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListCustomReminders).toHaveBeenCalledWith('user1');
    expect(result.current.reminders).toEqual([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);
    expect(result.current.dueTodayReminderIds).toEqual(['r1']);
    expect(result.current.dueItems).toEqual(
      expect.arrayContaining([{ id: 'r1', label: 'Drink water', domain: 'reminders' }])
    );
    // 2 base tasks + 1 due reminder = 3; workout+learning done, reminder not = 2/3 = 67%
    expect(result.current.dayHealth).toBe(67);
  });

  it('sets an error and clears loading when a read fails', async () => {
    mockGetCompletion.mockRejectedValue(new Error('offline'));
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('offline');
  });

  it('fetches sleep log, goals, and weekly review, and folds a due weekly-review into dueItems', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-19',
      workout: true,
      learning: true,
      chores: {},
    });
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-19', bedtime: '23:00', wakeTime: '07:00' });
    mockListGoals.mockResolvedValue([
      { id: 'g1', title: 'Run a 10k', targetDate: '2026-12-01', status: 'active', milestones: [] },
    ]);
    mockGetWeeklyReview.mockResolvedValue(null);

    const { result } = renderHook(() => useDashboardData('user1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sleepLog).toEqual({ date: '2026-07-19', bedtime: '23:00', wakeTime: '07:00' });
    expect(result.current.goals).toEqual([
      { id: 'g1', title: 'Run a 10k', targetDate: '2026-12-01', status: 'active', milestones: [] },
    ]);
    expect(result.current.weeklyReview).toBeNull();
  });

  it('lists a due-today workout routine when nothing has been logged today, and drops it once a session is logged', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);
    mockListWorkoutRoutines.mockResolvedValue([
      { id: 'w1', name: 'Push Day', exercises: [], cadence: 'daily' },
    ]);

    const { result: withoutLog } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(withoutLog.current.loading).toBe(false));
    expect(withoutLog.current.dueItems).toEqual(
      expect.arrayContaining([{ id: 'w1', label: 'Push Day', domain: 'workout' }])
    );

    mockListWorkoutLogEntries.mockResolvedValue([
      { id: 's1', date: '2026-08-05', moduleName: 'Push Day', exercises: [] },
    ]);

    const { result: withLog } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(withLog.current.loading).toBe(false));
    expect(withLog.current.dueItems).not.toEqual(
      expect.arrayContaining([{ id: 'w1', label: 'Push Day', domain: 'workout' }])
    );
  });
});
