import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListTransactions = vi.fn();
const mockAddTransaction = vi.fn().mockResolvedValue('tx1');
const mockListBudgets = vi.fn();
const mockSaveBudget = vi.fn().mockResolvedValue(undefined);
const mockListBills = vi.fn();
const mockSaveBill = vi.fn().mockResolvedValue(undefined);

vi.mock('./transactionsApi', () => ({
  listTransactionsForMonth: (...args: [string, string]) => mockListTransactions(...args),
  addTransaction: (...args: [string, unknown]) => mockAddTransaction(...args),
}));
vi.mock('./budgetsApi', () => ({
  listBudgets: (...args: [string]) => mockListBudgets(...args),
  saveBudget: (...args: [string, unknown]) => mockSaveBudget(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('./billsApi', async () => {
  const actual = await vi.importActual<typeof import('./billsApi')>('./billsApi');
  return {
    ...actual,
    listBills: (...args: [string]) => mockListBills(...args),
    saveBill: (...args: [string, unknown]) => mockSaveBill(...args),
  };
});
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { FinancesScreen } from './FinancesScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <FinancesScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('FinancesScreen', () => {
  beforeEach(() => {
    mockListTransactions.mockReset();
    mockAddTransaction.mockClear();
    mockListBudgets.mockReset();
    mockSaveBudget.mockClear();
    mockListBills.mockReset();
    mockSaveBill.mockClear();
  });

  it('adds a transaction', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBudgets.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListTransactions).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Amount'), '42.5');
    await user.type(screen.getByPlaceholderText('Category'), 'Groceries');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockAddTransaction).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ amount: 42.5, category: 'Groceries', type: 'expense' })
    );
  });

  it('renders a budget bar showing spend against the limit', async () => {
    mockListTransactions.mockResolvedValue([
      { id: 't1', date: '2026-07-20', amount: 50, category: 'Groceries', type: 'expense' },
    ]);
    mockListBudgets.mockResolvedValue([{ category: 'Groceries', monthlyLimit: 200 }]);
    mockListBills.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('$50.00 / $200.00')).toBeInTheDocument());
  });

  it('flags a bill as due today', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBudgets.mockResolvedValue([]);
    mockListBills.mockResolvedValue([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate(), category: 'Housing' },
    ]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('Due today')).toBeInTheDocument());
  });
});
