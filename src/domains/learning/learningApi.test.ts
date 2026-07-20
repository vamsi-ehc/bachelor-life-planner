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

import { addLearningLogEntry, listLearningLogEntries } from './learningApi';

describe('learningApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addLearningLogEntry writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'entry1' });
    const id = await addLearningLogEntry('user1', { date: '2026-07-20', note: 'Read chapter 3' });
    expect(id).toBe('entry1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      note: 'Read chapter 3',
    });
  });

  it('listLearningLogEntries maps docs to LearningLogEntry objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'entry1', data: () => ({ date: '2026-07-20', note: 'Read chapter 3' }) }],
    });
    const result = await listLearningLogEntries('user1');
    expect(result).toEqual([{ id: 'entry1', date: '2026-07-20', note: 'Read chapter 3' }]);
  });
});
