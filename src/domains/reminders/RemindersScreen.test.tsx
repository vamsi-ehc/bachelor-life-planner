import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListCustomReminders = vi.fn();
const mockSaveCustomReminder = vi.fn().mockResolvedValue(undefined);
const mockDeleteCustomReminder = vi.fn().mockResolvedValue(undefined);
const mockGetCompletion = vi.fn();
const mockSetReminderDone = vi.fn().mockResolvedValue(undefined);

vi.mock('./remindersApi', async () => {
  const actual = await vi.importActual<typeof import('./remindersApi')>('./remindersApi');
  return {
    ...actual,
    listCustomReminders: (...args: [string]) => mockListCustomReminders(...args),
    saveCustomReminder: (...args: [string, unknown]) => mockSaveCustomReminder(...args),
    deleteCustomReminder: (...args: [string, string]) => mockDeleteCustomReminder(...args),
  };
});
vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setReminderDone: (...args: [string, unknown, boolean]) => mockSetReminderDone(...args),
}));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { RemindersScreen } from './RemindersScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <RemindersScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('RemindersScreen', () => {
  beforeEach(() => {
    mockListCustomReminders.mockReset();
    mockGetCompletion.mockReset();
    mockSaveCustomReminder.mockClear();
    mockDeleteCustomReminder.mockClear();
    mockSetReminderDone.mockClear();
  });

  it('lists reminders and lets you mark one done', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText('Drink water')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /Drink water/ }));

    expect(mockSetReminderDone).toHaveBeenCalledWith(
      'user1',
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
      true
    );
  });

  it('shows the streak and points badge for a reminder', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily', points: 7, currentStreak: 3 },
    ]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText(/3.*7 pts/)).toBeInTheDocument());
  });

  it('adds a new daily reminder', async () => {
    mockListCustomReminders.mockResolvedValue([]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();
    await waitFor(() => expect(mockListCustomReminders).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Reminder label'), 'Take medication');
    await user.type(screen.getByLabelText('Time'), '08:00');
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));

    expect(mockSaveCustomReminder).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ label: 'Take medication', time: '08:00', cadence: 'daily' })
    );
  });

  it('adds a weekly reminder with selected weekdays', async () => {
    mockListCustomReminders.mockResolvedValue([]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();
    await waitFor(() => expect(mockListCustomReminders).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Reminder label'), 'Gym');
    await user.type(screen.getByLabelText('Time'), '07:00');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'weekly');
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }));
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));

    expect(mockSaveCustomReminder).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ label: 'Gym', time: '07:00', cadence: 'weekly', weeklyDays: [1, 3] })
    );
  });

  it('removes a reminder', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Drink water')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(mockDeleteCustomReminder).toHaveBeenCalledWith('user1', 'r1');
    await waitFor(() => expect(screen.queryByText('Drink water')).not.toBeInTheDocument());
  });

  it('shows an error message instead of hanging when loading fails', async () => {
    mockListCustomReminders.mockRejectedValue(new Error('offline'));
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong: offline')).toBeInTheDocument()
    );
  });
});
