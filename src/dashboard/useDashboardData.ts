import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { ChoreConfig, DailyCompletion, DueItem } from '../domains/shared/types';
import { todayId, dayOfWeek } from '../domains/shared/dateUtils';
import { computeStreak, computeDueItems, computeDayHealth } from './dashboardLogic';

const STREAK_HISTORY_DAYS = 30;

export interface DashboardData {
  loading: boolean;
  error: string | null;
  completion: DailyCompletion | null;
  chores: ChoreConfig[];
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

  useEffect(() => {
    Promise.all([
      getCompletion(uid),
      listRecentCompletions(uid, STREAK_HISTORY_DAYS),
      listChores(uid),
    ])
      .then(([todayCompletion, recentHistory, choreList]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
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
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 0,
      dayHealth: 0,
    };
  }

  const dow = dayOfWeek(todayId());
  const dueItems = computeDueItems(chores, completion, dow);
  const dueTodayChoreIds = chores
    .filter((c) => isChoreDueToday(c, dow))
    .map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds);

  return { loading, error, completion, chores, dueItems, dueTodayChoreIds, streak, dayHealth };
}
