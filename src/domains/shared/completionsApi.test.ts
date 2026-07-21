import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import {
  getCompletion,
  listRecentCompletions,
  setWorkoutDone,
  setLearningDone,
  setChoreDone,
} from './completionsApi';

describe('completionsApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('returns an empty completion when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: false, learning: false, chores: {} });
  });

  it('returns the stored completion when a doc exists', async () => {
    const stored = { date: '2026-07-20', workout: true, learning: false, chores: { c1: true } };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual(stored);
  });

  it('fills in defaults for fields missing from a partially-written doc', async () => {
    // Realistic case: setWorkoutDone's merge:true write only ever sets
    // {date, workout}, so a doc touched by just one setter has no
    // `learning`/`chores` fields at all until another setter writes them.
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20', workout: true }) });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: true, learning: false, chores: {} });
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

  it('setChoreDone merges a single chore flag', async () => {
    await setChoreDone('user1', 'c1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', chores: { c1: true } },
      { merge: true }
    );
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
