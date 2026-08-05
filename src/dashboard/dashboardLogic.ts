import {
  ChoreConfig,
  CustomReminder,
  DailyCompletion,
  DueItem,
  Bill,
  GroceryItem,
  WeeklyReview,
  WorkoutRoutine,
  LearningPlan,
  HealthPlan,
  MealPlan,
} from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';
import { isCustomReminderDueToday } from '../domains/reminders/remindersApi';
import { isBillDueToday } from '../domains/finances/billsApi';
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';
import { isWorkoutRoutineDueToday } from '../domains/workout/workoutRoutinesApi';
import { isLearningPlanDueToday } from '../domains/learning/learningPlansApi';
import { isHealthPlanDueToday } from '../domains/health/healthPlansApi';
import { isMealPlanDueToday } from '../domains/meals/mealPlansApi';
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

export function computeWorkoutDueItems(routines: WorkoutRoutine[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return routines
    .filter((r) => isWorkoutRoutineDueToday(r, dow))
    .map((r) => ({ id: r.id, label: r.name, domain: 'workout' as const }));
}

export function computeLearningPlanDueItems(plans: LearningPlan[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return plans
    .filter((p) => isLearningPlanDueToday(p, dow))
    .map((p) => ({ id: p.id, label: p.topic, domain: 'learning' as const }));
}

export function computeHealthPlanDueItems(plans: HealthPlan[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return plans
    .filter((p) => isHealthPlanDueToday(p, dow))
    .map((p) => ({ id: p.id, label: p.label, domain: 'health' as const }));
}

export function computeMealPlanDueItems(plans: MealPlan[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return plans
    .filter((p) => isMealPlanDueToday(p, dow))
    .map((p) => ({ id: p.id, label: p.name, domain: 'meals' as const }));
}

export function computeDayHealth(
  completion: DailyCompletion,
  dueTodayChoreIds: string[],
  dueTodayReminderIds: string[] = [],
  dueTodayPlanDomains: { domain: string; ids: string[]; done: boolean }[] = []
): number {
  const planTaskCount = dueTodayPlanDomains.reduce((sum, d) => sum + d.ids.length, 0);
  const planDoneCount = dueTodayPlanDomains.reduce((sum, d) => sum + (d.done ? d.ids.length : 0), 0);
  const totalTasks = 2 + dueTodayChoreIds.length + dueTodayReminderIds.length + planTaskCount;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length +
    dueTodayReminderIds.filter((id) => completion.reminders[id]).length +
    planDoneCount;
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
