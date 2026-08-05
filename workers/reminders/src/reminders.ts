import { zonedDateId, zonedMinutesSinceMidnight, zonedWeekday } from './dateUtils';

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export interface FireCheck {
  fire: boolean;
  todayId: string;
}

export function shouldFireDaily(
  now: Date,
  timeZone: string,
  configuredTime: string,
  lastSentDate: string | null,
  windowMinutes = 2,
): FireCheck {
  const todayId = zonedDateId(now, timeZone);
  if (lastSentDate === todayId) return { fire: false, todayId };
  const diff = Math.abs(zonedMinutesSinceMidnight(now, timeZone) - parseHHMM(configuredTime));
  return { fire: diff < windowMinutes, todayId };
}

export function shouldFireWeekly(
  now: Date,
  timeZone: string,
  configuredTime: string,
  targetWeekday: number,
  lastSentDate: string | null,
  windowMinutes = 2,
): FireCheck {
  const todayId = zonedDateId(now, timeZone);
  if (lastSentDate === todayId) return { fire: false, todayId };
  if (zonedWeekday(now, timeZone) !== targetWeekday) return { fire: false, todayId };
  const diff = Math.abs(zonedMinutesSinceMidnight(now, timeZone) - parseHHMM(configuredTime));
  return { fire: diff < windowMinutes, todayId };
}
