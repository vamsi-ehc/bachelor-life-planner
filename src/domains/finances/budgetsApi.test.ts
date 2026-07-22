import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listBudgets, saveBudget } from './budgetsApi';

describe('budgetsApi', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
  });

  it('listBudgets maps docs to Budget objects using the doc id as category', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'Groceries', data: () => ({ monthlyLimit: 200 }) }],
    });
    const result = await listBudgets('user1');
    expect(result).toEqual([{ category: 'Groceries', monthlyLimit: 200 }]);
  });

  it('saveBudget writes the monthly limit keyed by category', async () => {
    await saveBudget('user1', { category: 'Groceries', monthlyLimit: 200 });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { monthlyLimit: 200 });
  });

  it('listBudgets defaults monthlyLimit to 0 when field is missing', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'Groceries', data: () => ({}) }],
    });
    const result = await listBudgets('user1');
    expect(result).toEqual([{ category: 'Groceries', monthlyLimit: 0 }]);
  });

  it('listBudgets defaults monthlyLimit to 0 when field is not a number', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'Groceries', data: () => ({ monthlyLimit: 'invalid' }) }],
    });
    const result = await listBudgets('user1');
    expect(result).toEqual([{ category: 'Groceries', monthlyLimit: 0 }]);
  });
});
