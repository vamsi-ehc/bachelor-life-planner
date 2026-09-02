// Swapped in for src/auth/LocalLogin.tsx in production builds that use the
// Firebase auth provider (the default) — see vite.config.ts. Never rendered
// in that build (Home.tsx only renders it when isLocalAuthProvider is true).
export interface LocalLoginProps {
  redirectError?: string | null;
}

export function LocalLogin(_props: LocalLoginProps) {
  return null;
}
