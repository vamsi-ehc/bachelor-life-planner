import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WorkoutRoutine } from '../shared/types';

export async function listWorkoutRoutines(uid: string): Promise<WorkoutRoutine[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'workoutRoutines'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<WorkoutRoutine, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveWorkoutRoutine(uid: string, routine: WorkoutRoutine): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'workoutRoutines', routine.id), {
    name: routine.name,
    exercises: routine.exercises,
    cadence: routine.cadence,
    weeklyDays: routine.weeklyDays ?? null,
    points: routine.points ?? 0,
    currentStreak: routine.currentStreak ?? 0,
    lastCompletedDate: routine.lastCompletedDate ?? null,
  });
}

export async function deleteWorkoutRoutine(uid: string, routineId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'workoutRoutines', routineId));
}

export function isWorkoutRoutineDueToday(routine: WorkoutRoutine, dow: number): boolean {
  if (routine.cadence === 'daily') return true;
  return routine.weeklyDays?.includes(dow) ?? false;
}
