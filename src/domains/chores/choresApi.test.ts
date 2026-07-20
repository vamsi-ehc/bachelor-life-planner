import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChoreConfig } from '../shared/types';

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

import { listChores, saveChore, deleteChore, isChoreDueToday } from './choresApi';

describe('isChoreDueToday', () => {
  it('is always due for daily chores', () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    expect(isChoreDueToday(chore, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const chore: ChoreConfig = { id: 'c2', name: 'Laundry', cadence: 'weekly', weeklyDays: [0, 3] };
    expect(isChoreDueToday(chore, 3)).toBe(true);
    expect(isChoreDueToday(chore, 1)).toBe(false);
  });

  it('is not due for weekly chores with no matching days configured', () => {
    const chore: ChoreConfig = { id: 'c3', name: 'Trash', cadence: 'weekly' };
    expect(isChoreDueToday(chore, 3)).toBe(false);
  });
});

describe('choresApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listChores maps Firestore docs to ChoreConfig objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'c1', data: () => ({ name: 'Dishes', cadence: 'daily', weeklyDays: null }) }],
    });
    const result = await listChores('user1');
    expect(result).toEqual([{ id: 'c1', name: 'Dishes', cadence: 'daily', weeklyDays: null }]);
  });

  it('saveChore writes the chore fields', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    await saveChore('user1', chore);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Dishes',
      cadence: 'daily',
      weeklyDays: null,
    });
  });

  it('deleteChore removes the chore doc', async () => {
    await deleteChore('user1', 'c1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
