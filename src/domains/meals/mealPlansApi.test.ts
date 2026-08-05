import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MealPlan } from '../shared/types';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listMealPlans, saveMealPlan, deleteMealPlan, isMealPlanDueToday } from './mealPlansApi';

describe('isMealPlanDueToday', () => {
  it('is always due for daily plans', () => {
    const plan: MealPlan = { id: 'm1', name: 'Oatmeal', meal: 'breakfast', cadence: 'daily' };
    expect(isMealPlanDueToday(plan, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const plan: MealPlan = {
      id: 'm2',
      name: 'Grilled chicken',
      meal: 'dinner',
      cadence: 'weekly',
      weeklyDays: [2, 4],
    };
    expect(isMealPlanDueToday(plan, 2)).toBe(true);
    expect(isMealPlanDueToday(plan, 3)).toBe(false);
  });
});

describe('mealPlansApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listMealPlans maps Firestore docs to MealPlan objects, defaulting points/currentStreak', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'm1',
          data: () => ({ name: 'Grilled chicken', meal: 'dinner', cadence: 'weekly', weeklyDays: [2, 4] }),
        },
      ],
    });
    const result = await listMealPlans('user1');
    expect(result).toEqual([
      {
        id: 'm1',
        name: 'Grilled chicken',
        meal: 'dinner',
        cadence: 'weekly',
        weeklyDays: [2, 4],
        points: 0,
        currentStreak: 0,
      },
    ]);
  });

  it('saveMealPlan writes the plan fields', async () => {
    const plan: MealPlan = {
      id: 'm1',
      name: 'Grilled chicken',
      meal: 'dinner',
      cadence: 'weekly',
      weeklyDays: [2, 4],
    };
    await saveMealPlan('user1', plan);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Grilled chicken',
      meal: 'dinner',
      cadence: 'weekly',
      weeklyDays: [2, 4],
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteMealPlan removes the plan doc', async () => {
    await deleteMealPlan('user1', 'm1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
