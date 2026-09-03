import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useNotificationPermission } from './useNotificationPermission';

describe('useNotificationPermission', () => {
  beforeEach(() => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
  });

  it('starts idle with no error when permission is not yet decided', () => {
    const { result } = renderHook(() => useNotificationPermission('user1'));
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('starts granted when the browser already granted permission', () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    const { result } = renderHook(() => useNotificationPermission('user1'));
    expect(result.current.status).toBe('granted');
  });

  it('starts denied when the browser already denied permission', () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    const { result } = renderHook(() => useNotificationPermission('user1'));
    expect(result.current.status).toBe('denied');
  });

  it('sets status to granted when the user allows the prompt', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') });
    const { result } = renderHook(() => useNotificationPermission('user1'));

    await act(async () => {
      await result.current.enable();
    });

    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('sets status to denied when the user dismisses the prompt', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('denied') });
    const { result } = renderHook(() => useNotificationPermission('user1'));

    await act(async () => {
      await result.current.enable();
    });

    await waitFor(() => expect(result.current.status).toBe('denied'));
  });

  it('sets an error when requesting permission throws', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockRejectedValue(new Error('prompt failed')),
    });
    const { result } = renderHook(() => useNotificationPermission('user1'));

    await act(async () => {
      await result.current.enable();
    });

    await waitFor(() => expect(result.current.error).toBe('prompt failed'));
  });
});
