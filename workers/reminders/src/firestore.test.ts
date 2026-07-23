import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocument, listDocuments, patchDocument, deleteDocument } from './firestore';

describe('getDocument', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('decodes string, integer, boolean, and map fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          fields: {
            workoutTime: { stringValue: '06:45' },
            cutoffHour: { integerValue: '21' },
            workout: { booleanValue: true },
            chores: { mapValue: { fields: { abc: { booleanValue: true } } } },
          },
        }),
      }),
    );

    const result = await getDocument('proj1', 'token1', 'users/u1/config/reminders');

    expect(result).toEqual({
      workoutTime: '06:45',
      cutoffHour: 21,
      workout: true,
      chores: { abc: true },
    });
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await getDocument('proj1', 'token1', 'users/u1/config/reminders');
    expect(result).toBeNull();
  });
});

describe('listDocuments', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns id + decoded data for each document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: [
            {
              name: 'projects/proj1/databases/(default)/documents/users/u1/bills/bill1',
              fields: { name: { stringValue: 'Rent' }, dueDay: { integerValue: '1' } },
            },
          ],
        }),
      }),
    );

    const result = await listDocuments('proj1', 'token1', 'users/u1/bills');

    expect(result).toEqual([{ id: 'bill1', data: { name: 'Rent', dueDay: 1 } }]);
  });

  it('returns an empty array when there are no documents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const result = await listDocuments('proj1', 'token1', 'users/u1/bills');
    expect(result).toEqual([]);
  });
});

describe('patchDocument', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a PATCH with an updateMask for each field and encoded values', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await patchDocument('proj1', 'token1', 'users/u1/reminderState/workout', { lastSentDate: '2026-07-23' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('updateMask.fieldPaths=lastSentDate');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ fields: { lastSentDate: { stringValue: '2026-07-23' } } });
  });
});

describe('deleteDocument', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a DELETE request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await deleteDocument('proj1', 'token1', 'users/u1/fcmTokens/abc');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });
});
