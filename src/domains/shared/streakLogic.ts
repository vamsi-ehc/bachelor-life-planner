import { todayId } from './dateUtils';

export function previousDueDateBefore(
  date: string,
  cadence: 'daily' | 'weekly',
  weeklyDays?: number[]
): string | undefined {
  const cursor = new Date(`${date}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (cadence === 'daily' || (weeklyDays?.includes(cursor.getDay()) ?? false)) {
      return todayId(cursor);
    }
  }
  return undefined;
}

interface StreakFields {
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

interface RecurrenceFields {
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}

export function applyCompletion<T extends StreakFields & RecurrenceFields>(
  item: T,
  completedDate: string
): { points: number; currentStreak: number; lastCompletedDate: string } {
  const prevDue = previousDueDateBefore(completedDate, item.cadence, item.weeklyDays);
  const continues = item.lastCompletedDate !== undefined && item.lastCompletedDate === prevDue;
  return {
    points: (item.points ?? 0) + 1,
    currentStreak: continues ? (item.currentStreak ?? 0) + 1 : 1,
    lastCompletedDate: completedDate,
  };
}
