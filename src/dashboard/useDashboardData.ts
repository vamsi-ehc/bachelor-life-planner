import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { listCustomReminders, isCustomReminderDueToday } from '../domains/reminders/remindersApi';
import { listBills } from '../domains/finances/billsApi';
import { listGroceryItems } from '../domains/meals/groceryApi';
import { getSleepLog } from '../domains/health/sleepApi';
import { listGoals } from '../domains/goals/goalsApi';
import { getWeeklyReview } from '../domains/goals/weeklyReviewApi';
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
    ])
      .then(([todayCompletion, recentHistory, choreList, billList, groceryList, reminderList, sleep, goalList, review]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
        setBills(billList);
        setGroceryItems(groceryList);
        setReminders(reminderList);
        setSleepLog(sleep);
        setGoals(goalList);
        setWeeklyReview(review);
        setLoading(false);
      })
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
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeReminderDueItems(reminders, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
    ...computeWeeklyReviewDueItem(dow, weeklyReview),
  ];
  const dueTodayChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds, dueTodayReminderIds);
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
