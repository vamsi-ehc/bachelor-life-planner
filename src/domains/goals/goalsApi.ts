import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Goal } from '../shared/types';

export async function listGoals(uid: string): Promise<Goal[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'goals'));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<Goal, 'id'>>;
    return {
      id: d.id,
      title: data.title ?? '',
      targetDate: data.targetDate ?? '',
      status: data.status === 'done' ? 'done' : 'active',
      milestones: Array.isArray(data.milestones) ? data.milestones : [],
    };
  });
}

export async function saveGoal(uid: string, goal: Goal): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'goals', goal.id), {
    title: goal.title,
    targetDate: goal.targetDate,
    status: goal.status,
    milestones: goal.milestones,
  });
}

export async function deleteGoal(uid: string, goalId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'goals', goalId));
}
