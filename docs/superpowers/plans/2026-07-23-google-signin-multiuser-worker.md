# Google Sign-In + Multi-User Worker Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email/password auth with Google Sign-In only, and make the Cloudflare reminders Worker discover registered users from Firestore instead of relying on a hardcoded `FIREBASE_UID`.

**Architecture:** `useAuth.ts` gains `signInWithGoogle()` (redirect flow) and registers a discoverable `users/{uid}` document on every sign-in via a new `userRegistry.ts` module. `Login.tsx` drops its email/password form for a single Google button. The Worker's `index.ts` splits its single-user body into a per-user function, called once per UID returned by listing the `users` collection.

**Tech Stack:** Same as existing Phase 1-5 stack (Firebase JS SDK v10 `firebase/auth`/`firebase/firestore`, Vitest, React Testing Library) for the frontend; existing Worker stack (Vitest, hand-rolled Firestore REST) unchanged.

## Global Constraints

- Redirect flow (`signInWithRedirect`), not popup — this app runs installed/standalone on iOS Safari where popup OAuth is unreliable.
- No migration of the old email/password account's data — single-user personal app, re-do Settings + notification permission once under the new Google account.
- Firestore rules already cover writes to `users/{uid}` itself (`match /users/{uid}/{document=**}` includes zero-segment matches) — no rules changes.
- Worker must process each discovered user independently — one user's error must not stop others from getting their reminders (try/catch per user).
- Zero new dependencies (both `firebase/auth`'s `GoogleAuthProvider`/`signInWithRedirect`/`getRedirectResult` and the Worker's `listDocuments` already exist).
- Test suite must remain at zero warnings; `npm run build` (frontend) and `npm test` (`workers/reminders`) must pass after every task.

---

## File Structure

```
src/auth/useAuth.ts          — MODIFY: remove signIn/signUp, add signInWithGoogle + getRedirectResult handling + registerUser call
src/auth/useAuth.test.ts     — MODIFY: replace email/password tests with Google sign-in + redirect-result tests
src/auth/Login.tsx           — MODIFY: replace form with single "Sign in with Google" button
src/auth/Login.test.tsx      — MODIFY: replace with Google-button tests
src/auth/userRegistry.ts     — CREATE: registerUser(uid, email) -> Promise<void>
src/auth/userRegistry.test.ts — CREATE
workers/reminders/src/index.ts       — MODIFY: extract runReminderCheckForUser, loop over listDocuments('users')
workers/reminders/src/index.test.ts  — MODIFY: mock listDocuments('users') returning multiple users, add per-user isolation test
workers/reminders/wrangler.toml      — MODIFY: remove FIREBASE_UID
```

---

### Task 1: `userRegistry.ts` — register a discoverable user document

**Files:**
- Create: `src/auth/userRegistry.ts`, `src/auth/userRegistry.test.ts`

**Interfaces:**
- Consumes: `db` from `../firebase/config`
- Produces: `registerUser(uid: string, email: string | null): Promise<void>` — called by Task 3's `useAuth.ts`

- [ ] **Step 1: Write the failing test**

Create `src/auth/userRegistry.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockServerTimestamp = vi.fn(() => 'server-timestamp-sentinel');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { registerUser } from './userRegistry';

describe('registerUser', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockSetDoc.mockClear();
  });

  it('upserts a users/{uid} document with email and a timestamp', async () => {
    await registerUser('uid1', 'me@example.com');

    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'uid1');
    expect(mockSetDoc).toHaveBeenCalledWith(
      {},
      { email: 'me@example.com', updatedAt: 'server-timestamp-sentinel' },
      { merge: true },
    );
  });

  it('stores a null email as null (not undefined)', async () => {
    await registerUser('uid2', null);

    expect(mockSetDoc).toHaveBeenCalledWith(
      {},
      { email: null, updatedAt: 'server-timestamp-sentinel' },
      { merge: true },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/userRegistry.test.ts`
Expected: FAIL with "Cannot find module './userRegistry'"

- [ ] **Step 3: Implement userRegistry.ts**

Create `src/auth/userRegistry.ts`:

```ts
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function registerUser(uid: string, email: string | null): Promise<void> {
  await setDoc(doc(db, 'users', uid), { email, updatedAt: serverTimestamp() }, { merge: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/userRegistry.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/auth/userRegistry.ts src/auth/userRegistry.test.ts
git commit -m "feat(auth): add registerUser to make signed-in users discoverable in Firestore"
```

---

### Task 2: `useAuth.ts` — Google sign-in, redirect-result handling, and registration

**Files:**
- Modify: `src/auth/useAuth.ts`, `src/auth/useAuth.test.ts`

**Interfaces:**
- Consumes: `registerUser` (Task 1)
- Produces: `signInWithGoogle(): Promise<void>`, `useAuth(): AuthState` (same shape as today: `{ user, loading }`), `signOutUser(): Promise<void>` (unchanged) — consumed by Task 4's `Login.tsx` and unchanged by `App.tsx`
- Removes: `signIn`, `signUp` (no longer exported — nothing else in the app imports them, verified by `grep -rn "from './useAuth'\|from '../auth/useAuth'" src`)

- [ ] **Step 1: Verify nothing else depends on the removed exports**

Run: `grep -rn "signIn\b\|signUp\b" src --include=*.tsx --include=*.ts | grep -v test`
Expected: only matches inside `src/auth/useAuth.ts` and `src/auth/Login.tsx` (both modified in this plan)

- [ ] **Step 2: Write the failing tests**

Replace `src/auth/useAuth.test.ts` entirely:

```ts
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

class FakeGoogleAuthProvider {}

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/auth/useAuth.test.ts`
Expected: FAIL (old `signIn`/`signUp` exports gone from the test's expectations, `redirectError` and `signInWithGoogle` not yet implemented)

- [ ] **Step 4: Implement useAuth.ts**

Replace `src/auth/useAuth.ts` entirely:

```ts
import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { registerUser } from './userRegistry';

export interface AuthState {
  user: User | null;
  loading: boolean;
  redirectError: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, redirectError: null });

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      setState((prev) => ({ ...prev, redirectError: err instanceof Error ? err.message : 'Sign-in failed' }));
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({ ...prev, user, loading: false }));
      if (user) {
        registerUser(user.uid, user.email).catch((err) => {
          console.error('Failed to register user', err);
        });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}

export function signInWithGoogle(): Promise<void> {
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/auth/useAuth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/auth/useAuth.ts src/auth/useAuth.test.ts
git commit -m "feat(auth): replace email/password auth with Google sign-in via redirect flow"
```

---

### Task 3: `Login.tsx` — single Google sign-in button

**Files:**
- Modify: `src/auth/Login.tsx`, `src/auth/Login.test.tsx`

**Interfaces:**
- Consumes: `signInWithGoogle` (Task 2)
- Produces: `Login` component (no props, same as today) — consumed unchanged by `src/App.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `src/auth/Login.test.tsx` entirely:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSignInWithGoogle = vi.fn().mockResolvedValue(undefined);

vi.mock('./useAuth', () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
}));

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    mockSignInWithGoogle.mockClear();
  });

  it('renders a single Google sign-in button', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
  });

  it('calls signInWithGoogle when clicked', async () => {
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it('shows an error if signInWithGoogle rejects', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup blocked'));
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    await waitFor(() => expect(screen.getByText('popup blocked')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/auth/Login.test.tsx`
Expected: FAIL (no "Sign in with Google" button exists yet)

- [ ] **Step 3: Implement Login.tsx**

Replace `src/auth/Login.tsx` entirely:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/auth/Login.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full frontend suite and build**

Run: `npm test`
Expected: PASS, no other test references the removed `signIn`/`signUp` exports (Task 2 Step 1 already confirmed this)

Run: `npm run build`
Expected: succeeds

- [ ] **Step 6: Commit**

```bash
git add src/auth/Login.tsx src/auth/Login.test.tsx
git commit -m "feat(auth): replace email/password Login form with a single Google sign-in button"
```

---

### Task 4: Worker — discover users dynamically instead of a hardcoded UID

**Files:**
- Modify: `workers/reminders/src/index.ts`, `workers/reminders/src/index.test.ts`, `workers/reminders/wrangler.toml`

**Interfaces:**
- Consumes: `listDocuments` (existing, from `./firestore`)
- Produces: `runReminderCheckForUser(projectId: string, accessToken: string, uid: string, now: Date): Promise<void>`, `runReminderCheck(env: Env, now?: Date): Promise<void>` (same name as today, new behavior), `Env` (drops `FIREBASE_UID`)

- [ ] **Step 1: Write the failing tests**

Replace `workers/reminders/src/index.test.ts` entirely:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAccessToken = vi.fn();
const mockGetDocument = vi.fn();
const mockListDocuments = vi.fn();
const mockPatchDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockSendPush = vi.fn();

vi.mock('./googleAuth', () => ({ getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args) }));
vi.mock('./firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  listDocuments: (...args: unknown[]) => mockListDocuments(...args),
  patchDocument: (...args: unknown[]) => mockPatchDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}));
vi.mock('./fcm', () => ({ sendPush: (...args: unknown[]) => mockSendPush(...args) }));

import { runReminderCheck, Env } from './index';

const env: Env = {
  GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: 'key' }),
  FIREBASE_PROJECT_ID: 'proj1',
};

const defaultConfig = { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };

describe('runReminderCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('access-token');
    mockSendPush.mockResolvedValue({ ok: true, invalidToken: false });
    mockPatchDocument.mockResolvedValue(undefined);
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  it('fires a reminder for every user discovered under the users collection', async () => {
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'uid1', data: {} }, { id: 'uid2', data: {} }];
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      if (path === 'users/uid2/fcmTokens') return [{ id: 'tok-b', data: { token: 'tok-b' } }];
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders' || path === 'users/uid2/config/reminders') return defaultConfig;
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).toHaveBeenCalledTimes(2);
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-a', title: 'Workout time' }));
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-b', title: 'Workout time' }));
    expect(mockPatchDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid1/reminderState/workout', { lastSentDate: '2026-07-23' });
    expect(mockPatchDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid2/reminderState/workout', { lastSentDate: '2026-07-23' });
  });

  it('does nothing when no users are registered', async () => {
    mockListDocuments.mockResolvedValue([]);
    mockGetDocument.mockResolvedValue(null);

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("processes the remaining users when one user's check throws", async () => {
    let callCount = 0;
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'broken-uid', data: {} }, { id: 'uid2', data: {} }];
      if (path === 'users/uid2/fcmTokens') return [{ id: 'tok-b', data: { token: 'tok-b' } }];
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      callCount += 1;
      if (path === 'users/broken-uid/config/reminders') throw new Error('Firestore down');
      if (path === 'users/uid2/config/reminders') return defaultConfig;
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(callCount).toBeGreaterThan(0);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-b' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: FAIL (current `runReminderCheck` reads `env.FIREBASE_UID`, which no longer exists on `Env` in the test; `listDocuments('users')` is never called today)

- [ ] **Step 3: Implement the refactored index.ts**

Replace `workers/reminders/src/index.ts` entirely:

```ts
import { getAccessToken, ServiceAccountKey } from './googleAuth';
import { getDocument, listDocuments, patchDocument, deleteDocument } from './firestore';
import { sendPush } from './fcm';
import { zonedParts, zonedDateId, zonedWeekday } from './dateUtils';
import { shouldFireDaily, shouldFireWeekly } from './reminders';
import { isBillDueToday, isChoreDueToday, daysInMonthFor, Bill, ChoreConfig } from './dueChecks';

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
}

const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

const MORNING_CHECK_TIME = '07:30';

const SCOPES = ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging'];

interface DailyReminderDef {
  key: string;
  getTime: (config: ReminderConfig) => string;
  title: string;
  body: string;
}

const DAILY_REMINDERS: DailyReminderDef[] = [
  { key: 'workout', getTime: (c) => c.workoutTime, title: 'Workout time', body: "It's time for your workout." },
  { key: 'dinner', getTime: (c) => c.dinnerTime, title: 'Dinner prep', body: 'Time to start prepping dinner.' },
  { key: 'learning', getTime: (c) => c.learningTime, title: 'Learning time', body: "It's time for your learning session." },
];

function decodeReminderConfig(data: Record<string, unknown> | null): ReminderConfig {
  if (!data) return DEFAULT_REMINDER_CONFIG;
  return {
    workoutTime: typeof data.workoutTime === 'string' ? data.workoutTime : DEFAULT_REMINDER_CONFIG.workoutTime,
    dinnerTime: typeof data.dinnerTime === 'string' ? data.dinnerTime : DEFAULT_REMINDER_CONFIG.dinnerTime,
    learningTime: typeof data.learningTime === 'string' ? data.learningTime : DEFAULT_REMINDER_CONFIG.learningTime,
    weeklyReviewTime:
      typeof data.weeklyReviewTime === 'string' ? data.weeklyReviewTime : DEFAULT_REMINDER_CONFIG.weeklyReviewTime,
    timezone: typeof data.timezone === 'string' ? data.timezone : DEFAULT_REMINDER_CONFIG.timezone,
  };
}

function lastSentDateOf(state: Record<string, unknown> | null): string | null {
  return typeof state?.lastSentDate === 'string' ? state.lastSentDate : null;
}

interface PushJob {
  key: string;
  todayId: string;
  title: string;
  body: string;
}

export async function runReminderCheckForUser(
  projectId: string,
  accessToken: string,
  uid: string,
  now: Date,
): Promise<void> {
  const base = `users/${uid}`;

  const configData = await getDocument(projectId, accessToken, `${base}/config/reminders`);
  const config = decodeReminderConfig(configData);

  const jobs: PushJob[] = [];

  for (const reminder of DAILY_REMINDERS) {
    const state = await getDocument(projectId, accessToken, `${base}/reminderState/${reminder.key}`);
    const check = shouldFireDaily(now, config.timezone, reminder.getTime(config), lastSentDateOf(state));
    if (check.fire) jobs.push({ key: reminder.key, todayId: check.todayId, title: reminder.title, body: reminder.body });
  }

  const reviewState = await getDocument(projectId, accessToken, `${base}/reminderState/weeklyReview`);
  const reviewCheck = shouldFireWeekly(now, config.timezone, config.weeklyReviewTime, 0, lastSentDateOf(reviewState));
  if (reviewCheck.fire) {
    jobs.push({ key: 'weeklyReview', todayId: reviewCheck.todayId, title: 'Weekly review', body: 'Time for your weekly review.' });
  }

  const billState = await getDocument(projectId, accessToken, `${base}/reminderState/billDue`);
  const billCheck = shouldFireDaily(now, config.timezone, MORNING_CHECK_TIME, lastSentDateOf(billState));
  if (billCheck.fire) {
    const { year, month, day } = zonedParts(now, config.timezone);
    const bills = await listDocuments(projectId, accessToken, `${base}/bills`);
    const dueBills = bills
      .map((d) => ({ id: d.id, ...d.data }) as Bill)
      .filter((bill) => isBillDueToday(bill, day, daysInMonthFor(year, month)));
    if (dueBills.length > 0) {
      jobs.push({ key: 'billDue', todayId: billCheck.todayId, title: 'Bills due today', body: dueBills.map((b) => b.name).join(', ') });
    } else {
      await patchDocument(projectId, accessToken, `${base}/reminderState/billDue`, { lastSentDate: billCheck.todayId });
    }
  }

  const choreState = await getDocument(projectId, accessToken, `${base}/reminderState/choreDue`);
  const choreCheck = shouldFireDaily(now, config.timezone, MORNING_CHECK_TIME, lastSentDateOf(choreState));
  if (choreCheck.fire) {
    const dow = zonedWeekday(now, config.timezone);
    const todayId = zonedDateId(now, config.timezone);
    const chores = await listDocuments(projectId, accessToken, `${base}/chores`);
    const completion = await getDocument(projectId, accessToken, `${base}/completions/${todayId}`);
    const completedChoreIds = (completion?.chores as Record<string, boolean> | undefined) ?? {};
    const dueChores = chores
      .map((d) => ({ id: d.id, ...d.data }) as ChoreConfig)
      .filter((chore) => isChoreDueToday(chore, dow) && !completedChoreIds[chore.id]);
    if (dueChores.length > 0) {
      jobs.push({ key: 'choreDue', todayId: choreCheck.todayId, title: 'Chores due today', body: dueChores.map((c) => c.name).join(', ') });
    } else {
      await patchDocument(projectId, accessToken, `${base}/reminderState/choreDue`, { lastSentDate: choreCheck.todayId });
    }
  }

  if (jobs.length === 0) return;

  const tokens = await listDocuments(projectId, accessToken, `${base}/fcmTokens`);

  for (const job of jobs) {
    for (const tokenDoc of tokens) {
      const token = tokenDoc.data.token as string;
      const result = await sendPush({ projectId, accessToken, token, title: job.title, body: job.body });
      if (result.invalidToken) {
        await deleteDocument(projectId, accessToken, `${base}/fcmTokens/${tokenDoc.id}`);
      }
    }
    await patchDocument(projectId, accessToken, `${base}/reminderState/${job.key}`, { lastSentDate: job.todayId });
  }
}

export async function runReminderCheck(env: Env, now: Date = new Date()): Promise<void> {
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY) as ServiceAccountKey;
  const accessToken = await getAccessToken(key, SCOPES);
  const projectId = env.FIREBASE_PROJECT_ID;

  const users = await listDocuments(projectId, accessToken, 'users');

  for (const userDoc of users) {
    try {
      await runReminderCheckForUser(projectId, accessToken, userDoc.id, now);
    } catch (err) {
      console.error(`Reminder check failed for user ${userDoc.id}`, err);
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response('ok');
  },
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(runReminderCheck(env));
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/index.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full Worker suite**

Run: `npm test`
Expected: PASS, all Worker tests (should be 35 tests: the previous 37 minus the 5 old index tests plus these 3 new ones — actual count doesn't matter, zero failures does)

- [ ] **Step 6: Remove `FIREBASE_UID` from wrangler.toml**

Edit `workers/reminders/wrangler.toml`, remove the `FIREBASE_UID` line so `[vars]` contains only:

```toml
[vars]
FIREBASE_PROJECT_ID = "batch-bf034"
```

- [ ] **Step 7: Commit**

```bash
git add workers/reminders/src/index.ts workers/reminders/src/index.test.ts workers/reminders/wrangler.toml
git commit -m "feat(worker): discover registered users from Firestore instead of a hardcoded FIREBASE_UID"
```

---

### Task 5: Deploy and verify end-to-end

**Files:** none (deploy/verification only)

- [ ] **Step 1: Redeploy the Worker**

```bash
cd workers/reminders
npx wrangler deploy
```

Expected: deploy succeeds; the `Vars` printout no longer lists `FIREBASE_UID`.

- [ ] **Step 2: Rebuild and redeploy the frontend**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
npm run build
npx wrangler pages deploy ./dist --project-name punch-in
```

- [ ] **Step 3: Sign in with Google on the deployed app**

Visit `https://punchin.vamsi-tech.org`, sign in with Google, re-grant notification permission, and re-set reminder times in Settings (this is a new account UID — Task 1's `registerUser` call means this new UID is now automatically discoverable, no manual Worker config needed).

- [ ] **Step 4: Verify the new user is discoverable and reminders fire**

Confirm a `users/{new-uid}` document exists in Firestore (readable in the Firebase Console under Firestore Data), and confirm a subsequent cron tick sets `users/{new-uid}/reminderState/workout`'s `lastSentDate` to today once the configured time passes.
