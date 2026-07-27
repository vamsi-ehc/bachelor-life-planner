import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListGoals = vi.fn();
const mockSaveGoal = vi.fn().mockResolvedValue(undefined);
const mockGetWeeklyReview = vi.fn();
const mockSaveWeeklyReview = vi.fn().mockResolvedValue(undefined);

vi.mock('./goalsApi', () => ({
  listGoals: (...args: [string]) => mockListGoals(...args),
  saveGoal: (...args: [string, unknown]) => mockSaveGoal(...args),
}));
vi.mock('./weeklyReviewApi', () => ({
  getWeeklyReview: (...args: [string, string]) => mockGetWeeklyReview(...args),
  saveWeeklyReview: (...args: [string, unknown]) => mockSaveWeeklyReview(...args),
}));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { GoalsScreen } from './GoalsScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <GoalsScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('GoalsScreen', () => {
  beforeEach(() => {
    mockListGoals.mockReset();
    mockSaveGoal.mockClear();
    mockGetWeeklyReview.mockReset();
    mockSaveWeeklyReview.mockClear();
  });

  it('adds a new goal with comma-separated milestones', async () => {
    mockListGoals.mockResolvedValue([]);
    mockGetWeeklyReview.mockResolvedValue(null);

    renderScreen();
    await waitFor(() => expect(mockListGoals).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Goal title'), 'Run a 10k');
    await user.type(screen.getByPlaceholderText('Target date'), '2026-12-01');
    await user.type(screen.getByPlaceholderText('Milestones (comma separated)'), 'Run 5k, Run 8k');
    await user.click(screen.getByRole('button', { name: 'Add goal' }));

    expect(mockSaveGoal).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [
          expect.objectContaining({ label: 'Run 5k', done: false }),
          expect.objectContaining({ label: 'Run 8k', done: false }),
        ],
      })
    );
  });

  it('toggles a milestone done and persists the whole goal', async () => {
    mockListGoals.mockResolvedValue([
      {
        id: 'g1',
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [{ id: 'm1', label: 'Run 5k', done: false }],
      },
    ]);
    mockGetWeeklyReview.mockResolvedValue(null);

    renderScreen();
    await waitFor(() => expect(screen.getByText('Run 5k')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Run 5k' }));

    expect(mockSaveGoal).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        id: 'g1',
        milestones: [expect.objectContaining({ label: 'Run 5k', done: true })],
      })
    );
  });

  it('submits the weekly review', async () => {
    mockListGoals.mockResolvedValue([]);
    mockGetWeeklyReview.mockResolvedValue(null);

    renderScreen();
    await waitFor(() => expect(mockGetWeeklyReview).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What went well?'), 'Consistent workouts');
    await user.type(screen.getByPlaceholderText("What didn't go well?"), 'Missed a chore day');
    await user.type(screen.getByPlaceholderText('Focus for next week'), 'Sleep earlier');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(mockSaveWeeklyReview).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        wentWell: 'Consistent workouts',
        wentBadly: 'Missed a chore day',
        focusNext: 'Sleep earlier',
      })
    );
  });
});
