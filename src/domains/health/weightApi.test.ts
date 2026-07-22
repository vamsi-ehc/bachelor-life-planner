import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addWeightEntry, listWeightEntries } from './weightApi';

describe('weightApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addWeightEntry writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'w1' });
    const id = await addWeightEntry('user1', { date: '2026-07-20', weightKg: 70 });
    expect(id).toBe('w1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { date: '2026-07-20', weightKg: 70 });
  });

  it('listWeightEntries maps docs to WeightEntry objects, ordered by date descending', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'w1', data: () => ({ date: '2026-07-20', weightKg: 70 }) }],
    });
    const result = await listWeightEntries('user1');
    expect(result).toEqual([{ id: 'w1', date: '2026-07-20', weightKg: 70 }]);
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
  });

  it('defaults a missing or non-numeric weightKg to 0 and a missing date to empty string', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'w1', data: () => ({ date: '2026-07-20' }) },
        { id: 'w2', data: () => ({ weightKg: 'not-a-number' }) },
      ],
    });
    const result = await listWeightEntries('user1');
    expect(result).toEqual([
      { id: 'w1', date: '2026-07-20', weightKg: 0 },
      { id: 'w2', date: '', weightKg: 0 },
    ]);
  });
});
