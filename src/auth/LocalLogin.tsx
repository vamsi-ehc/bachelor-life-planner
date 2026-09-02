// src/auth/LocalLogin.tsx
import { useState, FormEvent } from 'react';
import { signInLocal, signUpLocal } from './localAuth';

export interface LocalLoginProps {
  redirectError?: string | null;
}

export function LocalLogin({ redirectError = null }: LocalLoginProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const displayedError = error ?? redirectError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpLocal(email, password);
      } else {
        await signInLocal(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full sm:w-72">
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-line rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? 8 : undefined}
          className="border border-line rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-[#1A73E8] hover:bg-[#1669C1] disabled:opacity-60 text-white font-medium rounded-lg px-5 py-2.5 text-sm"
        >
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
          }}
          className="text-xs text-muted underline self-start"
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
      </form>
      {displayedError && <p className="mt-3 text-sm text-[#B3261E]">{displayedError}</p>}
      <p className="mt-2 text-xs text-muted">Stored only on this device — no internet connection required.</p>
    </div>
  );
}
