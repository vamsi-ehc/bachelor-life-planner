import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetCompletion = vi.fn();
const mockListRecentCompletions = vi.fn();
const mockListChores = vi.fn();
const mockListBills = vi.fn();
const mockListGroceryItems = vi.fn();

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
vi.mock('../domains/finances/billsApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/finances/billsApi')>(
    '../domains/finances/billsApi'
  );
  return { ...actual, listBills: (...args: [string]) => mockListBills(...args) };
});
vi.mock('../domains/meals/groceryApi', () => ({
  listGroceryItems: (...args: [string]) => mockListGroceryItems(...args),
}));

import { useDashboardData } from './useDashboardData';

describe('useDashboardData', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockListRecentCompletions.mockReset();
    mockListChores.mockReset();
    mockListBills.mockReset();
    mockListGroceryItems.mockReset();
  });

  it('loads completion, history, chores, bills, and groceries, then computes streak, due items, and day health', async () => {
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
    mockListBills.mockResolvedValue([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 20, category: 'Housing' },
    ]);
    mockListGroceryItems.mockResolvedValue([{ id: 'g1', name: 'Milk', checked: false }]);

    const { result } = renderHook(() => useDashboardData('user1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListBills).toHaveBeenCalledWith('user1');
    expect(mockListGroceryItems).toHaveBeenCalledWith('user1');
    expect(result.current.bills).toEqual([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 20, category: 'Housing' },
    ]);
    expect(result.current.groceryItems).toEqual([{ id: 'g1', name: 'Milk', checked: false }]);
    expect(result.current.streak).toBe(2);
    expect(result.current.dueItems).toEqual(
      expect.arrayContaining([
        { id: 'c2', label: 'Laundry', domain: 'chores' },
        { id: 'groceries-needed', label: '1 grocery item needed', domain: 'meals' },
      ])
    );
    expect(result.current.dayHealth).toBe(75);
  });

  it('sets an error and clears loading when a read fails', async () => {
    mockGetCompletion.mockRejectedValue(new Error('offline'));
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('offline');
  });
});
