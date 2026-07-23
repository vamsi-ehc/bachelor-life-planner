import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
    token,
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
  });
}
