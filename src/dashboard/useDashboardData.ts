import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { listBills } from '../domains/finances/billsApi';
import { listGroceryItems } from '../domains/meals/groceryApi';
import { getSleepLog } from '../domains/health/sleepApi';
import { listGoals } from '../domains/goals/goalsApi';
import { getWeeklyReview } from '../domains/goals/weeklyReviewApi';
import {
  ChoreConfig,
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
  computeDayHealth,
  computeBillDueItems,
  computeGroceryDueItem,
  computeWeeklyReviewDueItem,
} from './dashboardLogic';

const STREAK_HISTORY_DAYS = 30;

export interface DashboardData {
  loading: boolean;
  error: string | null;
  completion: DailyCompletion | null;
  chores: ChoreConfig[];
  bills: Bill[];
  groceryItems: GroceryItem[];
  dueItems: DueItem[];
  dueTodayChoreIds: string[];
  streak: number;
  dayHealth: number;
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
      getSleepLog(uid),
      listGoals(uid),
      getWeeklyReview(uid, weekId(todayId())),
    ])
      .then(([todayCompletion, recentHistory, choreList, billList, groceryList, sleep, goalList, review]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
        setBills(billList);
        setGroceryItems(groceryList);
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
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 0,
      dayHealth: 0,
      sleepLog: null,
      goals: [],
      weeklyReview: null,
    };
  }

  const dow = dayOfWeek(todayId());
  const domNow = dayOfMonth(todayId());
  const dimNow = daysInMonth(todayId());
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
    ...computeWeeklyReviewDueItem(dow, weeklyReview),
  ];
  const dueTodayChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds);

  return {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    dueItems,
    dueTodayChoreIds,
    streak,
    dayHealth,
    sleepLog,
    goals,
    weeklyReview,
  };
}
