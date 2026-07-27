export type TutorialScreenKey =
  | 'dashboard'
  | 'workout'
  | 'learning'
  | 'chores'
  | 'finances'
  | 'meals'
  | 'health'
  | 'goals'
  | 'settings';

export const TUTORIAL_SCREEN_KEYS: TutorialScreenKey[] = [
  'dashboard',
  'workout',
  'learning',
  'chores',
  'finances',
  'meals',
  'health',
  'goals',
  'settings',
];

export type TutorialFlags = Record<TutorialScreenKey, boolean>;

export interface TutorialStep {
  title: string;
  body: string;
  targetId?: string;
}
