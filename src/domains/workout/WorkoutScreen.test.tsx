import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetCompletion = vi.fn();
const mockSetWorkoutDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue('entry1');

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setWorkoutDone: (...args: [string, boolean]) => mockSetWorkoutDone(...args),
}));
vi.mock('./workoutApi', () => ({
  listWorkoutLogEntries: (...args: [string]) => mockListEntries(...args),
  addWorkoutLogEntry: (...args: [string, unknown]) => mockAddEntry(...args),
}));

import { WorkoutScreen } from './WorkoutScreen';

describe('WorkoutScreen', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockSetWorkoutDone.mockClear();
    mockListEntries.mockReset();
    mockAddEntry.mockClear();
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<WorkoutScreen uid="user1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetWorkoutDone).toHaveBeenCalledWith('user1', true);
  });

  it('adds a log entry', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<WorkoutScreen uid="user1" />);
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Exercise'), 'Squats');
    await user.type(screen.getByPlaceholderText('Detail (e.g. 3x10 or 30 min)'), '3x10');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddEntry).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ exercise: 'Squats', detail: '3x10' })
    );
  });
});
