import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { registerUser } from './userRegistry';

export interface AuthState {
  user: User | null;
  loading: boolean;
  redirectError: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, redirectError: null });

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      setState((prev) => ({ ...prev, redirectError: err instanceof Error ? err.message : 'Sign-in failed' }));
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({ ...prev, user, loading: false }));
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

export function signInWithGoogle(): Promise<void> {
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}
