import { TutorialScreenKey, TutorialStep } from './types';

export const tutorialContent: Record<TutorialScreenKey, TutorialStep[]> = {
  dashboard: [
    {
      title: 'Your day at a glance',
      body: "The activity rings and day health % show how much of today you've completed across every domain.",
      targetId: 'dashboard-rings',
    },
    {
      title: 'Keep your streak',
      body: 'The streak counter tracks consecutive days you hit your day health goal.',
      targetId: 'dashboard-streak',
    },
    {
      title: 'Trend chart',
      body: 'The trend chart shows your day health over the last several days.',
      targetId: 'dashboard-trend',
    },
    {
      title: 'Consistency heatmap',
      body: 'The consistency heatmap shows your health history at a glance over a longer stretch of time.',
      targetId: 'dashboard-heatmap',
    },
    {
      title: 'Jump into a domain',
      body: 'Tap any domain row to open that screen.',
      targetId: 'dashboard-domains',
    },
    {
      title: 'Due now',
      body: 'The Due now strip surfaces anything due today across all domains.',
      targetId: 'dashboard-duenow',
    },
  ],
  workout: [
    { title: 'Punch in', body: "Tap Punch In to mark today's workout done.", targetId: 'workout-punchin' },
    {
      title: 'Log a workout',
      body: "Name your workout, add exercises, and log each set's reps and weight to keep a history.",
      targetId: 'workout-form',
    },
  ],
  learning: [
    { title: 'Punch in', body: "Tap Punch In to mark today's learning done.", targetId: 'learning-punchin' },
    { title: 'Add a note', body: 'Add a note on what you studied to keep a history.', targetId: 'learning-form' },
  ],
  chores: [
    { title: 'Check off chores', body: 'Check off chores due today as you finish them.', targetId: 'chores-list' },
    { title: 'Add a chore', body: 'Add a new recurring chore to track going forward.', targetId: 'chores-form' },
  ],
  finances: [
    {
      title: 'Log a transaction',
      body: 'Log a transaction with amount, category, and whether it is income or an expense.',
      targetId: 'finances-transactions',
    },
    {
      title: 'Set a budget',
      body: 'Set a monthly budget per category and watch the bar fill as you spend.',
      targetId: 'finances-budgets',
    },
    {
      title: 'Track bills',
      body: 'Add a bill with its due day to get a "Due today" flag when it is due.',
      targetId: 'finances-bills',
    },
  ],
  meals: [
    {
      title: 'Grocery list',
      body: 'Check off grocery items as you buy them, and add new items to the list.',
      targetId: 'meals-grocery',
    },
    { title: 'Log your meals', body: 'Log what you ate today to keep a history.', targetId: 'meals-log' },
  ],
  health: [
    {
      title: 'Track sleep',
      body: "Save tonight's bedtime and wake time to track sleep duration.",
      targetId: 'health-sleep',
    },
    {
      title: 'Track weight',
      body: 'Log your weight to see the change since your last entry.',
      targetId: 'health-weight',
    },
  ],
  goals: [
    {
      title: 'Add a goal',
      body: 'Add a goal with a target date and comma-separated milestones.',
      targetId: 'goals-add',
    },
    {
      title: 'Track milestones',
      body: 'Check off milestones as you complete them.',
      targetId: 'goals-list',
    },
    {
      title: 'Weekly review',
      body: 'Fill out the weekly review (what went well / badly / focus next) when it is due.',
      targetId: 'goals-review',
    },
  ],
  settings: [
    {
      title: 'Reminders',
      body: 'Set reminder times for workout, dinner, learning, and the weekly review.',
      targetId: 'settings-reminders',
    },
    {
      title: 'Replay tutorials',
      body: 'Replay tutorials from here any time using the button below.',
      targetId: 'settings-replay',
    },
  ],
};
