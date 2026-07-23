import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function registerUser(uid: string, email: string | null): Promise<void> {
  await setDoc(doc(db, 'users', uid), { email, updatedAt: serverTimestamp() }, { merge: true });
}
