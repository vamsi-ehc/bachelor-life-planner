import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MealLog } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function mealLogDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'mealLog', date);
}

export async function getMealLog(uid: string, date: string = todayId()): Promise<MealLog> {
  const snap = await getDoc(mealLogDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<MealLog>) : {};
  return { date, entries: Array.isArray(data.entries) ? data.entries : [] };
}

export async function addMealEntry(uid: string, entry: string, date: string = todayId()): Promise<void> {
  const current = await getMealLog(uid, date);
  await setDoc(mealLogDocRef(uid, date), { date, entries: [...current.entries, entry] });
}
