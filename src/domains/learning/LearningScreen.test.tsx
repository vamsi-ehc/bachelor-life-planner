import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetCompletion = vi.fn();
const mockSetLearningDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue('entry1');

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setLearningDone: (...args: [string, boolean]) => mockSetLearningDone(...args),
}));
vi.mock('./learningApi', () => ({
  listLearningLogEntries: (...args: [string]) => mockListEntries(...args),
  addLearningLogEntry: (...args: [string, unknown]) => mockAddEntry(...args),
}));

import { LearningScreen } from './LearningScreen';

describe('LearningScreen', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockSetLearningDone.mockClear();
    mockListEntries.mockReset();
    mockAddEntry.mockClear();
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<LearningScreen uid="user1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetLearningDone).toHaveBeenCalledWith('user1', true);
  });

  it('adds a note entry', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<LearningScreen uid="user1" />);
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you study?'), 'Read chapter 3');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddEntry).toHaveBeenCalledWith('user1', expect.objectContaining({ note: 'Read chapter 3' }));
  });
});
