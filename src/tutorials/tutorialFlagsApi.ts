import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TutorialFlags, TutorialScreenKey, TUTORIAL_SCREEN_KEYS } from './types';

function tutorialFlagsDocRef(uid: string) {
  return doc(db, 'users', uid, 'config', 'tutorials');
}

export async function getTutorialFlags(uid: string): Promise<TutorialFlags> {
  const snap = await getDoc(tutorialFlagsDocRef(uid));
  const data = (snap.exists() ? snap.data() : {}) as Partial<TutorialFlags> | undefined;
  const flags = {} as TutorialFlags;
  for (const key of TUTORIAL_SCREEN_KEYS) {
    flags[key] = data?.[key] ?? false;
  }
  return flags;
}

export async function markTutorialSeen(uid: string, key: TutorialScreenKey): Promise<void> {
  await setDoc(tutorialFlagsDocRef(uid), { [key]: true }, { merge: true });
}

export async function resetAllTutorialFlags(uid: string): Promise<void> {
  const flags: Partial<Record<TutorialScreenKey, boolean>> = {};
  for (const key of TUTORIAL_SCREEN_KEYS) {
    flags[key] = false;
  }
  await setDoc(tutorialFlagsDocRef(uid), flags, { merge: true });
}
