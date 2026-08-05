import { useEffect } from 'react';
import { getReminderConfig } from '../domains/settings/reminderConfigApi';
import { listCustomReminders, isCustomReminderDueToday } from '../domains/reminders/remindersApi';
import { ReminderConfig } from '../domains/shared/types';
import { localDateId, todayFireTime } from './localReminderScheduler';

interface LocalReminderDef {
  key: string;
  getTime: (config: ReminderConfig) => string;
  title: string;
  body: string;
  weekdayOnly?: number;
}

const LOCAL_REMINDERS: LocalReminderDef[] = [
  { key: 'workout', getTime: (c) => c.workoutTime, title: 'Workout time', body: "It's time for your workout." },
  { key: 'dinner', getTime: (c) => c.dinnerTime, title: 'Dinner prep', body: 'Time to start prepping dinner.' },
  {
    key: 'learning',
    getTime: (c) => c.learningTime,
    title: 'Learning time',
    body: "It's time for your learning session.",
  },
  {
    key: 'weeklyReview',
    getTime: (c) => c.weeklyReviewTime,
    title: 'Weekly review',
    body: 'Time for your weekly review.',
    weekdayOnly: 0,
  },
];

function shownKey(key: string, dateId: string): string {
  return `reminder:${key}:${dateId}`;
}

export function useLocalReminderScheduler(uid: string | null): void {
  useEffect(() => {
    if (!uid) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    let cancelled = false;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    Promise.all([getReminderConfig(uid), listCustomReminders(uid)]).then(([config, customReminders]) => {
      if (cancelled) return;
      const now = new Date();
      const dateId = localDateId(now);

      function scheduleIfDue(key: string, time: string, title: string, body: string) {
        if (localStorage.getItem(shownKey(key, dateId))) return;
        const fireAt = todayFireTime(time, now);
        if (!fireAt) return;

        const delay = fireAt.getTime() - now.getTime();
        const timeoutId = setTimeout(() => {
          localStorage.setItem(shownKey(key, dateId), '1');
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              tag: `${key}-${dateId}`,
              icon: '/icons/icon-192.png',
            });
          });
        }, delay);
        timeoutIds.push(timeoutId);
      }

      for (const reminder of LOCAL_REMINDERS) {
        if (reminder.weekdayOnly !== undefined && now.getDay() !== reminder.weekdayOnly) continue;
        scheduleIfDue(reminder.key, reminder.getTime(config), reminder.title, reminder.body);
      }

      for (const reminder of customReminders) {
        if (!isCustomReminderDueToday(reminder, now.getDay())) continue;
        scheduleIfDue(reminder.id, reminder.time, 'Reminder', reminder.label);
      }
    });

    return () => {
      cancelled = true;
      timeoutIds.forEach(clearTimeout);
    };
  }, [uid]);
}
