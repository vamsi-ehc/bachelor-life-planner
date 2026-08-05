import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomReminder } from '../shared/types';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listCustomReminders, saveCustomReminder, deleteCustomReminder, isCustomReminderDueToday } from './remindersApi';

describe('isCustomReminderDueToday', () => {
  it('is always due for daily reminders', () => {
    const reminder: CustomReminder = { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' };
    expect(isCustomReminderDueToday(reminder, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const reminder: CustomReminder = {
      id: 'r2',
      label: 'Gym',
      time: '07:00',
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
    };
    expect(isCustomReminderDueToday(reminder, 3)).toBe(true);
    expect(isCustomReminderDueToday(reminder, 2)).toBe(false);
  });

  it('is not due for weekly reminders with no matching days configured', () => {
    const reminder: CustomReminder = { id: 'r3', label: 'Read', time: '21:00', cadence: 'weekly' };
    expect(isCustomReminderDueToday(reminder, 3)).toBe(false);
  });
});

describe('remindersApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listCustomReminders maps Firestore docs to CustomReminder objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'r1', data: () => ({ label: 'Drink water', time: '10:00', cadence: 'daily', weeklyDays: null }) }],
    });
    const result = await listCustomReminders('user1');
    expect(result).toEqual([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily', weeklyDays: null, points: 0, currentStreak: 0 },
    ]);
  });

  it('saveCustomReminder writes the reminder fields', async () => {
    const reminder: CustomReminder = { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' };
    await saveCustomReminder('user1', reminder);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      label: 'Drink water',
      time: '10:00',
      cadence: 'daily',
      weeklyDays: null,
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteCustomReminder removes the reminder doc', async () => {
    await deleteCustomReminder('user1', 'r1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
