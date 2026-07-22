import { useDashboardData } from './useDashboardData';
import { StatusChip } from '../components/StatusChip';
import { DueNowStrip } from './DueNowStrip';
import { isBillDueToday } from '../domains/finances/billsApi';
import { todayId, dayOfMonth, daysInMonth, dayOfWeek } from '../domains/shared/dateUtils';
import { computeSleepDurationHours } from '../domains/health/healthLogic';
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';

export function Dashboard({ uid, onNavigate }: { uid: string; onNavigate: (path: string) => void }) {
  const {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    sleepLog,
    goals,
    weeklyReview,
    dueItems,
    dueTodayChoreIds,
    streak,
    dayHealth,
  } = useDashboardData(uid);

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (loading || !completion) {
    return <p className="p-6">Loading...</p>;
  }

  const dueTodayChores = chores.filter((c) => dueTodayChoreIds.includes(c.id));
  const choresDoneCount = dueTodayChores.filter((c) => completion.chores[c.id]).length;

  const domNow = dayOfMonth(todayId());
  const dimNow = daysInMonth(todayId());
  const billsDueToday = bills.filter((b) => isBillDueToday(b, domNow, dimNow));
  const uncheckedGroceryCount = groceryItems.filter((item) => !item.checked).length;

  const sleepDuration =
    sleepLog?.bedtime && sleepLog?.wakeTime
      ? computeSleepDurationHours(sleepLog.bedtime, sleepLog.wakeTime)
      : null;
  const dow = dayOfWeek(todayId());
  const reviewDue = isWeeklyReviewDue(dow, weeklyReview);
  const activeGoalsCount = goals.filter((g) => g.status === 'active').length;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <p className="text-sm text-gray-500">{completion.date}</p>
        <p className="text-3xl font-bold">Streak: {streak}</p>
        <p className="text-lg">{dayHealth}% of today done</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        <StatusChip
          label="Workout"
          status={completion.workout ? 'done' : 'not-started'}
          onClick={() => onNavigate('/workout')}
        />
        <StatusChip
          label="Learning"
          status={completion.learning ? 'done' : 'not-started'}
          onClick={() => onNavigate('/learning')}
        />
        <StatusChip
          label="Chores"
          status={
            dueTodayChores.length === 0
              ? 'not-started'
              : choresDoneCount === dueTodayChores.length
                ? 'done'
                : 'in-progress'
          }
          detail={`${choresDoneCount}/${dueTodayChores.length}`}
          onClick={() => onNavigate('/chores')}
        />
        <StatusChip
          label="Finances"
          status={billsDueToday.length > 0 ? 'in-progress' : 'done'}
          detail={billsDueToday.length > 0 ? `${billsDueToday.length} bill(s) due` : 'No bills due'}
          onClick={() => onNavigate('/finances')}
        />
        <StatusChip
          label="Meals"
          status={uncheckedGroceryCount > 0 ? 'in-progress' : 'done'}
          detail={`${uncheckedGroceryCount} to buy`}
          onClick={() => onNavigate('/meals')}
        />
        <StatusChip
          label="Health"
          status={sleepDuration !== null ? 'done' : 'not-started'}
          detail={sleepDuration !== null ? `${sleepDuration}h slept` : 'Not logged'}
          onClick={() => onNavigate('/health')}
        />
        <StatusChip
          label="Goals"
          status={reviewDue ? 'in-progress' : 'done'}
          detail={reviewDue ? 'Review due' : `${activeGoalsCount} active`}
          onClick={() => onNavigate('/goals')}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Due now</h2>
        <DueNowStrip items={dueItems} />
      </div>
    </div>
  );
}
