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
  FIREBASE_UID: 'uid1',
};

describe('runReminderCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('access-token');
    mockSendPush.mockResolvedValue({ ok: true, invalidToken: false });
    mockPatchDocument.mockResolvedValue(undefined);
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  it('sends the workout push and updates state when the configured time matches', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      return null; // no reminderState docs yet, no completion doc
    });
    mockListDocuments.mockResolvedValue([]); // no bills, chores, or fcmTokens by default

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockGetAccessToken).toHaveBeenCalledWith(
      { client_email: 'x@y.iam.gserviceaccount.com', private_key: 'key' },
      ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging'],
    );
    // No tokens registered, so sendPush is never called, but state is still updated for the fired reminder.
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockPatchDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid1/reminderState/workout', {
      lastSentDate: '2026-07-23',
    });
  });

  it('sends a push to every registered token when a reminder fires', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      return null;
    });
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/fcmTokens') {
        return [{ id: 'tok-a', data: { token: 'tok-a' } }, { id: 'tok-b', data: { token: 'tok-b' } }];
      }
      return [];
    });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).toHaveBeenCalledTimes(2);
    expect(mockSendPush).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-a', title: 'Workout time' }),
    );
  });

  it('does not fire the workout reminder again once lastSentDate matches today', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      if (path === 'users/uid1/reminderState/workout') return { lastSentDate: '2026-07-23' };
      return null;
    });
    mockListDocuments.mockResolvedValue([]);

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockPatchDocument).not.toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'users/uid1/reminderState/workout', expect.anything(),
    );
  });

  it('bundles due bill names into a single push and skips a completed chore', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      if (path === 'users/uid1/completions/2026-07-23') return { chores: { chore1: true } };
      return null;
    });
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/bills') return [{ id: 'b1', data: { name: 'Rent', amount: 1200, dueDay: 23, category: 'housing' } }];
      if (path === 'users/uid1/chores') {
        return [
          { id: 'chore1', data: { name: 'Dishes', cadence: 'daily' } },
          { id: 'chore2', data: { name: 'Trash', cadence: 'daily' } },
        ];
      }
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      return [];
    });

    await runReminderCheck(env, new Date('2026-07-23T07:30:00Z'));

    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bills due today', body: 'Rent' }));
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chores due today', body: 'Trash' }));
  });

  it('deletes a token that FCM reports as unregistered', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      return null;
    });
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/fcmTokens') return [{ id: 'stale-token', data: { token: 'stale-token' } }];
      return [];
    });
    mockSendPush.mockResolvedValue({ ok: false, invalidToken: true });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockDeleteDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid1/fcmTokens/stale-token');
  });
});
