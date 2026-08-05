import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { HealthPlan } from '../shared/types';

export async function listHealthPlans(uid: string): Promise<HealthPlan[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'healthPlans'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<HealthPlan, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveHealthPlan(uid: string, plan: HealthPlan): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'healthPlans', plan.id), {
    label: plan.label,
    cadence: plan.cadence,
    weeklyDays: plan.weeklyDays ?? null,
    points: plan.points ?? 0,
    currentStreak: plan.currentStreak ?? 0,
    lastCompletedDate: plan.lastCompletedDate ?? null,
  });
}

export async function deleteHealthPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'healthPlans', planId));
}

export function isHealthPlanDueToday(plan: HealthPlan, dow: number): boolean {
  if (plan.cadence === 'daily') return true;
  return plan.weeklyDays?.includes(dow) ?? false;
}
