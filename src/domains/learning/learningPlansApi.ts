import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LearningPlan } from '../shared/types';

export async function listLearningPlans(uid: string): Promise<LearningPlan[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'learningPlans'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<LearningPlan, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveLearningPlan(uid: string, plan: LearningPlan): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'learningPlans', plan.id), {
    topic: plan.topic,
    cadence: plan.cadence,
    weeklyDays: plan.weeklyDays ?? null,
    points: plan.points ?? 0,
    currentStreak: plan.currentStreak ?? 0,
    lastCompletedDate: plan.lastCompletedDate ?? null,
  });
}

export async function deleteLearningPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'learningPlans', planId));
}

export function isLearningPlanDueToday(plan: LearningPlan, dow: number): boolean {
  if (plan.cadence === 'daily') return true;
  return plan.weeklyDays?.includes(dow) ?? false;
}
