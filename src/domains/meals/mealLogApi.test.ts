import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { getMealLog, addMealEntry } from './mealLogApi';

describe('mealLogApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns an empty entries list when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: [] });
  });

  it('defaults entries to an empty array when the doc exists but has no entries field', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20' }) });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: [] });
  });

  it('defaults entries to an empty array when the stored value is not an array', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ date: '2026-07-20', entries: 'x' }),
    });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: [] });
  });

  it('returns the stored entries when present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ date: '2026-07-20', entries: ['Oatmeal'] }),
    });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: ['Oatmeal'] });
  });

  it('addMealEntry appends to the existing entries and writes the full list', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ date: '2026-07-20', entries: ['Oatmeal'] }),
    });
    await addMealEntry('user1', 'Salad', '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      entries: ['Oatmeal', 'Salad'],
    });
  });
});
