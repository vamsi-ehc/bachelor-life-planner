import { useState } from 'react';
import { signInWithGoogle } from './useAuth';

export function Login() {
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm mx-auto mt-20 p-6 items-center">
      <h1 className="text-xl font-semibold">Punch In</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        className="bg-blue-600 text-white rounded px-3 py-2 w-full"
      >
        Sign in with Google
      </button>
    </div>
  );
}
