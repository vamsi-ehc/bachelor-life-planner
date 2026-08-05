import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetCompletion = vi.fn();
const mockSetLearningDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue('entry1');
const mockListLearningPlans = vi.fn();
const mockSaveLearningPlan = vi.fn().mockResolvedValue(undefined);
const mockDeleteLearningPlan = vi.fn().mockResolvedValue(undefined);

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setLearningDone: (...args: [string, boolean]) => mockSetLearningDone(...args),
}));
vi.mock('./learningApi', () => ({
  listLearningLogEntries: (...args: [string]) => mockListEntries(...args),
  addLearningLogEntry: (...args: [string, unknown]) => mockAddEntry(...args),
}));
vi.mock('./learningPlansApi', async () => {
  const actual = await vi.importActual<typeof import('./learningPlansApi')>('./learningPlansApi');
  return {
    ...actual,
    listLearningPlans: (...args: [string]) => mockListLearningPlans(...args),
    saveLearningPlan: (...args: [string, unknown]) => mockSaveLearningPlan(...args),
    deleteLearningPlan: (...args: [string, string]) => mockDeleteLearningPlan(...args),
  };
});
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { LearningScreen } from './LearningScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <LearningScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('LearningScreen', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockSetLearningDone.mockClear();
    mockListEntries.mockReset();
    mockAddEntry.mockClear().mockResolvedValue('entry1');
    mockListLearningPlans.mockReset().mockResolvedValue([]);
    mockSaveLearningPlan.mockClear();
    mockDeleteLearningPlan.mockClear();
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetLearningDone).toHaveBeenCalledWith('user1', true);
  });

  it('adds a note entry', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you study?'), 'Read chapter 3');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddEntry).toHaveBeenCalledWith('user1', expect.objectContaining({ note: 'Read chapter 3' }));
  });

  it('shows an error message instead of hanging when loading fails', async () => {
    mockGetCompletion.mockRejectedValue(new Error('offline'));
    mockListEntries.mockResolvedValue([]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong: offline')).toBeInTheDocument()
    );
  });

  it('adds a new learning plan with weekday repeat', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);
    mockListLearningPlans.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListLearningPlans).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Topic (e.g. Spanish)'), 'Spanish');
    await user.selectOptions(screen.getByDisplayValue('Daily'), 'weekly');
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: 'Add plan' }));

    expect(mockSaveLearningPlan).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ topic: 'Spanish', cadence: 'weekly', weeklyDays: [3] })
    );
  });

  it('shows a due-today badge for a plan scheduled today and awards a streak when an entry is logged', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);
    mockListLearningPlans.mockResolvedValue([
      { id: 'l1', topic: 'Spanish', cadence: 'daily', points: 0, currentStreak: 0 },
    ]);

    renderScreen();
    await waitFor(() => expect(screen.getByText(/Spanish/)).toBeInTheDocument());
    expect(screen.getByText('Due today')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you study?'), 'Read chapter 3');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    await waitFor(() =>
      expect(mockSaveLearningPlan).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ id: 'l1', points: 1, currentStreak: 1 })
      )
    );
  });
});
