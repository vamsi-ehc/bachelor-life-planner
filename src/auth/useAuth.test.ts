import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

let capturedCallback: ((user: unknown) => void) | undefined;
const mockOnAuthStateChanged = vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
  capturedCallback = cb;
  return vi.fn(); // unsubscribe
});
const mockSignInWithRedirect = vi.fn().mockResolvedValue(undefined);
const mockGetRedirectResult = vi.fn().mockResolvedValue(null);
const mockSignOut = vi.fn();
const mockRegisterUser = vi.fn().mockResolvedValue(undefined);

const { FakeGoogleAuthProvider } = vi.hoisted(() => ({
  FakeGoogleAuthProvider: class FakeGoogleAuthProvider {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: [unknown, (user: unknown) => void]) => mockOnAuthStateChanged(...args),
  signInWithRedirect: (...args: unknown[]) => mockSignInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => mockGetRedirectResult(...args),
  GoogleAuthProvider: FakeGoogleAuthProvider,
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));
vi.mock('../firebase/config', () => ({ auth: {} }));
vi.mock('./userRegistry', () => ({ registerUser: (...args: unknown[]) => mockRegisterUser(...args) }));

import { useAuth, signInWithGoogle } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    mockGetRedirectResult.mockClear();
    mockGetRedirectResult.mockResolvedValue(null);
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

  it('surfaces a redirect-result error', async () => {
    mockGetRedirectResult.mockRejectedValue(new Error('redirect failed'));
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.redirectError).toBe('redirect failed'));
  });
});

describe('signInWithGoogle', () => {
  it('calls signInWithRedirect with a GoogleAuthProvider', async () => {
    await signInWithGoogle();
    expect(mockSignInWithRedirect).toHaveBeenCalledWith({}, expect.any(FakeGoogleAuthProvider));
  });
});
