import { describe, it, expect } from 'vitest';
import { isLegacyWorkoutEntry, WorkoutLogEntry } from './types';

describe('isLegacyWorkoutEntry', () => {
  it('returns true for a legacy exercise/detail entry', () => {
    const entry: WorkoutLogEntry = { id: '1', date: '2026-08-05', exercise: 'Squats', detail: '3x10' };
    expect(isLegacyWorkoutEntry(entry)).toBe(true);
  });

  it('returns false for a structured session entry', () => {
    const entry: WorkoutLogEntry = {
      id: '2',
      date: '2026-08-05',
      moduleName: 'Chest Workout',
      exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
    };
    expect(isLegacyWorkoutEntry(entry)).toBe(false);
  });
});
