import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { registerUser } from './userRegistry';
import { useLocalAuthState, signOutLocal } from './localAuth';
import { isLocalAuthProvider } from './authMode';

export { isLocalAuthProvider };

export interface AuthState {
  user: { uid: string; email: string | null } | null;
  loading: boolean;
  redirectError: string | null;
}

function useFirebaseAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, redirectError: null });

  useEffect(() => {
    if (isLocalAuthProvider) return;

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

export function useAuth(): AuthState {
  const firebaseState = useFirebaseAuthState();
  const localState = useLocalAuthState();

  if (isLocalAuthProvider) {
    return { user: localState.user, loading: localState.loading, redirectError: null };
  }
  return firebaseState;
}

export function signInWithGoogle(): Promise<void> {
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

export function signOutUser(): Promise<void> {
  return isLocalAuthProvider ? signOutLocal() : signOut(auth);
}
