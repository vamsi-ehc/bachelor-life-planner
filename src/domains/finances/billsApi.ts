import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Bill } from '../shared/types';

export async function listBills(uid: string): Promise<Bill[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'bills'));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<Bill, 'id'>>;
    return {
      id: d.id,
      name: data.name ?? '',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      dueDay: typeof data.dueDay === 'number' ? data.dueDay : 0,
      category: data.category ?? '',
    };
  });
}

export async function saveBill(uid: string, bill: Bill): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'bills', bill.id), {
    name: bill.name,
    amount: bill.amount,
    dueDay: bill.dueDay,
    category: bill.category,
  });
}

export function isBillDueToday(bill: Bill, dayOfMonth: number, daysInMonth: number): boolean {
  return bill.dueDay === dayOfMonth || (dayOfMonth === daysInMonth && bill.dueDay > daysInMonth);
}
