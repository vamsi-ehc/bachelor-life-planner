import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Budget } from '../shared/types';

export async function listBudgets(uid: string): Promise<Budget[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'budgets'));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<Budget, 'category'>>;
    return {
      category: d.id,
      monthlyLimit: typeof data.monthlyLimit === 'number' ? data.monthlyLimit : 0,
    };
  });
}

export async function saveBudget(uid: string, budget: Budget): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'budgets', budget.category), { monthlyLimit: budget.monthlyLimit });
}
