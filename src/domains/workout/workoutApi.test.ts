import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addWorkoutLogEntry, listWorkoutLogEntries } from './workoutApi';

describe('workoutApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addWorkoutLogEntry writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'entry1' });
    const id = await addWorkoutLogEntry('user1', {
      date: '2026-07-20',
      exercise: 'Squats',
      detail: '3x10',
    });
    expect(id).toBe('entry1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      exercise: 'Squats',
      detail: '3x10',
    });
  });

  it('listWorkoutLogEntries maps docs to WorkoutLogEntry objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'entry1', data: () => ({ date: '2026-07-20', exercise: 'Squats', detail: '3x10' }) }],
    });
    const result = await listWorkoutLogEntries('user1');
    expect(result).toEqual([{ id: 'entry1', date: '2026-07-20', exercise: 'Squats', detail: '3x10' }]);
  });
});
