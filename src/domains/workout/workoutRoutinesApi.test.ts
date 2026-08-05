import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkoutRoutine } from '../shared/types';

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

import {
  listWorkoutRoutines,
  saveWorkoutRoutine,
  deleteWorkoutRoutine,
  isWorkoutRoutineDueToday,
} from './workoutRoutinesApi';

describe('isWorkoutRoutineDueToday', () => {
  it('is always due for daily routines', () => {
    const routine: WorkoutRoutine = { id: 'w1', name: 'Full Body', exercises: [], cadence: 'daily' };
    expect(isWorkoutRoutineDueToday(routine, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const routine: WorkoutRoutine = {
      id: 'w2',
      name: 'Push Day',
      exercises: [],
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
    };
    expect(isWorkoutRoutineDueToday(routine, 3)).toBe(true);
    expect(isWorkoutRoutineDueToday(routine, 2)).toBe(false);
  });
});

describe('workoutRoutinesApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listWorkoutRoutines maps Firestore docs to WorkoutRoutine objects, defaulting points/currentStreak', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'w1',
          data: () => ({
            name: 'Push Day',
            exercises: [{ id: 'e1', name: 'Bench Press' }],
            cadence: 'weekly',
            weeklyDays: [1, 3, 5],
          }),
        },
      ],
    });
    const result = await listWorkoutRoutines('user1');
    expect(result).toEqual([
      {
        id: 'w1',
        name: 'Push Day',
        exercises: [{ id: 'e1', name: 'Bench Press' }],
        cadence: 'weekly',
        weeklyDays: [1, 3, 5],
        points: 0,
        currentStreak: 0,
      },
    ]);
  });

  it('saveWorkoutRoutine writes the routine fields', async () => {
    const routine: WorkoutRoutine = {
      id: 'w1',
      name: 'Push Day',
      exercises: [{ id: 'e1', name: 'Bench Press' }],
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
    };
    await saveWorkoutRoutine('user1', routine);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Push Day',
      exercises: [{ id: 'e1', name: 'Bench Press' }],
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteWorkoutRoutine removes the routine doc', async () => {
    await deleteWorkoutRoutine('user1', 'w1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
