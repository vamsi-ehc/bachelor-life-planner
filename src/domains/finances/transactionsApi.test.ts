import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockWhere = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addTransaction, listTransactionsForMonth } from './transactionsApi';

describe('transactionsApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addTransaction writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'tx1' });
    const id = await addTransaction('user1', {
      date: '2026-07-20',
      amount: 42.5,
      category: 'Groceries',
      type: 'expense',
    });
    expect(id).toBe('tx1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      amount: 42.5,
      category: 'Groceries',
      type: 'expense',
    });
  });

  it('listTransactionsForMonth maps docs to Transaction objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'tx1',
          data: () => ({ date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'expense' }),
        },
      ],
    });
    const result = await listTransactionsForMonth('user1', '2026-07');
    expect(result).toEqual([
      { id: 'tx1', date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'expense' },
    ]);
  });

  it('listTransactionsForMonth defaults missing fields', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'tx2',
          data: () => ({ category: 'Food' }),
        },
        {
          id: 'tx3',
          data: () => ({ date: '2026-07-19', amount: 15.0, type: 'income', note: 'Bonus' }),
        },
      ],
    });
    const result = await listTransactionsForMonth('user1', '2026-07');
    expect(result).toEqual([
      { id: 'tx2', date: '', amount: 0, category: 'Food', type: 'expense' },
      { id: 'tx3', date: '2026-07-19', amount: 15.0, category: '', type: 'income', note: 'Bonus' },
    ]);
  });
});
