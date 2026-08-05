import { describe, it, expect } from 'vitest';
import { parseHHMM, shouldFireDaily, shouldFireWeekly } from './reminders';

describe('parseHHMM', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(parseHHMM('06:45')).toBe(405);
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('23:59')).toBe(1439);
  });
});

describe('shouldFireDaily', () => {
  it('fires when now is within the window of the configured time and not already sent today', () => {
    const now = new Date('2026-07-23T06:46:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', null);
    expect(result).toEqual({ fire: true, todayId: '2026-07-23' });
  });

  it('does not fire when outside the window', () => {
    const now = new Date('2026-07-23T07:30:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', null);
    expect(result.fire).toBe(false);
  });

  it('does not fire twice on the same day even if within the window', () => {
    const now = new Date('2026-07-23T06:46:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', '2026-07-23');
    expect(result.fire).toBe(false);
  });

  it('fires again on a new day', () => {
    const now = new Date('2026-07-24T06:46:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', '2026-07-23');
    expect(result).toEqual({ fire: true, todayId: '2026-07-24' });
  });
});

describe('shouldFireWeekly', () => {
  it('fires on the target weekday within the time window', () => {
    // 2026-07-19 is a Sunday
    const now = new Date('2026-07-19T18:01:00Z');
    const result = shouldFireWeekly(now, 'UTC', '18:00', 0, null);
    expect(result).toEqual({ fire: true, todayId: '2026-07-19' });
  });

  it('does not fire on a non-target weekday', () => {
    const now = new Date('2026-07-20T18:01:00Z'); // Monday
    const result = shouldFireWeekly(now, 'UTC', '18:00', 0, null);
    expect(result.fire).toBe(false);
  });
});
