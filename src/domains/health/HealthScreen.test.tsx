import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetSleepLog = vi.fn();
const mockSaveSleepLog = vi.fn().mockResolvedValue(undefined);
const mockListWeightEntries = vi.fn();
const mockAddWeightEntry = vi.fn().mockResolvedValue('w1');
const mockListHealthPlans = vi.fn();
const mockSaveHealthPlan = vi.fn().mockResolvedValue(undefined);
const mockDeleteHealthPlan = vi.fn().mockResolvedValue(undefined);

vi.mock('./sleepApi', () => ({
  getSleepLog: (...args: [string]) => mockGetSleepLog(...args),
  saveSleepLog: (...args: [string, unknown]) => mockSaveSleepLog(...args),
}));
vi.mock('./weightApi', () => ({
  listWeightEntries: (...args: [string]) => mockListWeightEntries(...args),
  addWeightEntry: (...args: [string, unknown]) => mockAddWeightEntry(...args),
}));
vi.mock('./healthPlansApi', async () => {
  const actual = await vi.importActual<typeof import('./healthPlansApi')>('./healthPlansApi');
  return {
    ...actual,
    listHealthPlans: (...args: [string]) => mockListHealthPlans(...args),
    saveHealthPlan: (...args: [string, unknown]) => mockSaveHealthPlan(...args),
    deleteHealthPlan: (...args: [string, string]) => mockDeleteHealthPlan(...args),
  };
});
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { HealthScreen } from './HealthScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <HealthScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('HealthScreen', () => {
  beforeEach(() => {
    mockGetSleepLog.mockReset();
    mockSaveSleepLog.mockClear();
    mockListWeightEntries.mockReset();
    mockAddWeightEntry.mockClear().mockResolvedValue('w1');
    mockListHealthPlans.mockReset().mockResolvedValue([]);
    mockSaveHealthPlan.mockClear();
    mockDeleteHealthPlan.mockClear();
  });

  it('saves bedtime and wake time', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockGetSleepLog).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Bedtime'), '23:00');
    await user.type(screen.getByLabelText('Wake time'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save sleep' }));

    expect(mockSaveSleepLog).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ bedtime: '23:00', wakeTime: '07:00' })
    );
  });

  it('shows the computed sleep duration when a log already has both times', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' });
    mockListWeightEntries.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('8h slept')).toBeInTheDocument());
  });

  it('adds a weight entry', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListWeightEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '70');
    await user.click(screen.getByRole('button', { name: 'Log weight' }));

    expect(mockAddWeightEntry).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ weightKg: 70 })
    );
  });

  it('adds a new health plan with weekday repeat', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);
    mockListHealthPlans.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListHealthPlans).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Check-in label (e.g. Weigh-in)'), 'Weigh-in');
    await user.selectOptions(screen.getByDisplayValue('Daily'), 'weekly');
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: 'Add plan' }));

    expect(mockSaveHealthPlan).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ label: 'Weigh-in', cadence: 'weekly', weeklyDays: [3] })
    );
  });

  it('shows a due-today badge for a plan scheduled today and awards a streak when a weight entry is logged', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);
    mockListHealthPlans.mockResolvedValue([
      { id: 'h1', label: 'Weigh-in', cadence: 'daily', points: 0, currentStreak: 0 },
    ]);

    renderScreen();
    await waitFor(() => expect(screen.getByText(/Weigh-in/)).toBeInTheDocument());
    expect(screen.getByText('Due today')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '70');
    await user.click(screen.getByRole('button', { name: 'Log weight' }));

    await waitFor(() =>
      expect(mockSaveHealthPlan).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ id: 'h1', points: 1, currentStreak: 1 })
      )
    );
  });
});
