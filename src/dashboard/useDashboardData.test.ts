import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetCompletion = vi.fn();
const mockListRecentCompletions = vi.fn();
const mockListChores = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (..._args: unknown[]) => ({}),
  doc: (..._args: unknown[]) => ({}),
  getDoc: (..._args: unknown[]) => Promise.resolve(),
  getDocs: (..._args: unknown[]) => Promise.resolve(),
  setDoc: (..._args: unknown[]) => Promise.resolve(),
  deleteDoc: (..._args: unknown[]) => Promise.resolve(),
  orderBy: (..._args: unknown[]) => ({}),
  limit: (..._args: unknown[]) => ({}),
  query: (..._args: unknown[]) => ({}),
}));
vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));

vi.mock('../domains/shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  listRecentCompletions: (...args: [string, number]) => mockListRecentCompletions(...args),
}));
vi.mock('../domains/chores/choresApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/chores/choresApi')>(
    '../domains/chores/choresApi'
  );
  return { ...actual, listChores: (...args: [string]) => mockListChores(...args) };
});

import { useDashboardData } from './useDashboardData';

describe('useDashboardData', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockListRecentCompletions.mockReset();
    mockListChores.mockReset();
  });

  it('loads completion, recent history, and chores, then computes streak, due items, and day health', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: { c1: true },
    });
    mockListRecentCompletions.mockResolvedValue([
      { date: '2026-07-20', workout: true, learning: true, chores: { c1: true } },
      { date: '2026-07-19', workout: true, learning: true, chores: {} },
      { date: '2026-07-18', workout: false, learning: true, chores: {} },
    ]);
    mockListChores.mockResolvedValue([
      { id: 'c1', name: 'Dishes', cadence: 'daily' },
      { id: 'c2', name: 'Laundry', cadence: 'daily' },
    ]);

    const { result } = renderHook(() => useDashboardData('user1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListRecentCompletions).toHaveBeenCalledWith('user1', 30);
    expect(result.current.streak).toBe(2);
    expect(result.current.dueItems).toEqual([{ id: 'c2', label: 'Laundry', domain: 'chores' }]);
    expect(result.current.dayHealth).toBe(75);
  });
});
