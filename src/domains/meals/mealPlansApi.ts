import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MealPlan } from '../shared/types';

export async function listMealPlans(uid: string): Promise<MealPlan[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'mealPlans'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<MealPlan, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveMealPlan(uid: string, plan: MealPlan): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'mealPlans', plan.id), {
    name: plan.name,
    meal: plan.meal,
    cadence: plan.cadence,
    weeklyDays: plan.weeklyDays ?? null,
    points: plan.points ?? 0,
    currentStreak: plan.currentStreak ?? 0,
    lastCompletedDate: plan.lastCompletedDate ?? null,
  });
}

export async function deleteMealPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'mealPlans', planId));
}

export function isMealPlanDueToday(plan: MealPlan, dow: number): boolean {
  if (plan.cadence === 'daily') return true;
  return plan.weeklyDays?.includes(dow) ?? false;
}
