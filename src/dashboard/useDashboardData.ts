import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { listBills } from '../domains/finances/billsApi';
import { listGroceryItems } from '../domains/meals/groceryApi';
import {
  ChoreConfig,
  DailyCompletion,
  DueItem,
  Bill,
  GroceryItem,
} from '../domains/shared/types';
import { todayId, dayOfWeek, dayOfMonth, daysInMonth } from '../domains/shared/dateUtils';
import {
  computeStreak,
  computeDueItems,
  computeDayHealth,
  computeBillDueItems,
  computeGroceryDueItem,
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
}

export function useDashboardData(uid: string): DashboardData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [history, setHistory] = useState<DailyCompletion[]>([]);
  const [chores, setChores] = useState<ChoreConfig[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);

  useEffect(() => {
    Promise.all([
      getCompletion(uid),
      listRecentCompletions(uid, STREAK_HISTORY_DAYS),
      listChores(uid),
      listBills(uid),
      listGroceryItems(uid),
    ])
      .then(([todayCompletion, recentHistory, choreList, billList, groceryList]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
        setBills(billList);
        setGroceryItems(groceryList);
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
    };
  }

  const dow = dayOfWeek(todayId());
  const domNow = dayOfMonth(todayId());
  const dimNow = daysInMonth(todayId());
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
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
  };
}
