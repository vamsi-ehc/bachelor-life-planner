import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Goal } from '../shared/types';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockDeleteDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listGoals, saveGoal, deleteGoal } from './goalsApi';

describe('goalsApi', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listGoals maps docs to Goal objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'g1',
          data: () => ({
            title: 'Run a 10k',
            targetDate: '2026-12-01',
            status: 'active',
            milestones: [{ id: 'm1', label: 'Run 5k', done: true }],
          }),
        },
      ],
    });
    const result = await listGoals('user1');
    expect(result).toEqual([
      {
        id: 'g1',
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [{ id: 'm1', label: 'Run 5k', done: true }],
      },
    ]);
  });

  it('defaults missing/malformed fields on read', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ status: 'bogus' }) }],
    });
    const result = await listGoals('user1');
    expect(result).toEqual([
      { id: 'g1', title: '', targetDate: '', status: 'active', milestones: [] },
    ]);
  });

  it('defaults a non-array milestones field to an empty array', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ title: 'X', milestones: 'not-an-array' }) }],
    });
    const result = await listGoals('user1');
    expect(result[0].milestones).toEqual([]);
  });

  it('saveGoal writes the goal fields', async () => {
    const goal: Goal = {
      id: 'g1',
      title: 'Run a 10k',
      targetDate: '2026-12-01',
      status: 'active',
      milestones: [],
    };
    await saveGoal('user1', goal);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      title: 'Run a 10k',
      targetDate: '2026-12-01',
      status: 'active',
      milestones: [],
    });
  });

  it('deleteGoal removes the goal doc', async () => {
    await deleteGoal('user1', 'g1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
