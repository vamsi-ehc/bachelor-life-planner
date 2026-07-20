# Punch In — Phase 1: Core Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core shell of Punch In — email sign-in, Firestore wiring, the "Today" dashboard (status chips + due-now strip + punch-in), and the Workout/Learning/Chores domains — as a standalone, usable app.

**Architecture:** A Vite + React + TypeScript single-page app talking directly to Firebase client SDKs (Auth for email sign-in, Firestore for all data), deployed as a static site to Firebase Hosting later. Each of the three domains (Workout, Learning, Chores) has its own Firestore API module and screen component; a shared `dashboard/` module composes their data into the single-glance "Today" view. All Firestore reads/writes are scoped under `users/{uid}/...` per the approved data model.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, react-router-dom, Firebase (Auth + Firestore) client SDK v9+ modular API, Vitest, React Testing Library.

## Global Constraints

- All Firestore paths are scoped under `users/{uid}/...` — no top-level collections (per spec §2, §7).
- Reminder times and other Settings are out of scope for Phase 1 (Phase 5 per spec §8) — no reminder UI or Cloud Functions in this plan.
- Only Workout, Learning, Chores domains are built in Phase 1 (per spec §8, Phase 1). Finances, Meals, Health, Goals are later phases — the Dashboard must remain extensible to add their chips later without restructuring (spec §3).
- Auth is email/password via Firebase Auth (per spec §7) — no anonymous auth, no social login.
- Firestore security rules must restrict each user to their own `users/{uid}` subtree (per spec §7, cross-device access via login).

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html
firebase.json, firestore.rules, .env.example
src/
  main.tsx                        — app entry, mounts <App />
  App.tsx                         — auth gate + router
  setupTests.ts                   — RTL/jest-dom test setup
  index.css                       — Tailwind directives
  firebase/
    config.ts                     — Firebase app/auth/db init from env vars
  auth/
    useAuth.ts                    — auth state hook + signIn/signUp/signOutUser
    Login.tsx                     — email/password sign-in & sign-up form
  domains/
    shared/
      types.ts                    — DomainKey, DailyCompletion, ChoreConfig, WorkoutLogEntry, LearningLogEntry, DueItem
      dateUtils.ts                 — todayId(), dayOfWeek()
      completionsApi.ts            — getCompletion, setWorkoutDone, setLearningDone, setChoreDone
    workout/
      workoutApi.ts                — addWorkoutLogEntry, listWorkoutLogEntries
      WorkoutScreen.tsx             — punch-in + log entry form + entry list
    learning/
      learningApi.ts               — addLearningLogEntry, listLearningLogEntries
      LearningScreen.tsx            — punch-in + note form + entry list
    chores/
      choresApi.ts                 — listChores, saveChore, deleteChore, isChoreDueToday
      ChoresScreen.tsx              — chore list, add/edit/delete, mark due-today done
  components/
    StatusChip.tsx                 — generic status chip (used by Dashboard)
    PunchInButton.tsx               — shared punch-in CTA button
  dashboard/
    dashboardLogic.ts               — computeStreak, computeDueItems, computeDayHealth (pure)
    useDashboardData.ts             — data-fetching hook for the Dashboard
    Dashboard.tsx                   — "Today" view: chips grid, due-now strip, streak/day-health
    DueNowStrip.tsx                 — renders DueItem[] list
```

---

### Task 1: Scaffold the project toolchain

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx` (default Vite template, replaced in Task 12), `src/setupTests.ts`, `src/index.css`, `src/App.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: a working `npm run dev`, `npm run build`, and `npm test` in this repo, with Tailwind classes and Vitest/RTL both functional. Every later task depends on this.

- [ ] **Step 1: Scaffold the Vite React-TS template in place**

```bash
npm create vite@latest . -- --template react-ts
```

The directory already contains `docs/` and `punch-in-pwa-plan.md`. When prompted `Current directory is not empty. ... Continue?`, confirm yes — it will not touch those files.

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install
npm install firebase react-router-dom
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Replace `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

Replace `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Confirm `src/main.tsx` imports `./index.css` (the Vite template already does this by default — if not, add `import './index.css';` at the top).

- [ ] **Step 4: Configure Vitest**

Replace `vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
```

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom';
```

Add a `test` script to `package.json`'s `"scripts"` block:

```json
"test": "vitest run"
```

- [ ] **Step 5: Write a smoke test for the toolchain**

Create `src/App.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App smoke test', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run the test to verify the toolchain works**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript + Tailwind + Vitest toolchain"
```

---

### Task 2: Firebase project wiring

**Files:**
- Create: `src/firebase/config.ts`, `.env.example`, `firebase.json`, `firestore.rules`
- Test: `src/firebase/config.test.ts`

**Interfaces:**
- Produces: `app` (FirebaseApp), `auth` (Auth), `db` (Firestore) exported from `src/firebase/config.ts`. Every later Firestore/Auth module imports `auth`/`db` from here.

- [ ] **Step 1: Write the failing test**

Create `src/firebase/config.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ name: 'mock-auth' })),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ name: 'mock-db' })),
}));

describe('firebase config', () => {
  it('exports an initialized app, auth, and db', async () => {
    const { app, auth, db } = await import('./config');
    expect(app).toEqual({ name: 'mock-app' });
    expect(auth).toEqual({ name: 'mock-auth' });
    expect(db).toEqual({ name: 'mock-db' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/firebase/config.test.ts`
Expected: FAIL with "Cannot find module './config'" or similar

- [ ] **Step 3: Write the implementation**

Create `src/firebase/config.ts`:

```ts
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
```

Create `.env.example`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Create `firestore.rules` (restricts every user to their own subtree, per spec §7):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Create `firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/firebase/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/firebase .env.example firebase.json firestore.rules
git commit -m "feat: wire Firebase app/auth/firestore config and security rules"
```

---

### Task 3: Shared domain types and date utilities

**Files:**
- Create: `src/domains/shared/types.ts`, `src/domains/shared/dateUtils.ts`
- Test: `src/domains/shared/dateUtils.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `DomainKey`, `DailyCompletion { date: string; workout: boolean; learning: boolean; chores: Record<string, boolean> }`, `ChoreConfig { id: string; name: string; cadence: 'daily' | 'weekly'; weeklyDays?: number[] }`, `WorkoutLogEntry { id: string; date: string; exercise: string; detail: string; notes?: string }`, `LearningLogEntry { id: string; date: string; note: string }`, `DueItem { id: string; label: string; domain: DomainKey }`
  - `dateUtils.ts`: `todayId(now?: Date): string`, `dayOfWeek(dateId: string): number`

- [ ] **Step 1: Write the failing test**

Create `src/domains/shared/dateUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { todayId, dayOfWeek } from './dateUtils';

describe('todayId', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2026, 6, 20); // July 20, 2026 (month is 0-indexed)
    expect(todayId(date)).toBe('2026-07-20');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(todayId(date)).toBe('2026-01-05');
  });
});

describe('dayOfWeek', () => {
  it('returns 0 for a Sunday date id', () => {
    expect(dayOfWeek('2026-07-19')).toBe(0);
  });

  it('returns 1 for a Monday date id', () => {
    expect(dayOfWeek('2026-07-20')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domains/shared/dateUtils.test.ts`
Expected: FAIL with "Cannot find module './dateUtils'"

- [ ] **Step 3: Write the implementation**

Create `src/domains/shared/types.ts`:

```ts
export type DomainKey = 'workout' | 'learning' | 'chores';

export interface DailyCompletion {
  date: string;
  workout: boolean;
  learning: boolean;
  chores: Record<string, boolean>;
}

export interface ChoreConfig {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}

export interface WorkoutLogEntry {
  id: string;
  date: string;
  exercise: string;
  detail: string;
  notes?: string;
}

export interface LearningLogEntry {
  id: string;
  date: string;
  note: string;
}

export interface DueItem {
  id: string;
  label: string;
  domain: DomainKey;
}
```

Create `src/domains/shared/dateUtils.ts`:

```ts
export function todayId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayOfWeek(dateId: string): number {
  return new Date(`${dateId}T00:00:00`).getDay();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domains/shared/dateUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/shared/types.ts src/domains/shared/dateUtils.ts src/domains/shared/dateUtils.test.ts
git commit -m "feat: add shared domain types and date utilities"
```

---

### Task 4: Completions API (shared Firestore module)

**Files:**
- Create: `src/domains/shared/completionsApi.ts`
- Test: `src/domains/shared/completionsApi.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; `DailyCompletion` from `./types`; `todayId` from `./dateUtils`
- Produces: `completionDocRef(uid: string, date: string)`, `getCompletion(uid: string, date?: string): Promise<DailyCompletion>`, `listRecentCompletions(uid: string, days: number): Promise<DailyCompletion[]>`, `setWorkoutDone(uid: string, done: boolean, date?: string): Promise<void>`, `setLearningDone(uid: string, done: boolean, date?: string): Promise<void>`, `setChoreDone(uid: string, choreId: string, done: boolean, date?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/domains/shared/completionsApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((...args: unknown[]) => ({ path: args.join('/') }));
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn(() => ({}));
const mockOrderBy = vi.fn(() => ({}));
const mockLimit = vi.fn(() => ({}));
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import {
  getCompletion,
  listRecentCompletions,
  setWorkoutDone,
  setLearningDone,
  setChoreDone,
} from './completionsApi';

describe('completionsApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('returns an empty completion when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: false, learning: false, chores: {} });
  });

  it('returns the stored completion when a doc exists', async () => {
    const stored = { date: '2026-07-20', workout: true, learning: false, chores: { c1: true } };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual(stored);
  });

  it('setWorkoutDone merges the workout flag', async () => {
    await setWorkoutDone('user1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', workout: true },
      { merge: true }
    );
  });

  it('setLearningDone merges the learning flag', async () => {
    await setLearningDone('user1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', learning: true },
      { merge: true }
    );
  });

  it('setChoreDone merges a single chore flag', async () => {
    await setChoreDone('user1', 'c1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', chores: { c1: true } },
      { merge: true }
    );
  });

  it('listRecentCompletions returns completions ordered most-recent-first', async () => {
    const days = [
      { date: '2026-07-20', workout: true, learning: true, chores: {} },
      { date: '2026-07-19', workout: true, learning: false, chores: {} },
    ];
    mockGetDocs.mockResolvedValue({ docs: days.map((d) => ({ data: () => d })) });
    const result = await listRecentCompletions('user1', 7);
    expect(result).toEqual(days);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domains/shared/completionsApi.test.ts`
Expected: FAIL with "Cannot find module './completionsApi'"

- [ ] **Step 3: Write the implementation**

Create `src/domains/shared/completionsApi.ts`:

```ts
import { collection, doc, getDoc, getDocs, orderBy, limit, query, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DailyCompletion } from './types';
import { todayId } from './dateUtils';

export function completionDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'completions', date);
}

export async function getCompletion(uid: string, date: string = todayId()): Promise<DailyCompletion> {
  const snap = await getDoc(completionDocRef(uid, date));
  if (snap.exists()) {
    return snap.data() as DailyCompletion;
  }
  return { date, workout: false, learning: false, chores: {} };
}

export async function listRecentCompletions(uid: string, days: number): Promise<DailyCompletion[]> {
  const q = query(
    collection(db, 'users', uid, 'completions'),
    orderBy('date', 'desc'),
    limit(days)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DailyCompletion);
}

export async function setWorkoutDone(uid: string, done: boolean, date: string = todayId()): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, workout: done }, { merge: true });
}

export async function setLearningDone(uid: string, done: boolean, date: string = todayId()): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, learning: done }, { merge: true });
}

export async function setChoreDone(
  uid: string,
  choreId: string,
  done: boolean,
  date: string = todayId()
): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, chores: { [choreId]: done } }, { merge: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domains/shared/completionsApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/shared/completionsApi.ts src/domains/shared/completionsApi.test.ts
git commit -m "feat: add shared completions Firestore API"
```

---

### Task 5: Auth hook and Login screen

**Files:**
- Create: `src/auth/useAuth.ts`, `src/auth/Login.tsx`
- Test: `src/auth/useAuth.test.ts`, `src/auth/Login.test.tsx`

**Interfaces:**
- Consumes: `auth` from `src/firebase/config.ts`
- Produces: `useAuth(): { user: User | null; loading: boolean }`, `signIn(email: string, password: string): Promise<UserCredential>`, `signUp(email: string, password: string): Promise<UserCredential>`, `signOutUser(): Promise<void>`, `<Login />` component (no props)

- [ ] **Step 1: Write the failing test for useAuth**

Create `src/auth/useAuth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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
    capturedCallback?.(fakeUser);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(fakeUser);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/auth/useAuth.test.ts`
Expected: FAIL with "Cannot find module './useAuth'"

- [ ] **Step 3: Write the useAuth implementation**

Create `src/auth/useAuth.ts`:

```ts
import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
} from 'firebase/auth';
import { auth } from '../firebase/config';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
    return unsubscribe;
  }, []);

  return state;
}

export function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUp(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/auth/useAuth.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for Login**

Create `src/auth/Login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSignIn = vi.fn().mockResolvedValue(undefined);
const mockSignUp = vi.fn().mockResolvedValue(undefined);

vi.mock('./useAuth', () => ({
  signIn: (...args: [string, string]) => mockSignIn(...args),
  signUp: (...args: [string, string]) => mockSignUp(...args),
}));

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockSignUp.mockClear();
  });

  it('submits sign-in with the entered email and password', async () => {
    render(<Login />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Email'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockSignIn).toHaveBeenCalledWith('me@example.com', 'hunter2');
  });

  it('switches to sign-up mode and submits signUp instead', async () => {
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /need an account/i }));
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'hunter2');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/auth/Login.test.tsx`
Expected: FAIL with "Cannot find module './Login'"

- [ ] **Step 7: Write the Login implementation**

Create `src/auth/Login.tsx`:

```tsx
import { useState, FormEvent } from 'react';
import { signIn, signUp } from './useAuth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm mx-auto mt-20 p-6">
      <h1 className="text-xl font-semibold">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded px-3 py-2"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border rounded px-3 py-2"
        required
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
        {mode === 'signin' ? 'Sign in' : 'Sign up'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        className="text-sm text-blue-600 underline"
      >
        {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/auth/Login.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/auth
git commit -m "feat: add email/password auth hook and Login screen"
```

---

### Task 6: Shared UI components — StatusChip and PunchInButton

**Files:**
- Create: `src/components/StatusChip.tsx`, `src/components/PunchInButton.tsx`
- Test: `src/components/StatusChip.test.tsx`, `src/components/PunchInButton.test.tsx`

**Interfaces:**
- Produces: `type ChipStatus = 'done' | 'in-progress' | 'not-started'`, `<StatusChip label: string status: ChipStatus detail?: string onClick?: () => void />`, `<PunchInButton done: boolean onToggle: () => void />`

- [ ] **Step 1: Write the failing test for StatusChip**

Create `src/components/StatusChip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('renders the label and detail', () => {
    render(<StatusChip label="Workout" status="done" detail="1 entry logged" />);
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('1 entry logged')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<StatusChip label="Learning" status="not-started" onClick={onClick} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Learning'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/StatusChip.test.tsx`
Expected: FAIL with "Cannot find module './StatusChip'"

- [ ] **Step 3: Write the StatusChip implementation**

Create `src/components/StatusChip.tsx`:

```tsx
export type ChipStatus = 'done' | 'in-progress' | 'not-started';

export interface StatusChipProps {
  label: string;
  status: ChipStatus;
  detail?: string;
  onClick?: () => void;
}

const dotColor: Record<ChipStatus, string> = {
  done: 'bg-green-500',
  'in-progress': 'bg-amber-500',
  'not-started': 'bg-gray-400',
};

export function StatusChip({ label, status, detail, onClick }: StatusChipProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1 border rounded-lg p-3 text-left w-full"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor[status]}`} data-testid="status-dot" />
        <span className="font-medium">{label}</span>
      </div>
      {detail && <span className="text-sm text-gray-500">{detail}</span>}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/StatusChip.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for PunchInButton**

Create `src/components/PunchInButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PunchInButton } from './PunchInButton';

describe('PunchInButton', () => {
  it('shows "Punch In" when not done and calls onToggle when clicked', async () => {
    const onToggle = vi.fn();
    render(<PunchInButton done={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Punch In' });
    const user = userEvent.setup();
    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the done state when already punched in', () => {
    render(<PunchInButton done={true} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Punched in/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/components/PunchInButton.test.tsx`
Expected: FAIL with "Cannot find module './PunchInButton'"

- [ ] **Step 7: Write the PunchInButton implementation**

Create `src/components/PunchInButton.tsx`:

```tsx
export interface PunchInButtonProps {
  done: boolean;
  onToggle: () => void;
}

export function PunchInButton({ done, onToggle }: PunchInButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2 rounded font-semibold ${done ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}
    >
      {done ? 'Punched in ✓' : 'Punch In'}
    </button>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/components/PunchInButton.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components
git commit -m "feat: add StatusChip and PunchInButton shared components"
```

---

### Task 7: Chores domain — API and screen

**Files:**
- Create: `src/domains/chores/choresApi.ts`, `src/domains/chores/ChoresScreen.tsx`
- Test: `src/domains/chores/choresApi.test.ts`, `src/domains/chores/ChoresScreen.test.tsx`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; `ChoreConfig` from `../shared/types`; `getCompletion`, `setChoreDone` from `../shared/completionsApi`; `todayId`, `dayOfWeek` from `../shared/dateUtils`
- Produces: `listChores(uid: string): Promise<ChoreConfig[]>`, `saveChore(uid: string, chore: ChoreConfig): Promise<void>`, `deleteChore(uid: string, choreId: string): Promise<void>`, `isChoreDueToday(chore: ChoreConfig, dow: number): boolean`, `<ChoresScreen uid: string />`

- [ ] **Step 1: Write the failing test for isChoreDueToday (pure logic)**

Create `src/domains/chores/choresApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChoreConfig } from '../shared/types';

const mockCollection = vi.fn(() => ({}));
const mockDoc = vi.fn(() => ({}));
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listChores, saveChore, deleteChore, isChoreDueToday } from './choresApi';

describe('isChoreDueToday', () => {
  it('is always due for daily chores', () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    expect(isChoreDueToday(chore, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const chore: ChoreConfig = { id: 'c2', name: 'Laundry', cadence: 'weekly', weeklyDays: [0, 3] };
    expect(isChoreDueToday(chore, 3)).toBe(true);
    expect(isChoreDueToday(chore, 1)).toBe(false);
  });

  it('is not due for weekly chores with no matching days configured', () => {
    const chore: ChoreConfig = { id: 'c3', name: 'Trash', cadence: 'weekly' };
    expect(isChoreDueToday(chore, 3)).toBe(false);
  });
});

describe('choresApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listChores maps Firestore docs to ChoreConfig objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'c1', data: () => ({ name: 'Dishes', cadence: 'daily', weeklyDays: null }) }],
    });
    const result = await listChores('user1');
    expect(result).toEqual([{ id: 'c1', name: 'Dishes', cadence: 'daily', weeklyDays: null }]);
  });

  it('saveChore writes the chore fields', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    await saveChore('user1', chore);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Dishes',
      cadence: 'daily',
      weeklyDays: null,
    });
  });

  it('deleteChore removes the chore doc', async () => {
    await deleteChore('user1', 'c1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domains/chores/choresApi.test.ts`
Expected: FAIL with "Cannot find module './choresApi'"

- [ ] **Step 3: Write the choresApi implementation**

Create `src/domains/chores/choresApi.ts`:

```ts
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ChoreConfig } from '../shared/types';

export async function listChores(uid: string): Promise<ChoreConfig[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'chores'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChoreConfig, 'id'>) }));
}

export async function saveChore(uid: string, chore: ChoreConfig): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'chores', chore.id), {
    name: chore.name,
    cadence: chore.cadence,
    weeklyDays: chore.weeklyDays ?? null,
  });
}

export async function deleteChore(uid: string, choreId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'chores', choreId));
}

export function isChoreDueToday(chore: ChoreConfig, dow: number): boolean {
  if (chore.cadence === 'daily') return true;
  return chore.weeklyDays?.includes(dow) ?? false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domains/chores/choresApi.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for ChoresScreen**

Create `src/domains/chores/ChoresScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockListChores = vi.fn();
const mockSaveChore = vi.fn().mockResolvedValue(undefined);
const mockGetCompletion = vi.fn();
const mockSetChoreDone = vi.fn().mockResolvedValue(undefined);

vi.mock('./choresApi', async () => {
  const actual = await vi.importActual<typeof import('./choresApi')>('./choresApi');
  return {
    ...actual,
    listChores: (...args: [string]) => mockListChores(...args),
    saveChore: (...args: [string, unknown]) => mockSaveChore(...args),
  };
});
vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setChoreDone: (...args: [string, string, boolean]) => mockSetChoreDone(...args),
}));

import { ChoresScreen } from './ChoresScreen';

describe('ChoresScreen', () => {
  beforeEach(() => {
    mockListChores.mockReset();
    mockGetCompletion.mockReset();
    mockSaveChore.mockClear();
    mockSetChoreDone.mockClear();
  });

  it('lists chores and lets you mark one done', async () => {
    mockListChores.mockResolvedValue([{ id: 'c1', name: 'Dishes', cadence: 'daily' }]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    render(<ChoresScreen uid="user1" />);

    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /Dishes/ }));

    expect(mockSetChoreDone).toHaveBeenCalledWith('user1', 'c1', true);
  });

  it('adds a new daily chore', async () => {
    mockListChores.mockResolvedValue([]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    render(<ChoresScreen uid="user1" />);
    await waitFor(() => expect(mockListChores).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('New chore name'), 'Vacuum');
    await user.click(screen.getByRole('button', { name: 'Add chore' }));

    expect(mockSaveChore).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ name: 'Vacuum', cadence: 'daily' })
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/domains/chores/ChoresScreen.test.tsx`
Expected: FAIL with "Cannot find module './ChoresScreen'"

- [ ] **Step 7: Write the ChoresScreen implementation**

Create `src/domains/chores/ChoresScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { listChores, saveChore, isChoreDueToday } from './choresApi';
import { getCompletion, setChoreDone } from '../shared/completionsApi';
import { ChoreConfig, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';

export function ChoresScreen({ uid }: { uid: string }) {
  const [chores, setChores] = useState<ChoreConfig[]>([]);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [newChoreName, setNewChoreName] = useState('');

  useEffect(() => {
    listChores(uid).then(setChores);
    getCompletion(uid).then(setCompletion);
  }, [uid]);

  async function handleToggle(choreId: string, done: boolean) {
    await setChoreDone(uid, choreId, done);
    setCompletion((prev) =>
      prev ? { ...prev, chores: { ...prev.chores, [choreId]: done } } : prev
    );
  }

  async function handleAddChore(e: FormEvent) {
    e.preventDefault();
    if (!newChoreName.trim()) return;
    const chore: ChoreConfig = {
      id: crypto.randomUUID(),
      name: newChoreName.trim(),
      cadence: 'daily',
    };
    await saveChore(uid, chore);
    setChores((prev) => [...prev, chore]);
    setNewChoreName('');
  }

  const dow = dayOfWeek(todayId());

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Chores</h1>
      <ul className="flex flex-col gap-2">
        {chores.map((chore) => {
          const dueToday = isChoreDueToday(chore, dow);
          const done = completion?.chores[chore.id] ?? false;
          return (
            <li key={chore.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={chore.name}
                checked={done}
                disabled={!dueToday}
                onChange={(e) => handleToggle(chore.id, e.target.checked)}
              />
              <span>{chore.name}</span>
              {!dueToday && <span className="text-xs text-gray-400">(not due today)</span>}
            </li>
          );
        })}
      </ul>
      <form onSubmit={handleAddChore} className="flex gap-2">
        <input
          type="text"
          placeholder="New chore name"
          value={newChoreName}
          onChange={(e) => setNewChoreName(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
          Add chore
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/domains/chores/ChoresScreen.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/domains/chores
git commit -m "feat: add chores domain API and screen"
```

---

### Task 8: Workout domain — API and screen

**Files:**
- Create: `src/domains/workout/workoutApi.ts`, `src/domains/workout/WorkoutScreen.tsx`
- Test: `src/domains/workout/workoutApi.test.ts`, `src/domains/workout/WorkoutScreen.test.tsx`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; `WorkoutLogEntry` from `../shared/types`; `getCompletion`, `setWorkoutDone` from `../shared/completionsApi`; `todayId` from `../shared/dateUtils`
- Produces: `addWorkoutLogEntry(uid: string, entry: Omit<WorkoutLogEntry, 'id'>): Promise<string>`, `listWorkoutLogEntries(uid: string): Promise<WorkoutLogEntry[]>`, `<WorkoutScreen uid: string />`

- [ ] **Step 1: Write the failing test for workoutApi**

Create `src/domains/workout/workoutApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn(() => ({}));
const mockOrderBy = vi.fn(() => ({}));
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addWorkoutLogEntry, listWorkoutLogEntries } from './workoutApi';

describe('workoutApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addWorkoutLogEntry writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'entry1' });
    const id = await addWorkoutLogEntry('user1', {
      date: '2026-07-20',
      exercise: 'Squats',
      detail: '3x10',
    });
    expect(id).toBe('entry1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      exercise: 'Squats',
      detail: '3x10',
    });
  });

  it('listWorkoutLogEntries maps docs to WorkoutLogEntry objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'entry1', data: () => ({ date: '2026-07-20', exercise: 'Squats', detail: '3x10' }) }],
    });
    const result = await listWorkoutLogEntries('user1');
    expect(result).toEqual([{ id: 'entry1', date: '2026-07-20', exercise: 'Squats', detail: '3x10' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domains/workout/workoutApi.test.ts`
Expected: FAIL with "Cannot find module './workoutApi'"

- [ ] **Step 3: Write the workoutApi implementation**

Create `src/domains/workout/workoutApi.ts`:

```ts
import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WorkoutLogEntry } from '../shared/types';

export async function addWorkoutLogEntry(
  uid: string,
  entry: Omit<WorkoutLogEntry, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'workoutLog'), entry);
  return ref.id;
}

export async function listWorkoutLogEntries(uid: string): Promise<WorkoutLogEntry[]> {
  const q = query(collection(db, 'users', uid, 'workoutLog'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkoutLogEntry, 'id'>) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domains/workout/workoutApi.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for WorkoutScreen**

Create `src/domains/workout/WorkoutScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetCompletion = vi.fn();
const mockSetWorkoutDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue('entry1');

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setWorkoutDone: (...args: [string, boolean]) => mockSetWorkoutDone(...args),
}));
vi.mock('./workoutApi', () => ({
  listWorkoutLogEntries: (...args: [string]) => mockListEntries(...args),
  addWorkoutLogEntry: (...args: [string, unknown]) => mockAddEntry(...args),
}));

import { WorkoutScreen } from './WorkoutScreen';

describe('WorkoutScreen', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockSetWorkoutDone.mockClear();
    mockListEntries.mockReset();
    mockAddEntry.mockClear();
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<WorkoutScreen uid="user1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetWorkoutDone).toHaveBeenCalledWith('user1', true);
  });

  it('adds a log entry', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<WorkoutScreen uid="user1" />);
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Exercise'), 'Squats');
    await user.type(screen.getByPlaceholderText('Detail (e.g. 3x10 or 30 min)'), '3x10');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddEntry).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ exercise: 'Squats', detail: '3x10' })
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/domains/workout/WorkoutScreen.test.tsx`
Expected: FAIL with "Cannot find module './WorkoutScreen'"

- [ ] **Step 7: Write the WorkoutScreen implementation**

Create `src/domains/workout/WorkoutScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setWorkoutDone } from '../shared/completionsApi';
import { listWorkoutLogEntries, addWorkoutLogEntry } from './workoutApi';
import { WorkoutLogEntry, DailyCompletion } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';

export function WorkoutScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [exercise, setExercise] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    getCompletion(uid).then(setCompletion);
    listWorkoutLogEntries(uid).then(setEntries);
  }, [uid]);

  async function handlePunchIn() {
    const done = !(completion?.workout ?? false);
    await setWorkoutDone(uid, done);
    setCompletion((prev) => (prev ? { ...prev, workout: done } : prev));
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!exercise.trim() || !detail.trim()) return;
    const entry: Omit<WorkoutLogEntry, 'id'> = { date: todayId(), exercise, detail };
    const id = await addWorkoutLogEntry(uid, entry);
    setEntries((prev) => [{ id, ...entry }, ...prev]);
    setExercise('');
    setDetail('');
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Workout</h1>
      <PunchInButton done={completion?.workout ?? false} onToggle={handlePunchIn} />
      <form onSubmit={handleAddEntry} className="flex gap-2">
        <input
          type="text"
          placeholder="Exercise"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Detail (e.g. 3x10 or 30 min)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
          Add entry
        </button>
      </form>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="text-sm">
            {entry.date} — {entry.exercise} ({entry.detail})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/domains/workout/WorkoutScreen.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/domains/workout
git commit -m "feat: add workout domain API and screen"
```

---

### Task 9: Learning domain — API and screen

**Files:**
- Create: `src/domains/learning/learningApi.ts`, `src/domains/learning/LearningScreen.tsx`
- Test: `src/domains/learning/learningApi.test.ts`, `src/domains/learning/LearningScreen.test.tsx`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; `LearningLogEntry` from `../shared/types`; `getCompletion`, `setLearningDone` from `../shared/completionsApi`; `todayId` from `../shared/dateUtils`
- Produces: `addLearningLogEntry(uid: string, entry: Omit<LearningLogEntry, 'id'>): Promise<string>`, `listLearningLogEntries(uid: string): Promise<LearningLogEntry[]>`, `<LearningScreen uid: string />`

- [ ] **Step 1: Write the failing test for learningApi**

Create `src/domains/learning/learningApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn(() => ({}));
const mockOrderBy = vi.fn(() => ({}));
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addLearningLogEntry, listLearningLogEntries } from './learningApi';

describe('learningApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addLearningLogEntry writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'entry1' });
    const id = await addLearningLogEntry('user1', { date: '2026-07-20', note: 'Read chapter 3' });
    expect(id).toBe('entry1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      note: 'Read chapter 3',
    });
  });

  it('listLearningLogEntries maps docs to LearningLogEntry objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'entry1', data: () => ({ date: '2026-07-20', note: 'Read chapter 3' }) }],
    });
    const result = await listLearningLogEntries('user1');
    expect(result).toEqual([{ id: 'entry1', date: '2026-07-20', note: 'Read chapter 3' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domains/learning/learningApi.test.ts`
Expected: FAIL with "Cannot find module './learningApi'"

- [ ] **Step 3: Write the learningApi implementation**

Create `src/domains/learning/learningApi.ts`:

```ts
import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LearningLogEntry } from '../shared/types';

export async function addLearningLogEntry(
  uid: string,
  entry: Omit<LearningLogEntry, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'learningLog'), entry);
  return ref.id;
}

export async function listLearningLogEntries(uid: string): Promise<LearningLogEntry[]> {
  const q = query(collection(db, 'users', uid, 'learningLog'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LearningLogEntry, 'id'>) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domains/learning/learningApi.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for LearningScreen**

Create `src/domains/learning/LearningScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetCompletion = vi.fn();
const mockSetLearningDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue('entry1');

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setLearningDone: (...args: [string, boolean]) => mockSetLearningDone(...args),
}));
vi.mock('./learningApi', () => ({
  listLearningLogEntries: (...args: [string]) => mockListEntries(...args),
  addLearningLogEntry: (...args: [string, unknown]) => mockAddEntry(...args),
}));

import { LearningScreen } from './LearningScreen';

describe('LearningScreen', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockSetLearningDone.mockClear();
    mockListEntries.mockReset();
    mockAddEntry.mockClear();
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<LearningScreen uid="user1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetLearningDone).toHaveBeenCalledWith('user1', true);
  });

  it('adds a note entry', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    render(<LearningScreen uid="user1" />);
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you study?'), 'Read chapter 3');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddEntry).toHaveBeenCalledWith('user1', expect.objectContaining({ note: 'Read chapter 3' }));
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/domains/learning/LearningScreen.test.tsx`
Expected: FAIL with "Cannot find module './LearningScreen'"

- [ ] **Step 7: Write the LearningScreen implementation**

Create `src/domains/learning/LearningScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setLearningDone } from '../shared/completionsApi';
import { listLearningLogEntries, addLearningLogEntry } from './learningApi';
import { LearningLogEntry, DailyCompletion } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';

export function LearningScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<LearningLogEntry[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    getCompletion(uid).then(setCompletion);
    listLearningLogEntries(uid).then(setEntries);
  }, [uid]);

  async function handlePunchIn() {
    const done = !(completion?.learning ?? false);
    await setLearningDone(uid, done);
    setCompletion((prev) => (prev ? { ...prev, learning: done } : prev));
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const entry: Omit<LearningLogEntry, 'id'> = { date: todayId(), note };
    const id = await addLearningLogEntry(uid, entry);
    setEntries((prev) => [{ id, ...entry }, ...prev]);
    setNote('');
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Learning</h1>
      <PunchInButton done={completion?.learning ?? false} onToggle={handlePunchIn} />
      <form onSubmit={handleAddEntry} className="flex gap-2">
        <input
          type="text"
          placeholder="What did you study?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
          Add entry
        </button>
      </form>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="text-sm">
            {entry.date} — {entry.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/domains/learning/LearningScreen.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/domains/learning
git commit -m "feat: add learning domain API and screen"
```

---

### Task 10: Dashboard logic (pure functions)

**Files:**
- Create: `src/dashboard/dashboardLogic.ts`
- Test: `src/dashboard/dashboardLogic.test.ts`

**Interfaces:**
- Consumes: `DailyCompletion`, `ChoreConfig`, `DueItem` from `../domains/shared/types`; `isChoreDueToday` from `../domains/chores/choresApi`
- Produces: `computeStreak(completions: DailyCompletion[]): number`, `computeDueItems(chores: ChoreConfig[], completion: DailyCompletion, dow: number): DueItem[]`, `computeDayHealth(completion: DailyCompletion, dueTodayChoreIds: string[]): number`

- [ ] **Step 1: Write the failing test**

Create `src/dashboard/dashboardLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeStreak, computeDueItems, computeDayHealth } from './dashboardLogic';
import { ChoreConfig, DailyCompletion } from '../domains/shared/types';

describe('computeStreak', () => {
  it('counts consecutive days (most recent first) where both workout and learning are done', () => {
    const history: DailyCompletion[] = [
      { date: '2026-07-20', workout: true, learning: true, chores: {} },
      { date: '2026-07-19', workout: true, learning: true, chores: {} },
      { date: '2026-07-18', workout: true, learning: false, chores: {} },
    ];
    expect(computeStreak(history)).toBe(2);
  });

  it('returns 0 when today is not fully done', () => {
    const history: DailyCompletion[] = [
      { date: '2026-07-20', workout: false, learning: true, chores: {} },
    ];
    expect(computeStreak(history)).toBe(0);
  });
});

describe('computeDueItems', () => {
  const chores: ChoreConfig[] = [
    { id: 'c1', name: 'Dishes', cadence: 'daily' },
    { id: 'c2', name: 'Laundry', cadence: 'weekly', weeklyDays: [1] },
  ];

  it('lists due, not-yet-done chores only', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: { c1: true },
    };
    const result = computeDueItems(chores, completion, 1);
    expect(result).toEqual([{ id: 'c2', label: 'Laundry', domain: 'chores' }]);
  });
});

describe('computeDayHealth', () => {
  it('computes percentage of done tasks including due chores', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: false,
      chores: { c1: true },
    };
    expect(computeDayHealth(completion, ['c1'])).toBe(67);
  });

  it('returns 100 when there are no tasks at all', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: {},
    };
    // workout + learning always count as 2 base tasks, so this case only
    // arises hypothetically; guard against division by zero regardless.
    expect(computeDayHealth(completion, [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/dashboard/dashboardLogic.test.ts`
Expected: FAIL with "Cannot find module './dashboardLogic'"

- [ ] **Step 3: Write the implementation**

Create `src/dashboard/dashboardLogic.ts`:

```ts
import { ChoreConfig, DailyCompletion, DueItem } from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';

export function computeStreak(completions: DailyCompletion[]): number {
  let streak = 0;
  for (const c of completions) {
    if (c.workout && c.learning) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function computeDueItems(
  chores: ChoreConfig[],
  completion: DailyCompletion,
  dow: number
): DueItem[] {
  return chores
    .filter((c) => isChoreDueToday(c, dow) && !completion.chores[c.id])
    .map((c) => ({ id: c.id, label: c.name, domain: 'chores' as const }));
}

export function computeDayHealth(completion: DailyCompletion, dueTodayChoreIds: string[]): number {
  const totalTasks = 2 + dueTodayChoreIds.length;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length;
  return totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/dashboard/dashboardLogic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/dashboardLogic.ts src/dashboard/dashboardLogic.test.ts
git commit -m "feat: add dashboard streak, due-items, and day-health calculations"
```

---

### Task 11: DueNowStrip component

**Files:**
- Create: `src/dashboard/DueNowStrip.tsx`
- Test: `src/dashboard/DueNowStrip.test.tsx`

**Interfaces:**
- Consumes: `DueItem` from `../domains/shared/types`
- Produces: `<DueNowStrip items: DueItem[] />`

- [ ] **Step 1: Write the failing test**

Create `src/dashboard/DueNowStrip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DueNowStrip } from './DueNowStrip';

describe('DueNowStrip', () => {
  it('shows a message when nothing is due', () => {
    render(<DueNowStrip items={[]} />);
    expect(screen.getByText('Nothing due right now.')).toBeInTheDocument();
  });

  it('lists each due item label', () => {
    render(
      <DueNowStrip
        items={[
          { id: 'c1', label: 'Laundry', domain: 'chores' },
          { id: 'c2', label: 'Trash', domain: 'chores' },
        ]}
      />
    );
    expect(screen.getByText('Laundry')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/dashboard/DueNowStrip.test.tsx`
Expected: FAIL with "Cannot find module './DueNowStrip'"

- [ ] **Step 3: Write the implementation**

Create `src/dashboard/DueNowStrip.tsx`:

```tsx
import { DueItem } from '../domains/shared/types';

export function DueNowStrip({ items }: { items: DueItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Nothing due right now.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id} className="text-sm bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/dashboard/DueNowStrip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/DueNowStrip.tsx src/dashboard/DueNowStrip.test.tsx
git commit -m "feat: add DueNowStrip component"
```

---

### Task 12: Dashboard data hook and Dashboard screen

**Files:**
- Create: `src/dashboard/useDashboardData.ts`, `src/dashboard/Dashboard.tsx`
- Test: `src/dashboard/useDashboardData.test.ts`, `src/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `getCompletion`, `listRecentCompletions` from `../domains/shared/completionsApi`; `listChores` from `../domains/chores/choresApi`; `computeStreak`, `computeDueItems`, `computeDayHealth` from `./dashboardLogic`; `todayId`, `dayOfWeek` from `../domains/shared/dateUtils`; `StatusChip` from `../components/StatusChip`; `PunchInButton` from `../components/PunchInButton`; `DueNowStrip` from `./DueNowStrip`
- Produces: `useDashboardData(uid: string): { loading: boolean; completion: DailyCompletion | null; chores: ChoreConfig[]; dueItems: DueItem[]; streak: number; dayHealth: number }`, `<Dashboard uid: string onNavigate: (path: string) => void />`

- [ ] **Step 1: Write the failing test for useDashboardData**

Create `src/dashboard/useDashboardData.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetCompletion = vi.fn();
const mockListRecentCompletions = vi.fn();
const mockListChores = vi.fn();

vi.mock('../domains/shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  listRecentCompletions: (...args: [string, number]) => mockListRecentCompletions(...args),
}));
vi.mock('../domains/chores/choresApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/chores/choresApi')>(
    '../domains/chores/choresApi'
  );
  return { ...actual, listChores: (...args: [string]) => mockListChores(...args) };
});

import { useDashboardData } from './useDashboardData';

describe('useDashboardData', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockListRecentCompletions.mockReset();
    mockListChores.mockReset();
  });

  it('loads completion, recent history, and chores, then computes streak, due items, and day health', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: { c1: true },
    });
    mockListRecentCompletions.mockResolvedValue([
      { date: '2026-07-20', workout: true, learning: true, chores: { c1: true } },
      { date: '2026-07-19', workout: true, learning: true, chores: {} },
      { date: '2026-07-18', workout: false, learning: true, chores: {} },
    ]);
    mockListChores.mockResolvedValue([
      { id: 'c1', name: 'Dishes', cadence: 'daily' },
      { id: 'c2', name: 'Laundry', cadence: 'daily' },
    ]);

    const { result } = renderHook(() => useDashboardData('user1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListRecentCompletions).toHaveBeenCalledWith('user1', 30);
    expect(result.current.streak).toBe(2);
    expect(result.current.dueItems).toEqual([{ id: 'c2', label: 'Laundry', domain: 'chores' }]);
    expect(result.current.dayHealth).toBe(75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/dashboard/useDashboardData.test.ts`
Expected: FAIL with "Cannot find module './useDashboardData'"

- [ ] **Step 3: Write the useDashboardData implementation**

Create `src/dashboard/useDashboardData.ts`:

```ts
import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { ChoreConfig, DailyCompletion, DueItem } from '../domains/shared/types';
import { todayId, dayOfWeek } from '../domains/shared/dateUtils';
import { computeStreak, computeDueItems, computeDayHealth } from './dashboardLogic';

const STREAK_HISTORY_DAYS = 30;

export interface DashboardData {
  loading: boolean;
  completion: DailyCompletion | null;
  chores: ChoreConfig[];
  dueItems: DueItem[];
  streak: number;
  dayHealth: number;
}

export function useDashboardData(uid: string): DashboardData {
  const [loading, setLoading] = useState(true);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [history, setHistory] = useState<DailyCompletion[]>([]);
  const [chores, setChores] = useState<ChoreConfig[]>([]);

  useEffect(() => {
    Promise.all([
      getCompletion(uid),
      listRecentCompletions(uid, STREAK_HISTORY_DAYS),
      listChores(uid),
    ]).then(([todayCompletion, recentHistory, choreList]) => {
      setCompletion(todayCompletion);
      setHistory(recentHistory);
      setChores(choreList);
      setLoading(false);
    });
  }, [uid]);

  if (!completion) {
    return { loading, completion: null, chores: [], dueItems: [], streak: 0, dayHealth: 0 };
  }

  const dow = dayOfWeek(todayId());
  const dueItems = computeDueItems(chores, completion, dow);
  const dueTodayChoreIds = chores
    .filter((c) => isChoreDueToday(c, dow))
    .map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds);

  return { loading, completion, chores, dueItems, streak, dayHealth };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/dashboard/useDashboardData.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for Dashboard**

Create `src/dashboard/Dashboard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./useDashboardData', () => ({
  useDashboardData: () => ({
    loading: false,
    completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
    chores: [],
    dueItems: [{ id: 'c1', label: 'Laundry', domain: 'chores' }],
    streak: 3,
    dayHealth: 50,
  }),
}));

import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders the streak, day health, chips, and due-now strip', () => {
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Chores')).toBeInTheDocument();
    expect(screen.getByText('Laundry')).toBeInTheDocument();
  });

  it('navigates when a chip is clicked', async () => {
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Workout'));
    expect(onNavigate).toHaveBeenCalledWith('/workout');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/dashboard/Dashboard.test.tsx`
Expected: FAIL with "Cannot find module './Dashboard'"

- [ ] **Step 7: Write the Dashboard implementation**

Create `src/dashboard/Dashboard.tsx`:

```tsx
import { useDashboardData } from './useDashboardData';
import { StatusChip } from '../components/StatusChip';
import { DueNowStrip } from './DueNowStrip';

export function Dashboard({ uid, onNavigate }: { uid: string; onNavigate: (path: string) => void }) {
  const { loading, completion, chores, dueItems, streak, dayHealth } = useDashboardData(uid);

  if (loading || !completion) {
    return <p className="p-6">Loading...</p>;
  }

  const choresDoneCount = chores.filter((c) => completion.chores[c.id]).length;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <p className="text-sm text-gray-500">{completion.date}</p>
        <p className="text-3xl font-bold">Streak: {streak}</p>
        <p className="text-lg">{dayHealth}% of today done</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatusChip
          label="Workout"
          status={completion.workout ? 'done' : 'not-started'}
          onClick={() => onNavigate('/workout')}
        />
        <StatusChip
          label="Learning"
          status={completion.learning ? 'done' : 'not-started'}
          onClick={() => onNavigate('/learning')}
        />
        <StatusChip
          label="Chores"
          status={
            chores.length === 0
              ? 'not-started'
              : choresDoneCount === chores.length
                ? 'done'
                : 'in-progress'
          }
          detail={`${choresDoneCount}/${chores.length}`}
          onClick={() => onNavigate('/chores')}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Due now</h2>
        <DueNowStrip items={dueItems} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/dashboard/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/dashboard/useDashboardData.ts src/dashboard/useDashboardData.test.ts src/dashboard/Dashboard.tsx src/dashboard/Dashboard.test.tsx
git commit -m "feat: add dashboard data hook and Dashboard screen"
```

---

### Task 13: App shell — auth gate and routing

**Files:**
- Modify: `src/App.tsx` (replaces the default Vite template content from Task 1), `src/App.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `./auth/useAuth`; `Login` from `./auth/Login`; `Dashboard` from `./dashboard/Dashboard`; `WorkoutScreen` from `./domains/workout/WorkoutScreen`; `LearningScreen` from `./domains/learning/LearningScreen`; `ChoresScreen` from `./domains/chores/ChoresScreen`

- [ ] **Step 1: Write the failing test**

Replace `src/App.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseAuth = vi.fn();
vi.mock('./auth/useAuth', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('./auth/Login', () => ({ Login: () => <div>Login screen</div> }));
vi.mock('./dashboard/Dashboard', () => ({
  Dashboard: ({ uid }: { uid: string }) => <div>Dashboard for {uid}</div>,
}));

import App from './App';

describe('App', () => {
  it('shows a loading state while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the Login screen when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('shows the Dashboard when signed in', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    render(<App />);
    expect(screen.getByText('Dashboard for user1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL (the default template App does not render "Loading...", "Login screen", or "Dashboard for user1")

- [ ] **Step 3: Write the App implementation**

Replace `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { Login } from './auth/Login';
import { Dashboard } from './dashboard/Dashboard';
import { WorkoutScreen } from './domains/workout/WorkoutScreen';
import { LearningScreen } from './domains/learning/LearningScreen';
import { ChoresScreen } from './domains/chores/ChoresScreen';

function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/" element={<Dashboard uid={uid} onNavigate={navigate} />} />
      <Route path="/workout" element={<WorkoutScreen uid={uid} />} />
      <Route path="/learning" element={<LearningScreen uid={uid} />} />
      <Route path="/chores" element={<ChoresScreen uid={uid} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <AuthedRoutes uid={user.uid} />
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests across all tasks)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire auth gate and routing for Dashboard, Workout, Learning, Chores"
```

---

### Task 14: Manual smoke test against a live Firebase project

**Files:** none (verification-only task)

**Interfaces:** none — this task exercises the whole app built in Tasks 1-13 against a real Firebase project.

- [ ] **Step 1: Create and configure the Firebase project**

Follow the "What you'll need to do yourself" checklist in `docs/superpowers/specs/2026-07-20-punch-in-complete-app-design.md`:
1. Create a Firebase project at console.firebase.google.com.
2. Enable Firestore, Authentication (Email/Password provider), and Hosting.
3. Copy the web app config values into a local `.env` file (copy `.env.example` to `.env` and fill in the values).

- [ ] **Step 2: Deploy the Firestore security rules**

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

- [ ] **Step 3: Run the app locally**

```bash
npm run dev
```

- [ ] **Step 4: Manually verify the golden path in a browser**

Open the local dev URL and confirm:
1. You land on the Login screen (not authenticated yet).
2. "Need an account? Sign up" creates an account and lands you on the Dashboard.
3. The Dashboard shows streak `0`, all three chips as "not started", and "Nothing due right now."
4. Clicking the Workout chip navigates to `/workout`; clicking Punch In marks it done; going back to `/` shows the Workout chip as "done".
5. Add a chore named "Test chore" on the Chores screen, confirm it appears and can be checked off.
6. Refresh the page — confirm you remain signed in and all state persisted (Firestore-backed, not lost on reload).

- [ ] **Step 5: Record the result**

If any step in Step 4 fails, file it as a bug to fix before starting Phase 2 — do not proceed with a broken golden path.
