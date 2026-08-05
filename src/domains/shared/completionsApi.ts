import { collection, doc, getDoc, getDocs, orderBy, limit, query, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DailyCompletion } from './types';
import { todayId } from './dateUtils';

export function completionDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'completions', date);
}

export async function getCompletion(uid: string, date: string = todayId()): Promise<DailyCompletion> {
  const snap = await getDoc(completionDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<DailyCompletion>) : {};
  return {
    date,
    workout: data.workout ?? false,
    learning: data.learning ?? false,
    chores: data.chores ?? {},
    reminders: data.reminders ?? {},
  };
}

export async function listRecentCompletions(uid: string, days: number): Promise<DailyCompletion[]> {
  const q = query(
    collection(db, 'users', uid, 'completions'),
    orderBy('date', 'desc'),
    limit(days)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DailyCompletion);
}

export async function setWorkoutDone(uid: string, done: boolean, date: string = todayId()): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, workout: done }, { merge: true });
}

export async function setLearningDone(uid: string, done: boolean, date: string = todayId()): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, learning: done }, { merge: true });
}

export async function setChoreDone(
  uid: string,
  choreId: string,
  done: boolean,
  date: string = todayId()
): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, chores: { [choreId]: done } }, { merge: true });
}

export async function setReminderDone(
  uid: string,
  reminderId: string,
  done: boolean,
  date: string = todayId()
): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, reminders: { [reminderId]: done } }, { merge: true });
}
