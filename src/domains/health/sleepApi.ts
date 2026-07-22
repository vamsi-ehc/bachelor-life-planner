import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { SleepLog } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function sleepLogDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'sleepLogs', date);
}

export async function getSleepLog(uid: string, date: string = todayId()): Promise<SleepLog> {
  const snap = await getDoc(sleepLogDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<SleepLog>) : {};
  return {
    date,
    bedtime: data.bedtime ?? '',
    wakeTime: data.wakeTime ?? '',
  };
}

export async function saveSleepLog(uid: string, log: SleepLog): Promise<void> {
  await setDoc(sleepLogDocRef(uid, log.date), {
    date: log.date,
    bedtime: log.bedtime,
    wakeTime: log.wakeTime,
  });
}
