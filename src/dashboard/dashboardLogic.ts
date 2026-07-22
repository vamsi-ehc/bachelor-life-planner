import { ChoreConfig, DailyCompletion, DueItem, Bill, GroceryItem } from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';
import { isBillDueToday } from '../domains/finances/billsApi';

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

export function computeDayHealth(completion: DailyCompletion, dueTodayChoreIds: string[]): number {
  const totalTasks = 2 + dueTodayChoreIds.length;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length;
  return totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
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
