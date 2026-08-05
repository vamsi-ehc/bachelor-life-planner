import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListChores = vi.fn();
const mockSaveChore = vi.fn().mockResolvedValue(undefined);
const mockGetCompletion = vi.fn();
const mockSetChoreDone = vi.fn().mockResolvedValue(undefined);

vi.mock('./choresApi', async () => {
  const actual = await vi.importActual<typeof import('./choresApi')>('./choresApi');
  return {
    ...actual,
    listChores: (...args: [string]) => mockListChores(...args),
    saveChore: (...args: [string, unknown]) => mockSaveChore(...args),
  };
});
vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setChoreDone: (...args: [string, unknown, boolean]) => mockSetChoreDone(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { ChoresScreen } from './ChoresScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <ChoresScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('ChoresScreen', () => {
  beforeEach(() => {
    mockListChores.mockReset();
    mockGetCompletion.mockReset();
    mockSaveChore.mockClear();
    mockSetChoreDone.mockClear();
  });

  it('lists chores and lets you mark one done', async () => {
    mockListChores.mockResolvedValue([{ id: 'c1', name: 'Dishes', cadence: 'daily' }]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    renderScreen();

    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /Dishes/ }));

    expect(mockSetChoreDone).toHaveBeenCalledWith(
      'user1',
      { id: 'c1', name: 'Dishes', cadence: 'daily' },
      true
    );
  });

  it('shows the streak and points badge for a chore', async () => {
    mockListChores.mockResolvedValue([
      { id: 'c1', name: 'Dishes', cadence: 'daily', points: 12, currentStreak: 4 },
    ]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    renderScreen();

    await waitFor(() => expect(screen.getByText(/4.*12 pts/)).toBeInTheDocument());
  });

  it('adds a new daily chore', async () => {
    mockListChores.mockResolvedValue([]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    renderScreen();
    await waitFor(() => expect(mockListChores).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('New chore name'), 'Vacuum');
    await user.click(screen.getByRole('button', { name: 'Add chore' }));

    expect(mockSaveChore).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ name: 'Vacuum', cadence: 'daily' })
    );
  });

  it('shows an error message instead of hanging when loading fails', async () => {
    mockListChores.mockRejectedValue(new Error('offline'));
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong: offline')).toBeInTheDocument()
    );
  });
});
