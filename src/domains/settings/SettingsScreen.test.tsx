import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetReminderConfig = vi.fn();
const mockSaveReminderConfig = vi.fn();
const mockResetAllTutorialFlags = vi.fn().mockResolvedValue(undefined);

vi.mock('./reminderConfigApi', () => ({
  getReminderConfig: (...args: unknown[]) => mockGetReminderConfig(...args),
  saveReminderConfig: (...args: unknown[]) => mockSaveReminderConfig(...args),
}));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));
vi.mock('../../tutorials/tutorialFlagsApi', () => ({
  resetAllTutorialFlags: (...args: unknown[]) => mockResetAllTutorialFlags(...args),
}));

import { SettingsScreen } from './SettingsScreen';

const config = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <SettingsScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockGetReminderConfig.mockReset();
    mockSaveReminderConfig.mockReset().mockResolvedValue(undefined);
    mockResetAllTutorialFlags.mockClear();
  });

  it('shows a loading state before the config resolves', () => {
    mockGetReminderConfig.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the loaded reminder times', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));
    expect(screen.getByLabelText('Dinner prep reminder')).toHaveValue('19:00');
    expect(screen.getByLabelText('Learning reminder')).toHaveValue('20:00');
    expect(screen.getByLabelText('Weekly review reminder (Sunday)')).toHaveValue('18:00');
  });

  it('saves the edited config on submit', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveReminderConfig).toHaveBeenCalledWith('user1', { ...config, workoutTime: '07:00' });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('shows an error message when save fails', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    mockSaveReminderConfig.mockRejectedValue(new Error('Network error'));
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Network error/)).toBeInTheDocument();
    // Form should still have the edited value, not cleared
    expect(screen.getByLabelText('Workout reminder')).toHaveValue('07:00');
    // "Saved." message should not appear
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('clears the Saved message when editing after a successful save', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    // First save
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    // Edit again
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '08:00');

    // "Saved." should disappear
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('resets all tutorial flags and shows a confirmation when Replay all tutorials is clicked', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Replay all tutorials' }));

    expect(mockResetAllTutorialFlags).toHaveBeenCalledWith('user1');
    expect(
      await screen.findByText('Tutorials will show again next time you visit each screen.')
    ).toBeInTheDocument();
  });
});
