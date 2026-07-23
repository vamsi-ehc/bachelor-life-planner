import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockServerTimestamp = vi.fn(() => 'server-timestamp-sentinel');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { registerUser } from './userRegistry';

describe('registerUser', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockSetDoc.mockClear();
  });

  it('upserts a users/{uid} document with email and a timestamp', async () => {
    await registerUser('uid1', 'me@example.com');

    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'uid1');
    expect(mockSetDoc).toHaveBeenCalledWith(
      {},
      { email: 'me@example.com', updatedAt: 'server-timestamp-sentinel' },
      { merge: true },
    );
  });

  it('stores a null email as null (not undefined)', async () => {
    await registerUser('uid2', null);

    expect(mockSetDoc).toHaveBeenCalledWith(
      {},
      { email: null, updatedAt: 'server-timestamp-sentinel' },
      { merge: true },
    );
  });
});
