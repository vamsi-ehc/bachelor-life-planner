// Auth is entirely on-device: email/password accounts in a client-side
// SQLite database (see src/auth/localAuth.ts). No network call is involved.
import { useEffect } from 'react';
import { registerUser } from './userRegistry';
import { useLocalAuthState, signOutLocal } from './localAuth';
import { isLocalAuthProvider } from './authMode';

export { isLocalAuthProvider };

export interface AuthState {
  user: { uid: string; email: string | null } | null;
  loading: boolean;
  redirectError: string | null;
}

export function useAuth(): AuthState {
  const { user, loading } = useLocalAuthState();

  useEffect(() => {
    if (user) {
      registerUser(user.uid, user.email).catch((err) => {
        console.error('Failed to register user', err);
      });
    }
  }, [user]);

  return { user, loading, redirectError: null };
}

export function signOutUser(): Promise<void> {
  return signOutLocal();
}
