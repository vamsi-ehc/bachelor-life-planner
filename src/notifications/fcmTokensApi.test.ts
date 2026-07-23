import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockServerTimestamp = vi.fn(() => 'server-timestamp-sentinel');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { saveFcmToken } from './fcmTokensApi';

describe('saveFcmToken', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockSetDoc.mockClear();
  });

  it('writes the token doc keyed by the token itself', async () => {
    await saveFcmToken('user1', 'device-token');

    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'user1', 'fcmTokens', 'device-token');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      token: 'device-token',
      userAgent: expect.any(String),
      createdAt: 'server-timestamp-sentinel',
    });
  });
});
