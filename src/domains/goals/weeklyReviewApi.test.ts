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

import { getWeeklyReview, saveWeeklyReview } from './weeklyReviewApi';

describe('getWeeklyReview', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns null when no review exists for the week', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getWeeklyReview('user1', '2026-07-19');
    expect(result).toBeNull();
  });

  it('defaults missing fields when a review doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ wentWell: 'Slept well' }) });
    const result = await getWeeklyReview('user1', '2026-07-19');
    expect(result).toEqual({ weekId: '2026-07-19', wentWell: 'Slept well', wentBadly: '', focusNext: '' });
  });

  it('returns the stored review when fully present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ wentWell: 'A', wentBadly: 'B', focusNext: 'C' }),
    });
    const result = await getWeeklyReview('user1', '2026-07-19');
    expect(result).toEqual({ weekId: '2026-07-19', wentWell: 'A', wentBadly: 'B', focusNext: 'C' });
  });
});

describe('saveWeeklyReview', () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
  });

  it('writes the review fields', async () => {
    await saveWeeklyReview('user1', { weekId: '2026-07-19', wentWell: 'A', wentBadly: 'B', focusNext: 'C' });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      wentWell: 'A',
      wentBadly: 'B',
      focusNext: 'C',
    });
  });
});
