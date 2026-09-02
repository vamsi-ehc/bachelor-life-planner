import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({
  default: require.resolve('sql.js/dist/sql-wasm.wasm'),
}));
vi.mock('./authMode', () => ({ isLocalAuthProvider: true }));

import { signUpLocal, signInLocal, signOutLocal, useLocalAuthState } from './localAuth';

describe('localAuth', () => {
  it('rejects a password shorter than 8 characters', async () => {
    await expect(signUpLocal('short@example.com', 'abc')).rejects.toThrow(/at least 8 characters/i);
  });

  it('rejects signing in with an unknown email', async () => {
    await expect(signInLocal('nobody@example.com', 'whatever1')).rejects.toThrow(/invalid email or password/i);
  });

  it('signs up, signs in, and signs out, updating the reactive hook state', async () => {
    const { result } = renderHook(() => useLocalAuthState());

    await act(async () => {
      await signUpLocal('Alice@Example.com', 'correcthorse');
    });
    await waitFor(() => expect(result.current.user?.email).toBe('alice@example.com'));

    await act(async () => {
      await signOutLocal();
    });
    await waitFor(() => expect(result.current.user).toBeNull());

    await act(async () => {
      await signInLocal('alice@example.com', 'correcthorse');
    });
    await waitFor(() => expect(result.current.user?.email).toBe('alice@example.com'));
  });

  it('rejects sign up with an email that already has an account', async () => {
    await signUpLocal('bob@example.com', 'password1');
    await expect(signUpLocal('bob@example.com', 'password2')).rejects.toThrow(/already exists/i);
  });

  it('rejects sign in with the wrong password', async () => {
    await signUpLocal('carol@example.com', 'therightpassword');
    await expect(signInLocal('carol@example.com', 'thewrongpassword')).rejects.toThrow(/invalid email or password/i);
  });
});
