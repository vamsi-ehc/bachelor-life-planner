import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetCompletion = vi.fn();
const mockSetWorkoutDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddSession = vi.fn().mockResolvedValue('session1');

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setWorkoutDone: (...args: [string, boolean]) => mockSetWorkoutDone(...args),
}));
vi.mock('./workoutApi', () => ({
  listWorkoutLogEntries: (...args: [string]) => mockListEntries(...args),
  addWorkoutSession: (...args: [string, unknown]) => mockAddSession(...args),
}));
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
});
