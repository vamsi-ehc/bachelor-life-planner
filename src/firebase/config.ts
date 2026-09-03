// The app has no backend. `db` is the local SQLite-backed Firestore shim
// (see src/localdb/localFirestore.ts); the `firebase/firestore` specifier is
// aliased to that module in vite.config.ts / tsconfig.json, so every domain
// API file keeps working unmodified against on-device storage.
import { getFirestore, Firestore } from 'firebase/firestore';

export const db: Firestore = getFirestore();
