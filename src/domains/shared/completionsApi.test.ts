import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChoreConfig, CustomReminder } from './types';

const mockDoc = vi.fn((...args: unknown[]) => ({ path: args.join('/') }));
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockLimit = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

const mockSaveChore = vi.fn().mockResolvedValue(undefined);
vi.mock('../chores/choresApi', () => ({
  saveChore: (...args: [string, ChoreConfig]) => mockSaveChore(...args),
}));

const mockSaveCustomReminder = vi.fn().mockResolvedValue(undefined);
vi.mock('../reminders/remindersApi', () => ({
  saveCustomReminder: (...args: [string, CustomReminder]) => mockSaveCustomReminder(...args),
}));

import {
  getCompletion,
  listRecentCompletions,
  setWorkoutDone,
  setLearningDone,
  setChoreDone,
  setReminderDone,
} from './completionsApi';

describe('completionsApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSaveChore.mockClear();
    mockSaveCustomReminder.mockClear();
  });

  it('returns an empty completion when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: false, learning: false, chores: {}, reminders: {} });
  });

  it('returns the stored completion when a doc exists', async () => {
    const stored = {
      date: '2026-07-20',
      workout: true,
      learning: false,
      chores: { c1: true },
      reminders: { r1: true },
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual(stored);
  });

  it('fills in defaults for fields missing from a partially-written doc', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20', workout: true }) });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: true, learning: false, chores: {}, reminders: {} });
  });

  it('setWorkoutDone merges the workout flag', async () => {
    await setWorkoutDone('user1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', workout: true },
      { merge: true }
    );
  });

  it('setLearningDone merges the learning flag', async () => {
    await setLearningDone('user1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', learning: true },
      { merge: true }
    );
  });

  it('setChoreDone merges a single chore flag and awards a streak point when done', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily', points: 2, currentStreak: 1, lastCompletedDate: '2026-07-19' };
    await setChoreDone('user1', chore, true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', chores: { c1: true } },
      { merge: true }
    );
    expect(mockSaveChore).toHaveBeenCalledWith('user1', {
      ...chore,
      points: 3,
      currentStreak: 2,
      lastCompletedDate: '2026-07-20',
    });
  });

  it('setChoreDone does not touch streak fields when unchecking', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily', points: 2, currentStreak: 1, lastCompletedDate: '2026-07-20' };
    await setChoreDone('user1', chore, false, '2026-07-20');
    expect(mockSaveChore).not.toHaveBeenCalled();
  });

  it('setChoreDone does not double-award points for an already-completed date', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily', points: 2, currentStreak: 1, lastCompletedDate: '2026-07-20' };
    await setChoreDone('user1', chore, true, '2026-07-20');
    expect(mockSaveChore).not.toHaveBeenCalled();
  });

  it('setReminderDone merges a single reminder flag and awards a streak point when done', async () => {
    const reminder: CustomReminder = { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' };
    await setReminderDone('user1', reminder, true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', reminders: { r1: true } },
      { merge: true }
    );
    expect(mockSaveCustomReminder).toHaveBeenCalledWith('user1', {
      ...reminder,
      points: 1,
      currentStreak: 1,
      lastCompletedDate: '2026-07-20',
    });
  });

  it('listRecentCompletions returns completions ordered most-recent-first', async () => {
    const days = [
      { date: '2026-07-20', workout: true, learning: true, chores: {} },
      { date: '2026-07-19', workout: true, learning: false, chores: {} },
    ];
    mockGetDocs.mockResolvedValue({ docs: days.map((d) => ({ data: () => d })) });
    const result = await listRecentCompletions('user1', 7);
    expect(result).toEqual(days);
  });
});
