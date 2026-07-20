export type DomainKey = 'workout' | 'learning' | 'chores';

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
