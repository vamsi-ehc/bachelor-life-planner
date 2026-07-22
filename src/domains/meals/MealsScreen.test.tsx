import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockListItems = vi.fn();
const mockAddItem = vi.fn().mockResolvedValue('g1');
const mockSetItemChecked = vi.fn().mockResolvedValue(undefined);
const mockGetMealLog = vi.fn();
const mockAddMealEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('./groceryApi', () => ({
  listGroceryItems: (...args: [string]) => mockListItems(...args),
  addGroceryItem: (...args: [string, string]) => mockAddItem(...args),
  setGroceryItemChecked: (...args: [string, string, boolean]) => mockSetItemChecked(...args),
}));
vi.mock('./mealLogApi', () => ({
  getMealLog: (...args: [string]) => mockGetMealLog(...args),
  addMealEntry: (...args: [string, string]) => mockAddMealEntry(...args),
}));

import { MealsScreen } from './MealsScreen';

describe('MealsScreen', () => {
  beforeEach(() => {
    mockListItems.mockReset();
    mockAddItem.mockClear();
    mockSetItemChecked.mockClear();
    mockGetMealLog.mockReset();
    mockAddMealEntry.mockClear();
  });

  it('lists grocery items and lets you check one off', async () => {
    mockListItems.mockResolvedValue([{ id: 'g1', name: 'Milk', checked: false }]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    render(<MealsScreen uid="user1" />);
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Milk' }));

    expect(mockSetItemChecked).toHaveBeenCalledWith('user1', 'g1', true);
  });

  it('adds a new grocery item', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    render(<MealsScreen uid="user1" />);
    await waitFor(() => expect(mockListItems).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('New grocery item'), 'Eggs');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(mockAddItem).toHaveBeenCalledWith('user1', 'Eggs');
  });

  it('adds a meal log entry', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    render(<MealsScreen uid="user1" />);
    await waitFor(() => expect(mockGetMealLog).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you eat?'), 'Oatmeal');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddMealEntry).toHaveBeenCalledWith('user1', 'Oatmeal');
  });
});
