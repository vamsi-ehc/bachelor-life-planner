import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LearningLogEntry } from '../shared/types';

export async function addLearningLogEntry(
  uid: string,
  entry: Omit<LearningLogEntry, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'learningLog'), entry);
  return ref.id;
}

export async function listLearningLogEntries(uid: string): Promise<LearningLogEntry[]> {
  const q = query(collection(db, 'users', uid, 'learningLog'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LearningLogEntry, 'id'>) }));
}
