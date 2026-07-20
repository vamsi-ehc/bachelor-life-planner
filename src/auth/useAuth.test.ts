import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

let capturedCallback: ((user: unknown) => void) | undefined;
const mockOnAuthStateChanged = vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
  capturedCallback = cb;
  return vi.fn(); // unsubscribe
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: [unknown, (user: unknown) => void]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../firebase/config', () => ({ auth: {} }));

import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('starts in loading state and resolves to the signed-in user', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);

    const fakeUser = { uid: 'abc123' };
    act(() => {
      capturedCallback?.(fakeUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(fakeUser);
  });
});
