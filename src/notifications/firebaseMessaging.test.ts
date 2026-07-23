import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsSupported = vi.fn();
const mockGetMessaging = vi.fn((..._args: unknown[]) => ({}));
const mockGetToken = vi.fn();

vi.mock('firebase/messaging', () => ({
  isSupported: () => mockIsSupported(),
  getMessaging: (...args: unknown[]) => mockGetMessaging(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));
vi.mock('../firebase/config', () => ({ app: {} }));

import { requestPushToken } from './firebaseMessaging';

describe('requestPushToken', () => {
  const mockRequestPermission = vi.fn();
  const mockRegistration = {};

  beforeEach(() => {
    mockIsSupported.mockReset();
    mockGetToken.mockReset();
    mockRequestPermission.mockReset();
    vi.stubGlobal('Notification', { requestPermission: mockRequestPermission });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
    });
  });

  it('returns null when messaging is not supported', async () => {
    mockIsSupported.mockResolvedValue(false);
    const token = await requestPushToken('vapid-key');
    expect(token).toBeNull();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue('denied');
    const token = await requestPushToken('vapid-key');
    expect(token).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('returns the token when permission is granted', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue('granted');
    mockGetToken.mockResolvedValue('device-token');
    const token = await requestPushToken('vapid-key');
    expect(token).toBe('device-token');
    expect(mockGetToken).toHaveBeenCalledWith(expect.anything(), {
      vapidKey: 'vapid-key',
      serviceWorkerRegistration: mockRegistration,
    });
  });
});
