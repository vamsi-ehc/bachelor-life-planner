import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { CustomReminder } from '../shared/types';

export async function listCustomReminders(uid: string): Promise<CustomReminder[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'customReminders'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomReminder, 'id'>) }));
}

export async function saveCustomReminder(uid: string, reminder: CustomReminder): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'customReminders', reminder.id), {
    label: reminder.label,
    time: reminder.time,
    cadence: reminder.cadence,
    weeklyDays: reminder.weeklyDays ?? null,
  });
}

export async function deleteCustomReminder(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'customReminders', id));
}

export function isCustomReminderDueToday(reminder: CustomReminder, dow: number): boolean {
  if (reminder.cadence === 'daily') return true;
  return reminder.weeklyDays?.includes(dow) ?? false;
}
