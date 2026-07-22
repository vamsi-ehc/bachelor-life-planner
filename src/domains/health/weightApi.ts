import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WeightEntry } from '../shared/types';

export async function addWeightEntry(uid: string, entry: Omit<WeightEntry, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'weightEntries'), entry);
  return ref.id;
}

export async function listWeightEntries(uid: string): Promise<WeightEntry[]> {
  const q = query(collection(db, 'users', uid, 'weightEntries'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<WeightEntry, 'id'>>;
    return {
      id: d.id,
      date: data.date ?? '',
      weightKg: typeof data.weightKg === 'number' ? data.weightKg : 0,
    };
  });
}
