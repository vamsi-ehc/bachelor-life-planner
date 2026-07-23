import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAccessToken = vi.fn();
const mockGetDocument = vi.fn();
const mockListDocuments = vi.fn();
const mockPatchDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockSendPush = vi.fn();

vi.mock('./googleAuth', () => ({ getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args) }));
vi.mock('./firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  listDocuments: (...args: unknown[]) => mockListDocuments(...args),
  patchDocument: (...args: unknown[]) => mockPatchDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}));
vi.mock('./fcm', () => ({ sendPush: (...args: unknown[]) => mockSendPush(...args) }));

import { runReminderCheck, Env } from './index';

const env: Env = {
  GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: 'key' }),
  FIREBASE_PROJECT_ID: 'proj1',
};

const defaultConfig = { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };

describe('runReminderCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('access-token');
    mockSendPush.mockResolvedValue({ ok: true, invalidToken: false });
    mockPatchDocument.mockResolvedValue(undefined);
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  it('fires a reminder for every user discovered under the users collection', async () => {
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'uid1', data: {} }, { id: 'uid2', data: {} }];
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      if (path === 'users/uid2/fcmTokens') return [{ id: 'tok-b', data: { token: 'tok-b' } }];
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders' || path === 'users/uid2/config/reminders') return defaultConfig;
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).toHaveBeenCalledTimes(2);
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-a', title: 'Workout time' }));
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-b', title: 'Workout time' }));
    expect(mockPatchDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid1/reminderState/workout', { lastSentDate: '2026-07-23' });
    expect(mockPatchDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid2/reminderState/workout', { lastSentDate: '2026-07-23' });
  });

  it('does nothing when no users are registered', async () => {
    mockListDocuments.mockResolvedValue([]);
    mockGetDocument.mockResolvedValue(null);

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("processes the remaining users when one user's check throws", async () => {
    let callCount = 0;
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'broken-uid', data: {} }, { id: 'uid2', data: {} }];
      if (path === 'users/uid2/fcmTokens') return [{ id: 'tok-b', data: { token: 'tok-b' } }];
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      callCount += 1;
      if (path === 'users/broken-uid/config/reminders') throw new Error('Firestore down');
      if (path === 'users/uid2/config/reminders') return defaultConfig;
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(callCount).toBeGreaterThan(0);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-b' }));
  });
});
