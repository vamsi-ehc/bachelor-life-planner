import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LearningPlan } from '../shared/types';

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

import { listLearningPlans, saveLearningPlan, deleteLearningPlan, isLearningPlanDueToday } from './learningPlansApi';

describe('isLearningPlanDueToday', () => {
  it('is always due for daily plans', () => {
    const plan: LearningPlan = { id: 'l1', topic: 'Spanish', cadence: 'daily' };
    expect(isLearningPlanDueToday(plan, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const plan: LearningPlan = { id: 'l2', topic: 'Guitar', cadence: 'weekly', weeklyDays: [1, 3, 5] };
    expect(isLearningPlanDueToday(plan, 3)).toBe(true);
    expect(isLearningPlanDueToday(plan, 2)).toBe(false);
  });
});

describe('learningPlansApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listLearningPlans maps Firestore docs to LearningPlan objects, defaulting points/currentStreak', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'l1', data: () => ({ topic: 'Spanish', cadence: 'weekly', weeklyDays: [1, 3, 5] }) }],
    });
    const result = await listLearningPlans('user1');
    expect(result).toEqual([
      { id: 'l1', topic: 'Spanish', cadence: 'weekly', weeklyDays: [1, 3, 5], points: 0, currentStreak: 0 },
    ]);
  });

  it('saveLearningPlan writes the plan fields', async () => {
    const plan: LearningPlan = { id: 'l1', topic: 'Spanish', cadence: 'weekly', weeklyDays: [1, 3, 5] };
    await saveLearningPlan('user1', plan);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      topic: 'Spanish',
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteLearningPlan removes the plan doc', async () => {
    await deleteLearningPlan('user1', 'l1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
