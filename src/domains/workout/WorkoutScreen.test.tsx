import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetCompletion = vi.fn();
const mockSetWorkoutDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddSession = vi.fn().mockResolvedValue('session1');
const mockListWorkoutRoutines = vi.fn();
const mockSaveWorkoutRoutine = vi.fn().mockResolvedValue(undefined);
const mockDeleteWorkoutRoutine = vi.fn().mockResolvedValue(undefined);

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setWorkoutDone: (...args: [string, boolean]) => mockSetWorkoutDone(...args),
}));
vi.mock('./workoutApi', () => ({
  listWorkoutLogEntries: (...args: [string]) => mockListEntries(...args),
  addWorkoutSession: (...args: [string, unknown]) => mockAddSession(...args),
}));
vi.mock('./workoutRoutinesApi', async () => {
  const actual = await vi.importActual<typeof import('./workoutRoutinesApi')>('./workoutRoutinesApi');
  return {
    ...actual,
    listWorkoutRoutines: (...args: [string]) => mockListWorkoutRoutines(...args),
    saveWorkoutRoutine: (...args: [string, unknown]) => mockSaveWorkoutRoutine(...args),
    deleteWorkoutRoutine: (...args: [string, string]) => mockDeleteWorkoutRoutine(...args),
  };
});
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { WorkoutScreen } from './WorkoutScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <WorkoutScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('WorkoutScreen', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockSetWorkoutDone.mockClear();
    mockListEntries.mockReset();
    mockAddSession.mockClear().mockResolvedValue('session1');
    mockListWorkoutRoutines.mockReset().mockResolvedValue([]);
    mockSaveWorkoutRoutine.mockClear();
    mockDeleteWorkoutRoutine.mockClear();
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetWorkoutDone).toHaveBeenCalledWith('user1', true);
  });

  it('builds and saves a structured workout session', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Workout name (e.g. Chest Workout)'), 'Chest Workout');
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.type(screen.getByPlaceholderText('Reps'), '12');
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '40');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getAllByPlaceholderText('Reps')[1], '10');
    await user.type(screen.getAllByPlaceholderText('Weight (kg)')[1], '45');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(mockAddSession).toHaveBeenCalledWith('user1', {
      date: '2026-08-05',
      moduleName: 'Chest Workout',
      exercises: [
        {
          id: expect.any(String),
          name: 'Bench Press',
          sets: [
            { reps: 12, weightKg: 40 },
            { reps: 10, weightKg: 45 },
          ],
        },
      ],
    });

    expect(await screen.findByText('Chest Workout')).toBeInTheDocument();
    expect(screen.getByText('Set 1 – 12 reps – 40 kg')).toBeInTheDocument();
    expect(screen.getByText('Set 2 – 10 reps – 45 kg')).toBeInTheDocument();
  });

  it('adds a second exercise block when Add exercise is clicked', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    expect(screen.getAllByPlaceholderText('Exercise name')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getAllByPlaceholderText('Exercise name')).toHaveLength(2);
  });

  it('shows a validation error and does not save when the workout name is missing', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.type(screen.getByPlaceholderText('Reps'), '12');
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '40');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(await screen.findByText(/Enter a workout name/)).toBeInTheDocument();
    expect(mockAddSession).not.toHaveBeenCalled();
  });

  it('shows a validation error when an exercise has no valid sets', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Workout name (e.g. Chest Workout)'), 'Chest Workout');
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(await screen.findByText(/at least one set with reps/)).toBeInTheDocument();
    expect(mockAddSession).not.toHaveBeenCalled();
  });

  it('renders a legacy entry using the old date — exercise (detail) format', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([
      { id: 'legacy1', date: '2026-07-20', exercise: 'Squats', detail: '3x10' },
    ]);

    renderScreen();

    expect(await screen.findByText(/Squats \(3x10\)/)).toBeInTheDocument();
  });

  it('renders a structured session entry grouped by exercise and set', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([
      {
        id: 'session1',
        date: '2026-08-04',
        moduleName: 'Leg Day',
        exercises: [{ id: 'e1', name: 'Squats', sets: [{ reps: 8, weightKg: 60 }] }],
      },
    ]);

    renderScreen();

    expect(await screen.findByText('Leg Day')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText('Set 1 – 8 reps – 60 kg')).toBeInTheDocument();
  });

  it('shows an error message instead of hanging when loading fails', async () => {
    mockGetCompletion.mockRejectedValue(new Error('offline'));
    mockListEntries.mockResolvedValue([]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong: offline')).toBeInTheDocument()
    );
  });

  it('adds a new workout routine with weekday repeat', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);
    mockListWorkoutRoutines.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListWorkoutRoutines).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Routine name (e.g. Push Day)'), 'Push Day');
    await user.selectOptions(screen.getByDisplayValue('Daily'), 'weekly');
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.type(screen.getByPlaceholderText('Routine exercise name'), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add routine' }));

    expect(mockSaveWorkoutRoutine).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        name: 'Push Day',
        cadence: 'weekly',
        weeklyDays: [3],
        exercises: [expect.objectContaining({ name: 'Bench Press' })],
      })
    );
  });

  it('shows a due-today badge for a routine scheduled today and awards a streak when a session is logged', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);
    mockListWorkoutRoutines.mockResolvedValue([
      { id: 'w1', name: 'Push Day', exercises: [{ id: 'e1', name: 'Bench Press' }], cadence: 'daily', points: 0, currentStreak: 0 },
    ]);

    renderScreen();
    await waitFor(() => expect(screen.getByText(/Push Day/)).toBeInTheDocument());
    expect(screen.getByText('Due today')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Workout name (e.g. Chest Workout)'), 'Chest Workout');
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.type(screen.getByPlaceholderText('Reps'), '10');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await waitFor(() =>
      expect(mockSaveWorkoutRoutine).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ id: 'w1', points: 1, currentStreak: 1 })
      )
    );
  });
});
