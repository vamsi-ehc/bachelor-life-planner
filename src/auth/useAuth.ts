import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { registerUser } from './userRegistry';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
      if (user) {
        registerUser(user.uid, user.email).catch((err) => {
          console.error('Failed to register user', err);
        });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}
