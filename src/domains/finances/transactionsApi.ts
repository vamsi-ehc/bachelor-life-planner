import { collection, query, where, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Transaction } from '../shared/types';

export async function addTransaction(uid: string, entry: Omit<Transaction, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'transactions'), entry);
  return ref.id;
}

export async function listTransactionsForMonth(uid: string, month: string): Promise<Transaction[]> {
  const q = query(
    collection(db, 'users', uid, 'transactions'),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<Transaction, 'id'>>;
    return {
      id: d.id,
      date: data.date ?? '',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      category: data.category ?? '',
      type: data.type === 'income' ? 'income' : 'expense',
      ...(data.note !== undefined && { note: data.note }),
    };
  });
}
