import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListItems = vi.fn();
const mockAddItem = vi.fn().mockResolvedValue('g1');
const mockSetItemChecked = vi.fn().mockResolvedValue(undefined);
const mockGetMealLog = vi.fn();
const mockAddMealEntry = vi.fn().mockResolvedValue(undefined);
const mockListMealPlans = vi.fn();
const mockSaveMealPlan = vi.fn().mockResolvedValue(undefined);
const mockDeleteMealPlan = vi.fn().mockResolvedValue(undefined);

vi.mock('./groceryApi', () => ({
  listGroceryItems: (...args: [string]) => mockListItems(...args),
  addGroceryItem: (...args: [string, string]) => mockAddItem(...args),
  setGroceryItemChecked: (...args: [string, string, boolean]) => mockSetItemChecked(...args),
}));
vi.mock('./mealLogApi', () => ({
  getMealLog: (...args: [string]) => mockGetMealLog(...args),
  addMealEntry: (...args: [string, string]) => mockAddMealEntry(...args),
}));
vi.mock('./mealPlansApi', async () => {
  const actual = await vi.importActual<typeof import('./mealPlansApi')>('./mealPlansApi');
  return {
    ...actual,
    listMealPlans: (...args: [string]) => mockListMealPlans(...args),
    saveMealPlan: (...args: [string, unknown]) => mockSaveMealPlan(...args),
    deleteMealPlan: (...args: [string, string]) => mockDeleteMealPlan(...args),
  };
});
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { MealsScreen } from './MealsScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <MealsScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('MealsScreen', () => {
  beforeEach(() => {
    mockListItems.mockReset();
    mockAddItem.mockClear();
    mockSetItemChecked.mockClear();
    mockGetMealLog.mockReset();
    mockAddMealEntry.mockClear();
    mockListMealPlans.mockReset().mockResolvedValue([]);
    mockSaveMealPlan.mockClear();
    mockDeleteMealPlan.mockClear();
  });

  it('lists grocery items and lets you check one off', async () => {
    mockListItems.mockResolvedValue([{ id: 'g1', name: 'Milk', checked: false }]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Milk' }));

    expect(mockSetItemChecked).toHaveBeenCalledWith('user1', 'g1', true);
  });

  it('adds a new grocery item', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    renderScreen();
    await waitFor(() => expect(mockListItems).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('New grocery item'), 'Eggs');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(mockAddItem).toHaveBeenCalledWith('user1', 'Eggs');
  });

  it('adds a meal log entry', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    renderScreen();
    await waitFor(() => expect(mockGetMealLog).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you eat?'), 'Oatmeal');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddMealEntry).toHaveBeenCalledWith('user1', 'Oatmeal');
  });

  it('adds a new meal plan with weekday repeat', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });
    mockListMealPlans.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListMealPlans).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Meal name (e.g. Grilled chicken)'), 'Grilled chicken');
    await user.selectOptions(screen.getByLabelText('Meal'), 'dinner');
    await user.selectOptions(screen.getByDisplayValue('Daily'), 'weekly');
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: 'Add plan' }));

    expect(mockSaveMealPlan).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ name: 'Grilled chicken', meal: 'dinner', cadence: 'weekly', weeklyDays: [3] })
    );
  });

  it('shows a due-today badge for a plan scheduled today and awards a streak when a meal entry is logged', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });
    mockListMealPlans.mockResolvedValue([
      { id: 'm1', name: 'Grilled chicken', meal: 'dinner', cadence: 'daily', points: 0, currentStreak: 0 },
    ]);

    renderScreen();
    await waitFor(() => expect(screen.getByText(/Grilled chicken/)).toBeInTheDocument());
    expect(screen.getByText('Due today')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you eat?'), 'Oatmeal');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    await waitFor(() =>
      expect(mockSaveMealPlan).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ id: 'm1', points: 1, currentStreak: 1 })
      )
    );
  });
});
