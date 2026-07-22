import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetSleepLog = vi.fn();
const mockSaveSleepLog = vi.fn().mockResolvedValue(undefined);
const mockListWeightEntries = vi.fn();
const mockAddWeightEntry = vi.fn().mockResolvedValue('w1');

vi.mock('./sleepApi', () => ({
  getSleepLog: (...args: [string]) => mockGetSleepLog(...args),
  saveSleepLog: (...args: [string, unknown]) => mockSaveSleepLog(...args),
}));
vi.mock('./weightApi', () => ({
  listWeightEntries: (...args: [string]) => mockListWeightEntries(...args),
  addWeightEntry: (...args: [string, unknown]) => mockAddWeightEntry(...args),
}));

import { HealthScreen } from './HealthScreen';

describe('HealthScreen', () => {
  beforeEach(() => {
    mockGetSleepLog.mockReset();
    mockSaveSleepLog.mockClear();
    mockListWeightEntries.mockReset();
    mockAddWeightEntry.mockClear();
  });

  it('saves bedtime and wake time', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);

    render(<HealthScreen uid="user1" />);
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

    render(<HealthScreen uid="user1" />);

    await waitFor(() => expect(screen.getByText('8h slept')).toBeInTheDocument());
  });

  it('adds a weight entry', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);

    render(<HealthScreen uid="user1" />);
    await waitFor(() => expect(mockListWeightEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '70');
    await user.click(screen.getByRole('button', { name: 'Log weight' }));

    expect(mockAddWeightEntry).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ weightKg: 70 })
    );
  });
});
