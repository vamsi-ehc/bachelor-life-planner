import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WeeklyReview } from '../shared/types';

export function weeklyReviewDocRef(uid: string, weekId: string) {
  return doc(db, 'users', uid, 'weeklyReviews', weekId);
}

export async function getWeeklyReview(uid: string, weekId: string): Promise<WeeklyReview | null> {
  const snap = await getDoc(weeklyReviewDocRef(uid, weekId));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<Omit<WeeklyReview, 'weekId'>>;
  return {
    weekId,
    wentWell: data.wentWell ?? '',
    wentBadly: data.wentBadly ?? '',
    focusNext: data.focusNext ?? '',
  };
}

export async function saveWeeklyReview(uid: string, review: WeeklyReview): Promise<void> {
  await setDoc(weeklyReviewDocRef(uid, review.weekId), {
    wentWell: review.wentWell,
    wentBadly: review.wentBadly,
    focusNext: review.focusNext,
  });
}
