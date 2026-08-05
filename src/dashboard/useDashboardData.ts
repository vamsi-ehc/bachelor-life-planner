import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { listCustomReminders, isCustomReminderDueToday } from '../domains/reminders/remindersApi';
import { listBills } from '../domains/finances/billsApi';
import { listGroceryItems } from '../domains/meals/groceryApi';
import { getSleepLog } from '../domains/health/sleepApi';
import { listGoals } from '../domains/goals/goalsApi';
import { getWeeklyReview } from '../domains/goals/weeklyReviewApi';
import { listWorkoutRoutines, isWorkoutRoutineDueToday } from '../domains/workout/workoutRoutinesApi';
import { listWorkoutLogEntries } from '../domains/workout/workoutApi';
import { listLearningPlans, isLearningPlanDueToday } from '../domains/learning/learningPlansApi';
import { listLearningLogEntries } from '../domains/learning/learningApi';
import { listHealthPlans, isHealthPlanDueToday } from '../domains/health/healthPlansApi';
import { listWeightEntries } from '../domains/health/weightApi';
import { listMealPlans, isMealPlanDueToday } from '../domains/meals/mealPlansApi';
import { getMealLog } from '../domains/meals/mealLogApi';
import {
  ChoreConfig,
  CustomReminder,
  DailyCompletion,
  DueItem,
  Bill,
  GroceryItem,
  SleepLog,
  Goal,
  WeeklyReview,
  WorkoutRoutine,
  WorkoutLogEntry,
  LearningPlan,
  LearningLogEntry,
  HealthPlan,
  MealPlan,
} from '../domains/shared/types';
import { todayId, dayOfWeek, dayOfMonth, daysInMonth, weekId } from '../domains/shared/dateUtils';
import {
  computeStreak,
  computeDueItems,
  computeReminderDueItems,
  computeDayHealth,
  computeDayHealthHistory,
  computeBillDueItems,
  computeGroceryDueItem,
  computeWeeklyReviewDueItem,
  computeWorkoutDueItems,
  computeLearningPlanDueItems,
  computeHealthPlanDueItems,
  computeMealPlanDueItems,
  DayHealthPoint,
} from './dashboardLogic';

const STREAK_HISTORY_DAYS = 70;

export interface DashboardData {
  loading: boolean;
  error: string | null;
  completion: DailyCompletion | null;
  chores: ChoreConfig[];
  bills: Bill[];
  groceryItems: GroceryItem[];
  reminders: CustomReminder[];
  dueItems: DueItem[];
  dueTodayChoreIds: string[];
  dueTodayReminderIds: string[];
  streak: number;
  dayHealth: number;
  healthHistory: DayHealthPoint[];
  sleepLog: SleepLog | null;
  goals: Goal[];
  weeklyReview: WeeklyReview | null;
}

export function useDashboardData(uid: string): DashboardData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [history, setHistory] = useState<DailyCompletion[]>([]);
  const [chores, setChores] = useState<ChoreConfig[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [reminders, setReminders] = useState<CustomReminder[]>([]);
  const [sleepLog, setSleepLog] = useState<SleepLog | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null);
  const [workoutRoutines, setWorkoutRoutines] = useState<WorkoutRoutine[]>([]);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutLogEntry[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [learningEntries, setLearningEntries] = useState<LearningLogEntry[]>([]);
  const [healthPlans, setHealthPlans] = useState<HealthPlan[]>([]);
  const [weightEntryDates, setWeightEntryDates] = useState<string[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [mealLogHasToday, setMealLogHasToday] = useState(false);

  useEffect(() => {
    Promise.all([
      getCompletion(uid),
      listRecentCompletions(uid, STREAK_HISTORY_DAYS),
      listChores(uid),
      listBills(uid),
      listGroceryItems(uid),
      listCustomReminders(uid),
      getSleepLog(uid),
      listGoals(uid),
      getWeeklyReview(uid, weekId(todayId())),
      listWorkoutRoutines(uid),
      listWorkoutLogEntries(uid),
      listLearningPlans(uid),
      listLearningLogEntries(uid),
      listHealthPlans(uid),
      listWeightEntries(uid),
      listMealPlans(uid),
      getMealLog(uid),
    ])
      .then(
        ([
          todayCompletion,
          recentHistory,
          choreList,
          billList,
          groceryList,
          reminderList,
          sleep,
          goalList,
          review,
          routineList,
          workoutEntryList,
          learningPlanList,
          learningEntryList,
          healthPlanList,
          weightEntryList,
          mealPlanList,
          mealLog,
        ]) => {
          setCompletion(todayCompletion);
          setHistory(recentHistory);
          setChores(choreList);
          setBills(billList);
          setGroceryItems(groceryList);
          setReminders(reminderList);
          setSleepLog(sleep);
          setGoals(goalList);
          setWeeklyReview(review);
          setWorkoutRoutines(routineList);
          setWorkoutEntries(workoutEntryList);
          setLearningPlans(learningPlanList);
          setLearningEntries(learningEntryList);
          setHealthPlans(healthPlanList);
          setWeightEntryDates(weightEntryList.map((w) => w.date));
          setMealPlans(mealPlanList);
          setMealLogHasToday(mealLog.entries.length > 0);
          setLoading(false);
        }
      )
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      });
  }, [uid]);

  if (!completion) {
    return {
      loading,
      error,
      completion: null,
      chores: [],
      bills: [],
      groceryItems: [],
      reminders: [],
      dueItems: [],
      dueTodayChoreIds: [],
      dueTodayReminderIds: [],
      streak: 0,
      dayHealth: 0,
      healthHistory: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
    };
  }

  const dow = dayOfWeek(todayId());
  const domNow = dayOfMonth(todayId());
  const dimNow = daysInMonth(todayId());
  const dueTodayReminderIds = reminders.filter((r) => isCustomReminderDueToday(r, dow)).map((r) => r.id);
  const hasLoggedWorkoutToday = workoutEntries.some((e) => e.date === todayId());
  const hasLoggedLearningToday = learningEntries.some((e) => e.date === todayId());
  // Note: getSleepLog always returns an object stamped with today's date even when
  // nothing was saved (it defaults bedtime/wakeTime to ''), so `sleepLog.date` alone
  // can't signal whether today's sleep was actually logged — check the fields instead.
  const hasLoggedHealthToday =
    weightEntryDates.includes(todayId()) || Boolean(sleepLog?.bedtime && sleepLog?.wakeTime);
  const dueTodayWorkoutIds = workoutRoutines.filter((r) => isWorkoutRoutineDueToday(r, dow)).map((r) => r.id);
  const dueTodayLearningPlanIds = learningPlans.filter((p) => isLearningPlanDueToday(p, dow)).map((p) => p.id);
  const dueTodayHealthPlanIds = healthPlans.filter((p) => isHealthPlanDueToday(p, dow)).map((p) => p.id);
  const dueTodayMealPlanIds = mealPlans.filter((p) => isMealPlanDueToday(p, dow)).map((p) => p.id);
  const dueTodayPlanDomains = [
    { domain: 'workout', ids: dueTodayWorkoutIds, done: hasLoggedWorkoutToday },
    { domain: 'learning', ids: dueTodayLearningPlanIds, done: hasLoggedLearningToday },
    { domain: 'health', ids: dueTodayHealthPlanIds, done: hasLoggedHealthToday },
    { domain: 'meals', ids: dueTodayMealPlanIds, done: mealLogHasToday },
  ];
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeReminderDueItems(reminders, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
    ...computeWeeklyReviewDueItem(dow, weeklyReview),
    ...computeWorkoutDueItems(workoutRoutines, hasLoggedWorkoutToday, dow),
    ...computeLearningPlanDueItems(learningPlans, hasLoggedLearningToday, dow),
    ...computeHealthPlanDueItems(healthPlans, hasLoggedHealthToday, dow),
    ...computeMealPlanDueItems(mealPlans, mealLogHasToday, dow),
  ];
  const dueTodayChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds, dueTodayReminderIds, dueTodayPlanDomains);
  const healthHistory = computeDayHealthHistory(history, chores, reminders);

  return {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    reminders,
    dueItems,
    dueTodayChoreIds,
    dueTodayReminderIds,
    streak,
    dayHealth,
    healthHistory,
    sleepLog,
    goals,
    weeklyReview,
  };
}
