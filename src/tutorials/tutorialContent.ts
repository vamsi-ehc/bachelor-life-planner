import { TutorialScreenKey, TutorialStep } from './types';

export const tutorialContent: Record<TutorialScreenKey, TutorialStep[]> = {
  dashboard: [
    {
      title: 'Your day at a glance',
      body: "The activity rings and day health % show how much of today you've completed across every domain.",
    },
    {
      title: 'Keep your streak',
      body: 'The streak counter tracks consecutive days you hit your day health goal.',
    },
    {
      title: 'Trends and consistency',
      body: 'The trend chart and consistency heatmap show your health history over time.',
    },
    {
      title: 'Jump in',
      body: 'Tap any domain row to open that screen. The "Due now" strip surfaces anything due today across all domains.',
    },
  ],
  workout: [
    { title: 'Punch in', body: "Tap Punch In to mark today's workout done." },
    { title: 'Log an exercise', body: 'Add an exercise and detail (e.g. "3x10" or "30 min") to keep a history.' },
  ],
  learning: [
    { title: 'Punch in', body: "Tap Punch In to mark today's learning done." },
    { title: 'Add a note', body: 'Add a note on what you studied to keep a history.' },
  ],
  chores: [
    { title: 'Check off chores', body: 'Check off chores due today as you finish them.' },
    { title: 'Add a chore', body: 'Add a new recurring chore to track going forward.' },
  ],
  finances: [
    { title: 'Log a transaction', body: 'Log a transaction with amount, category, and whether it is income or an expense.' },
    { title: 'Set a budget', body: 'Set a monthly budget per category and watch the bar fill as you spend.' },
    { title: 'Track bills', body: 'Add a bill with its due day to get a "Due today" flag when it is due.' },
  ],
  meals: [
    { title: 'Grocery list', body: 'Check off grocery items as you buy them, and add new items to the list.' },
    { title: 'Log your meals', body: 'Log what you ate today to keep a history.' },
  ],
  health: [
    { title: 'Track sleep', body: "Save tonight's bedtime and wake time to track sleep duration." },
    { title: 'Track weight', body: 'Log your weight to see the change since your last entry.' },
  ],
  goals: [
    { title: 'Add a goal', body: 'Add a goal with a target date and comma-separated milestones.' },
    { title: 'Track milestones', body: 'Check off milestones as you complete them.' },
    { title: 'Weekly review', body: 'Fill out the weekly review (what went well / badly / focus next) when it is due.' },
  ],
  settings: [
    { title: 'Reminders', body: 'Set reminder times for workout, dinner, learning, and the weekly review.' },
    { title: 'Replay tutorials', body: 'Replay tutorials from here any time using the button below.' },
  ],
};
