import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockGetReminderConfig = vi.fn();
vi.mock('../domains/settings/reminderConfigApi', () => ({
  getReminderConfig: (...args: unknown[]) => mockGetReminderConfig(...args),
}));

import { useLocalReminderScheduler } from './useLocalReminderScheduler';

const config = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

describe('useLocalReminderScheduler', () => {
  const mockShowNotification = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 6, 30, 0));
    mockGetReminderConfig.mockReset().mockResolvedValue(config);
    mockShowNotification.mockReset();
    localStorage.clear();
    vi.stubGlobal('Notification', { permission: 'granted' });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ showNotification: mockShowNotification }) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does nothing when uid is null', () => {
    renderHook(() => useLocalReminderScheduler(null));
    expect(mockGetReminderConfig).not.toHaveBeenCalled();
  });

  it('does nothing when permission is not granted', () => {
    vi.stubGlobal('Notification', { permission: 'default' });
    renderHook(() => useLocalReminderScheduler('user1'));
    expect(mockGetReminderConfig).not.toHaveBeenCalled();
  });

  it('schedules and fires a notification at the exact configured time', async () => {
    renderHook(() => useLocalReminderScheduler('user1'));
    await vi.waitFor(() => expect(mockGetReminderConfig).toHaveBeenCalledWith('user1'));
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Workout time',
      expect.objectContaining({ tag: 'workout-2026-07-23' }),
    );
  });

  it('does not schedule a reminder whose time already passed today', async () => {
    vi.setSystemTime(new Date(2026, 6, 23, 21, 0, 0));
    renderHook(() => useLocalReminderScheduler('user1'));
    await vi.waitFor(() => expect(mockGetReminderConfig).toHaveBeenCalledWith('user1'));
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('does not reschedule a reminder already shown today', async () => {
    localStorage.setItem('reminder:workout:2026-07-23', '1');
    renderHook(() => useLocalReminderScheduler('user1'));
    await vi.waitFor(() => expect(mockGetReminderConfig).toHaveBeenCalledWith('user1'));
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(mockShowNotification).not.toHaveBeenCalledWith('Workout time', expect.anything());
  });
});
