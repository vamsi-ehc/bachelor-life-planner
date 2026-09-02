// Swapped in for src/auth/localAuth.ts in production builds that use the
// Firebase auth provider (the default), so the client-side SQLite engine
// (sql.js + its ~650kB wasm binary) is never bundled for users who don't
// need it. See vite.config.ts.
export interface LocalUser {
  uid: string;
  email: string | null;
}

export interface LocalAuthState {
  user: LocalUser | null;
  loading: boolean;
}

export function useLocalAuthState(): LocalAuthState {
  return { user: null, loading: false };
}

export async function signInLocal(): Promise<void> {
  throw new Error('Local auth is not available in this build');
}

export async function signUpLocal(): Promise<void> {
  throw new Error('Local auth is not available in this build');
}

export async function signOutLocal(): Promise<void> {}
