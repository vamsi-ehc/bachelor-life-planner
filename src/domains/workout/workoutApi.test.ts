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

import { addWorkoutSession, listWorkoutLogEntries } from './workoutApi';

describe('workoutApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addWorkoutSession writes the session and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'session1' });
    const session = {
      date: '2026-08-05',
      moduleName: 'Chest Workout',
      exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
    };
    const id = await addWorkoutSession('user1', session);
    expect(id).toBe('session1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('listWorkoutLogEntries maps a structured session doc to a WorkoutSession object', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'session1',
          data: () => ({
            date: '2026-08-05',
            moduleName: 'Chest Workout',
            exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
          }),
        },
      ],
    });
    const result = await listWorkoutLogEntries('user1');
    expect(result).toEqual([
      {
        id: 'session1',
        date: '2026-08-05',
        moduleName: 'Chest Workout',
        exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
      },
    ]);
  });

  it('listWorkoutLogEntries still maps a legacy exercise/detail doc unchanged', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'entry1', data: () => ({ date: '2026-07-20', exercise: 'Squats', detail: '3x10' }) }],
    });
    const result = await listWorkoutLogEntries('user1');
    expect(result).toEqual([{ id: 'entry1', date: '2026-07-20', exercise: 'Squats', detail: '3x10' }]);
  });
});
