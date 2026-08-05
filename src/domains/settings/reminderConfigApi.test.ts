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

import { getReminderConfig, saveReminderConfig, DEFAULT_REMINDER_CONFIG } from './reminderConfigApi';

describe('getReminderConfig', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns the defaults when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getReminderConfig('user1');
    expect(result).toEqual(DEFAULT_REMINDER_CONFIG);
    expect(result.notificationsEnabled).toBe(true);
  });

  it('defaults missing fields when the doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ workoutTime: '07:00' }) });
    const result = await getReminderConfig('user1');
    expect(result.workoutTime).toBe('07:00');
    expect(result.dinnerTime).toBe(DEFAULT_REMINDER_CONFIG.dinnerTime);
    expect(result.notificationsEnabled).toBe(true);
  });

  it('defaults notificationsEnabled to true when the doc predates the field', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ workoutTime: '07:00', dinnerTime: '18:30', learningTime: '20:30', weeklyReviewTime: '17:00', timezone: 'UTC' }),
    });
    const result = await getReminderConfig('user1');
    expect(result.notificationsEnabled).toBe(true);
  });

  it('returns the stored config when present', async () => {
    const stored = {
      workoutTime: '07:00',
      dinnerTime: '18:30',
      learningTime: '20:30',
      weeklyReviewTime: '17:00',
      timezone: 'America/New_York',
      notificationsEnabled: false,
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getReminderConfig('user1');
    expect(result).toEqual(stored);
  });
});

describe('saveReminderConfig', () => {
  beforeEach(() => mockSetDoc.mockReset());

  it('writes all 6 fields', async () => {
    const config = {
      workoutTime: '07:00',
      dinnerTime: '18:30',
      learningTime: '20:30',
      weeklyReviewTime: '17:00',
      timezone: 'America/New_York',
      notificationsEnabled: false,
    };
    await saveReminderConfig('user1', config);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), config);
  });
});
