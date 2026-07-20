import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WorkoutLogEntry } from '../shared/types';

export async function addWorkoutLogEntry(
  uid: string,
  entry: Omit<WorkoutLogEntry, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'workoutLog'), entry);
  return ref.id;
}

export async function listWorkoutLogEntries(uid: string): Promise<WorkoutLogEntry[]> {
  const q = query(collection(db, 'users', uid, 'workoutLog'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkoutLogEntry, 'id'>) }));
}
