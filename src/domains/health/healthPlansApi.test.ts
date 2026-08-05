import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthPlan } from '../shared/types';

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

import { listHealthPlans, saveHealthPlan, deleteHealthPlan, isHealthPlanDueToday } from './healthPlansApi';

describe('isHealthPlanDueToday', () => {
  it('is always due for daily plans', () => {
    const plan: HealthPlan = { id: 'h1', label: 'Weigh-in', cadence: 'daily' };
    expect(isHealthPlanDueToday(plan, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const plan: HealthPlan = { id: 'h2', label: 'Weigh-in', cadence: 'weekly', weeklyDays: [1, 4] };
    expect(isHealthPlanDueToday(plan, 1)).toBe(true);
    expect(isHealthPlanDueToday(plan, 2)).toBe(false);
  });
});

describe('healthPlansApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listHealthPlans maps Firestore docs to HealthPlan objects, defaulting points/currentStreak', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'h1', data: () => ({ label: 'Weigh-in', cadence: 'weekly', weeklyDays: [1, 4] }) }],
    });
    const result = await listHealthPlans('user1');
    expect(result).toEqual([
      { id: 'h1', label: 'Weigh-in', cadence: 'weekly', weeklyDays: [1, 4], points: 0, currentStreak: 0 },
    ]);
  });

  it('saveHealthPlan writes the plan fields', async () => {
    const plan: HealthPlan = { id: 'h1', label: 'Weigh-in', cadence: 'weekly', weeklyDays: [1, 4] };
    await saveHealthPlan('user1', plan);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      label: 'Weigh-in',
      cadence: 'weekly',
      weeklyDays: [1, 4],
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteHealthPlan removes the plan doc', async () => {
    await deleteHealthPlan('user1', 'h1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
