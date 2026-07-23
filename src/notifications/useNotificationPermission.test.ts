import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockRequestPushToken = vi.fn();
const mockSaveFcmToken = vi.fn();

vi.mock('./firebaseMessaging', () => ({ requestPushToken: (...args: unknown[]) => mockRequestPushToken(...args) }));
vi.mock('./fcmTokensApi', () => ({ saveFcmToken: (...args: unknown[]) => mockSaveFcmToken(...args) }));

import { useNotificationPermission } from './useNotificationPermission';

describe('useNotificationPermission', () => {
  beforeEach(() => {
    mockRequestPushToken.mockReset();
    mockSaveFcmToken.mockReset().mockResolvedValue(undefined);
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useNotificationPermission('user1', 'vapid-key'));
    expect(result.current.status).toBe('idle');
  });

  it('sets status to granted and saves the token on success', async () => {
    mockRequestPushToken.mockResolvedValue('device-token');
    const { result } = renderHook(() => useNotificationPermission('user1', 'vapid-key'));

    await act(async () => {
      await result.current.enable();
    });

    expect(mockRequestPushToken).toHaveBeenCalledWith('vapid-key');
    expect(mockSaveFcmToken).toHaveBeenCalledWith('user1', 'device-token');
    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('sets status to denied when no token is returned', async () => {
    mockRequestPushToken.mockResolvedValue(null);
    const { result } = renderHook(() => useNotificationPermission('user1', 'vapid-key'));

    await act(async () => {
      await result.current.enable();
    });

    expect(mockSaveFcmToken).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.status).toBe('denied'));
  });
});
