import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ChoreConfig } from '../shared/types';

export async function listChores(uid: string): Promise<ChoreConfig[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'chores'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<ChoreConfig, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveChore(uid: string, chore: ChoreConfig): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'chores', chore.id), {
    name: chore.name,
    cadence: chore.cadence,
    weeklyDays: chore.weeklyDays ?? null,
    points: chore.points ?? 0,
    currentStreak: chore.currentStreak ?? 0,
    lastCompletedDate: chore.lastCompletedDate ?? null,
  });
}

export async function deleteChore(uid: string, choreId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'chores', choreId));
}

export function isChoreDueToday(chore: ChoreConfig, dow: number): boolean {
  if (chore.cadence === 'daily') return true;
  return chore.weeklyDays?.includes(dow) ?? false;
}
