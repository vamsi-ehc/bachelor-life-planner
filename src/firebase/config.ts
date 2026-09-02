import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { isLocalAuthProvider } from '../auth/authMode';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// In the offline/local-auth build there is no Google project to talk to, so
// skip initializing the real Firebase app/auth entirely — no network call
// is attempted. `db` still resolves via `getFirestore`, which the offline
// build's Vite config aliases to the local SQLite-backed shim (see
// vite.config.ts and src/localdb/localFirestore.ts), so every domain API
// file keeps working unmodified against on-device storage.
export const app: FirebaseApp | null = isLocalAuthProvider ? null : initializeApp(firebaseConfig);
export const auth: Auth = isLocalAuthProvider ? (null as unknown as Auth) : getAuth(app as FirebaseApp);
export const db: Firestore = getFirestore(app as FirebaseApp);
