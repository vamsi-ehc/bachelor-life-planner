import { ChoreConfig, CustomReminder, DailyCompletion, DueItem, Bill, GroceryItem, WeeklyReview } from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';
import { isCustomReminderDueToday } from '../domains/reminders/remindersApi';
import { isBillDueToday } from '../domains/finances/billsApi';
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';
import { dayOfWeek } from '../domains/shared/dateUtils';

export function computeStreak(completions: DailyCompletion[]): number {
  let streak = 0;
  for (const c of completions) {
    if (c.workout && c.learning) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function computeDueItems(
  chores: ChoreConfig[],
  completion: DailyCompletion,
  dow: number
): DueItem[] {
  return chores
    .filter((c) => isChoreDueToday(c, dow) && !completion.chores[c.id])
    .map((c) => ({ id: c.id, label: c.name, domain: 'chores' as const }));
}

export function computeReminderDueItems(
  reminders: CustomReminder[],
  completion: DailyCompletion,
  dow: number
): DueItem[] {
  return reminders
    .filter((r) => isCustomReminderDueToday(r, dow) && !completion.reminders[r.id])
    .map((r) => ({ id: r.id, label: r.label, domain: 'reminders' as const }));
}

export function computeDayHealth(
  completion: DailyCompletion,
  dueTodayChoreIds: string[],
  dueTodayReminderIds: string[] = []
): number {
  const totalTasks = 2 + dueTodayChoreIds.length + dueTodayReminderIds.length;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length +
    dueTodayReminderIds.filter((id) => completion.reminders[id]).length;
  return totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
}

export interface DayHealthPoint {
  date: string;
  value: number;
}

export function computeDayHealthHistory(
  history: DailyCompletion[],
  chores: ChoreConfig[],
  reminders: CustomReminder[] = []
): DayHealthPoint[] {
  return [...history]
    .reverse()
    .map((day) => {
      const dow = dayOfWeek(day.date);
      const dueChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
      const dueReminderIds = reminders.filter((r) => isCustomReminderDueToday(r, dow)).map((r) => r.id);
      return { date: day.date, value: computeDayHealth(day, dueChoreIds, dueReminderIds) };
    });
}

export function computeBillDueItems(bills: Bill[], dayOfMonth: number, daysInMonth: number): DueItem[] {
  return bills
    .filter((b) => isBillDueToday(b, dayOfMonth, daysInMonth))
    .map((b) => ({ id: b.id, label: `${b.name} due`, domain: 'finances' as const }));
}

export function computeGroceryDueItem(groceryItems: GroceryItem[]): DueItem[] {
  const uncheckedCount = groceryItems.filter((item) => !item.checked).length;
  if (uncheckedCount === 0) return [];
  const noun = uncheckedCount === 1 ? 'item' : 'items';
  return [
    {
      id: 'groceries-needed',
      label: `${uncheckedCount} grocery ${noun} needed`,
      domain: 'meals' as const,
    },
  ];
}

export function computeWeeklyReviewDueItem(dow: number, review: WeeklyReview | null): DueItem[] {
  if (!isWeeklyReviewDue(dow, review)) return [];
  return [{ id: 'weekly-review', label: 'Weekly review due', domain: 'goals' as const }];
}
