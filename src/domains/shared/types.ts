export type DomainKey = 'workout' | 'learning' | 'chores' | 'finances' | 'meals';

export interface DailyCompletion {
  date: string;
  workout: boolean;
  learning: boolean;
  chores: Record<string, boolean>;
}

export interface ChoreConfig {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}

export interface WorkoutLogEntry {
  id: string;
  date: string;
  exercise: string;
  detail: string;
  notes?: string;
}

export interface LearningLogEntry {
  id: string;
  date: string;
  note: string;
}

export interface DueItem {
  id: string;
  label: string;
  domain: DomainKey;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
  note?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
}

export interface Budget {
  category: string;
  monthlyLimit: number;
}

export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface MealLog {
  date: string;
  entries: string[];
}
