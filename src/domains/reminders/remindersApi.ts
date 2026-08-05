import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { CustomReminder } from '../shared/types';

export async function listCustomReminders(uid: string): Promise<CustomReminder[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'customReminders'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<CustomReminder, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveCustomReminder(uid: string, reminder: CustomReminder): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'customReminders', reminder.id), {
    label: reminder.label,
    time: reminder.time,
    cadence: reminder.cadence,
    weeklyDays: reminder.weeklyDays ?? null,
    points: reminder.points ?? 0,
    currentStreak: reminder.currentStreak ?? 0,
    lastCompletedDate: reminder.lastCompletedDate ?? null,
  });
}

export async function deleteCustomReminder(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'customReminders', id));
}

export function isCustomReminderDueToday(reminder: CustomReminder, dow: number): boolean {
  if (reminder.cadence === 'daily') return true;
  return reminder.weeklyDays?.includes(dow) ?? false;
}
