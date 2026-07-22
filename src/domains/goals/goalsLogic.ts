import { Goal, WeeklyReview } from '../shared/types';

export function computeMilestoneProgress(goal: Goal): number {
  if (goal.milestones.length === 0) return 0;
  const doneCount = goal.milestones.filter((m) => m.done).length;
  return Math.round((doneCount / goal.milestones.length) * 100);
}

export function isWeeklyReviewDue(dow: number, review: WeeklyReview | null): boolean {
  return dow === 0 && review === null;
}
