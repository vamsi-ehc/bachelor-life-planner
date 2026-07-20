import { ChoreConfig, DailyCompletion, DueItem } from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';

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
