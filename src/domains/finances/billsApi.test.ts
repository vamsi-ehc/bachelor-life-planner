import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bill } from '../shared/types';

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

import { listBills, saveBill, isBillDueToday } from './billsApi';

describe('isBillDueToday', () => {
  it('is due when the bill\'s dueDay matches the given day of month', () => {
    const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' };
    expect(isBillDueToday(bill, 1)).toBe(true);
  });

  it('is not due when the days differ', () => {
    const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' };
    expect(isBillDueToday(bill, 15)).toBe(false);
  });
});

describe('billsApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
  });

  it('listBills maps docs to Bill objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' }]);
  });

  it('saveBill writes the bill fields', async () => {
    const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' };
    await saveBill('user1', bill);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Rent',
      amount: 1200,
      dueDay: 1,
      category: 'Housing',
    });
  });

  it('listBills defaults missing name to empty string', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ amount: 1200, dueDay: 1, category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: '', amount: 1200, dueDay: 1, category: 'Housing' }]);
  });

  it('listBills defaults missing amount to 0', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', dueDay: 1, category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 0, dueDay: 1, category: 'Housing' }]);
  });

  it('listBills defaults non-number amount to 0', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', amount: 'invalid', dueDay: 1, category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 0, dueDay: 1, category: 'Housing' }]);
  });

  it('listBills defaults missing dueDay to 0', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', amount: 1200, category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 0, category: 'Housing' }]);
  });

  it('listBills defaults non-number dueDay to 0', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', amount: 1200, dueDay: 'invalid', category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 0, category: 'Housing' }]);
  });

  it('listBills defaults missing category to empty string', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', amount: 1200, dueDay: 1 }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: '' }]);
  });
});
