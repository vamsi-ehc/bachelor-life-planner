// src/auth/Login.tsx
import { useState } from 'react';
import { signInWithGoogle } from './useAuth';

export interface LoginProps {
  redirectError?: string | null;
}

export function Login({ redirectError = null }: LoginProps) {
  const [error, setError] = useState<string | null>(null);
  const displayedError = error ?? redirectError;

  async function handleClick() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-0 bg-[#1A73E8] hover:bg-[#1669C1] text-white font-medium rounded-lg w-full sm:w-auto shadow-sm overflow-hidden"
      >
        <span className="flex items-center justify-center bg-white w-10 h-10 rounded-l-lg flex-none">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
        </span>
        <span className="flex-1 sm:flex-none text-center px-5 py-3">Sign in with Google</span>
      </button>
      {displayedError && <p className="mt-3 text-sm text-[#B3261E]">{displayedError}</p>}
    </div>
  );
}
