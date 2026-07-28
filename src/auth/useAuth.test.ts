import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

let capturedCallback: ((user: unknown) => void) | undefined;
const mockOnAuthStateChanged = vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
  capturedCallback = cb;
  return vi.fn(); // unsubscribe
});
const mockSignInWithPopup = vi.fn().mockResolvedValue({ user: { uid: 'abc123' } });
const mockSignOut = vi.fn();
const mockRegisterUser = vi.fn().mockResolvedValue(undefined);

const { FakeGoogleAuthProvider } = vi.hoisted(() => ({
  FakeGoogleAuthProvider: class FakeGoogleAuthProvider {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: [unknown, (user: unknown) => void]) => mockOnAuthStateChanged(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: FakeGoogleAuthProvider,
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));
vi.mock('../firebase/config', () => ({ auth: {} }));
vi.mock('./userRegistry', () => ({ registerUser: (...args: unknown[]) => mockRegisterUser(...args) }));

import { useAuth, signInWithGoogle } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    mockSignInWithPopup.mockClear();
    mockRegisterUser.mockClear();
  });

  it('starts in loading state and resolves to the signed-in user', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);

    const fakeUser = { uid: 'abc123', email: 'me@example.com' };
    act(() => {
      capturedCallback?.(fakeUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(fakeUser);
  });

  it('registers the user in Firestore once signed in', async () => {
    renderHook(() => useAuth());
    const fakeUser = { uid: 'abc123', email: 'me@example.com' };
    act(() => {
      capturedCallback?.(fakeUser);
    });

    await waitFor(() => expect(mockRegisterUser).toHaveBeenCalledWith('abc123', 'me@example.com'));
  });

  it('does not call registerUser when signed out', async () => {
    renderHook(() => useAuth());
    act(() => {
      capturedCallback?.(null);
    });

    await waitFor(() => expect(mockRegisterUser).not.toHaveBeenCalled());
  });
});

describe('signInWithGoogle', () => {
  it('calls signInWithPopup with a GoogleAuthProvider', async () => {
    await signInWithGoogle();
    expect(mockSignInWithPopup).toHaveBeenCalledWith({}, expect.any(FakeGoogleAuthProvider));
  });

  it('propagates errors from the popup', async () => {
    mockSignInWithPopup.mockRejectedValueOnce(new Error('popup blocked'));
    await expect(signInWithGoogle()).rejects.toThrow('popup blocked');
  });
});
