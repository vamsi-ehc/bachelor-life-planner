export type DomainKey = 'workout' | 'learning' | 'chores' | 'finances' | 'meals' | 'health' | 'goals' | 'reminders';

export interface DailyCompletion {
  date: string;
  workout: boolean;
  learning: boolean;
  chores: Record<string, boolean>;
  reminders: Record<string, boolean>;
}

export interface ChoreConfig {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface CustomReminder {
  id: string;
  label: string;
  time: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface WorkoutSet {
  reps: number;
  weightKg: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  moduleName: string;
  exercises: WorkoutExercise[];
}

export interface LegacyWorkoutLogEntry {
  id: string;
  date: string;
  exercise: string;
  detail: string;
  notes?: string;
}

export type WorkoutLogEntry = WorkoutSession | LegacyWorkoutLogEntry;

export function isLegacyWorkoutEntry(entry: WorkoutLogEntry): entry is LegacyWorkoutLogEntry {
  return 'exercise' in entry;
}

export interface LearningLogEntry {
  id: string;
  date: string;
  note: string;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  exercises: { id: string; name: string }[];
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface LearningPlan {
  id: string;
  topic: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface HealthPlan {
  id: string;
  label: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface MealPlan {
  id: string;
  name: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
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

export interface SleepLog {
  date: string;
  bedtime: string;
  wakeTime: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export interface Milestone {
  id: string;
  label: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  targetDate: string;
  status: 'active' | 'done';
  milestones: Milestone[];
}

export interface WeeklyReview {
  weekId: string;
  wentWell: string;
  wentBadly: string;
  focusNext: string;
}

export interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
  notificationsEnabled: boolean;
}
