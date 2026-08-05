import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ReminderConfig } from '../shared/types';

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notificationsEnabled: true,
};

function reminderConfigDocRef(uid: string) {
  return doc(db, 'users', uid, 'config', 'reminders');
}

export async function getReminderConfig(uid: string): Promise<ReminderConfig> {
  const snap = await getDoc(reminderConfigDocRef(uid));
  if (!snap.exists()) return DEFAULT_REMINDER_CONFIG;
  const data = snap.data() as Partial<ReminderConfig>;
  return {
    workoutTime: data.workoutTime ?? DEFAULT_REMINDER_CONFIG.workoutTime,
    dinnerTime: data.dinnerTime ?? DEFAULT_REMINDER_CONFIG.dinnerTime,
    learningTime: data.learningTime ?? DEFAULT_REMINDER_CONFIG.learningTime,
    weeklyReviewTime: data.weeklyReviewTime ?? DEFAULT_REMINDER_CONFIG.weeklyReviewTime,
    timezone: data.timezone ?? DEFAULT_REMINDER_CONFIG.timezone,
    notificationsEnabled: data.notificationsEnabled ?? DEFAULT_REMINDER_CONFIG.notificationsEnabled,
  };
}

export async function saveReminderConfig(uid: string, config: ReminderConfig): Promise<void> {
  await setDoc(reminderConfigDocRef(uid), {
    workoutTime: config.workoutTime,
    dinnerTime: config.dinnerTime,
    learningTime: config.learningTime,
    weeklyReviewTime: config.weeklyReviewTime,
    timezone: config.timezone,
    notificationsEnabled: config.notificationsEnabled,
  });
}
