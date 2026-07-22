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

import { getSleepLog, saveSleepLog } from './sleepApi';

describe('getSleepLog', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns empty bedtime/wakeTime when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getSleepLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', bedtime: '', wakeTime: '' });
  });

  it('defaults missing fields when the doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ bedtime: '23:00' }) });
    const result = await getSleepLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', bedtime: '23:00', wakeTime: '' });
  });

  it('returns the stored bedtime and wakeTime when present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ bedtime: '23:00', wakeTime: '07:00' }),
    });
    const result = await getSleepLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' });
  });
});

describe('saveSleepLog', () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
  });

  it('writes the date, bedtime, and wakeTime', async () => {
    await saveSleepLog('user1', { date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      bedtime: '23:00',
      wakeTime: '07:00',
    });
  });
});
