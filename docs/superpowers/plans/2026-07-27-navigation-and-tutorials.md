# Back navigation, breadcrumbs, and first-time tutorials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a back arrow + breadcrumb to the 7 domain screens and Settings, and a first-time modal tutorial storyboard to all 9 screens (including Dashboard), with a "Replay all tutorials" button in Settings.

**Architecture:** A new `src/tutorials/` module holds the Firestore-backed seen-flags API (`tutorialFlagsApi.ts`), the per-screen step content (`tutorialContent.ts`), a `useTutorial` hook that decides whether to show the modal, and a `TutorialStoryboard` modal component. A new `src/components/ScreenHeader.tsx` renders the back arrow + breadcrumb + `<h1>` and replaces the bare `<h1>` in 7 domain screens and Settings. Every one of the 9 screens wires in `useTutorial` + `TutorialStoryboard`; Dashboard and 7 domain screens + Settings differ only in whether they also get `ScreenHeader`.

**Tech Stack:** React 18, TypeScript, react-router-dom v6 (`useNavigate`), Firebase Firestore (`doc`/`getDoc`/`setDoc`), Vitest + Testing Library.

## Global Constraints

- Firestore doc path: `users/{uid}/config/tutorials`, mirroring `users/{uid}/config/reminders` (see `src/domains/settings/reminderConfigApi.ts`).
- `TutorialScreenKey` values: `'dashboard' | 'workout' | 'learning' | 'chores' | 'finances' | 'meals' | 'health' | 'goals' | 'settings'`.
- Dashboard never gets `ScreenHeader` (it is the root of the app).
- `ScreenHeader`'s `label` prop supplies the visible `<h1>` text — the existing bare `<h1>` in each of the 7 domain screens + Settings must be removed, not duplicated.
- No coach-mark/tooltip style tutorial — modal carousel only.
- No per-tutorial replay buttons in Settings — single "Replay all tutorials" button only.
- No changes to the global header in `App.tsx` (Settings/Sign out buttons stay as-is).
- Existing screen `<h1>` text must be preserved verbatim as the new `ScreenHeader label`: Workout, Learning, Chores, Finances, "Meals & Groceries", "Sleep & Health", "Goals & Journaling", Settings.

---

## File Structure

New files:
- `src/tutorials/types.ts` — `TutorialScreenKey`, `TUTORIAL_SCREEN_KEYS`, `TutorialFlags`, `TutorialStep`.
- `src/tutorials/tutorialFlagsApi.ts` — Firestore reads/writes for seen-flags.
- `src/tutorials/tutorialFlagsApi.test.ts`
- `src/tutorials/tutorialContent.ts` — step content per screen.
- `src/tutorials/useTutorial.ts`
- `src/tutorials/useTutorial.test.ts`
- `src/tutorials/TutorialStoryboard.tsx`
- `src/tutorials/TutorialStoryboard.test.tsx`
- `src/components/ScreenHeader.tsx`
- `src/components/ScreenHeader.test.tsx`

Modified files:
- `src/domains/workout/WorkoutScreen.tsx` + `.test.tsx`
- `src/domains/learning/LearningScreen.tsx` + `.test.tsx`
- `src/domains/chores/ChoresScreen.tsx` + `.test.tsx`
- `src/domains/finances/FinancesScreen.tsx` + `.test.tsx`
- `src/domains/meals/MealsScreen.tsx` + `.test.tsx`
- `src/domains/health/HealthScreen.tsx` + `.test.tsx`
- `src/domains/goals/GoalsScreen.tsx` + `.test.tsx`
- `src/domains/settings/SettingsScreen.tsx` + `.test.tsx`
- `src/dashboard/Dashboard.tsx` + `.test.tsx`

---

### Task 1: Tutorial types + Firestore flags API

**Files:**
- Create: `src/tutorials/types.ts`
- Create: `src/tutorials/tutorialFlagsApi.ts`
- Test: `src/tutorials/tutorialFlagsApi.test.ts`

**Interfaces:**
- Produces: `TutorialScreenKey` (union type), `TUTORIAL_SCREEN_KEYS: TutorialScreenKey[]`, `TutorialFlags = Record<TutorialScreenKey, boolean>`, `TutorialStep = { title: string; body: string }`.
- Produces: `getTutorialFlags(uid: string): Promise<TutorialFlags>`, `markTutorialSeen(uid: string, key: TutorialScreenKey): Promise<void>`, `resetAllTutorialFlags(uid: string): Promise<void>`.

- [ ] **Step 1: Create the types file**

```ts
// src/tutorials/types.ts
export type TutorialScreenKey =
  | 'dashboard'
  | 'workout'
  | 'learning'
  | 'chores'
  | 'finances'
  | 'meals'
  | 'health'
  | 'goals'
  | 'settings';

export const TUTORIAL_SCREEN_KEYS: TutorialScreenKey[] = [
  'dashboard',
  'workout',
  'learning',
  'chores',
  'finances',
  'meals',
  'health',
  'goals',
  'settings',
];

export type TutorialFlags = Record<TutorialScreenKey, boolean>;

export interface TutorialStep {
  title: string;
  body: string;
}
```

- [ ] **Step 2: Write the failing test for `tutorialFlagsApi`**

```ts
// src/tutorials/tutorialFlagsApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn((..._args: unknown[]) => ({ __ref: true }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { getTutorialFlags, markTutorialSeen, resetAllTutorialFlags } from './tutorialFlagsApi';
import { TUTORIAL_SCREEN_KEYS } from './types';

describe('tutorialFlagsApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockClear();
    mockDoc.mockClear();
  });

  it('defaults every key to false when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const flags = await getTutorialFlags('user1');
    for (const key of TUTORIAL_SCREEN_KEYS) {
      expect(flags[key]).toBe(false);
    }
  });

  it('defaults a missing key to false when the doc exists but the key is absent', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ workout: true }) });
    const flags = await getTutorialFlags('user1');
    expect(flags.workout).toBe(true);
    expect(flags.learning).toBe(false);
  });

  it('merge-sets a single key to true when marking it seen', async () => {
    await markTutorialSeen('user1', 'workout');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { workout: true }, { merge: true });
  });

  it('merge-sets every key to false when resetting all', async () => {
    await resetAllTutorialFlags('user1');
    const [, payload, opts] = mockSetDoc.mock.calls[0];
    for (const key of TUTORIAL_SCREEN_KEYS) {
      expect(payload[key]).toBe(false);
    }
    expect(opts).toEqual({ merge: true });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/tutorials/tutorialFlagsApi.test.ts`
Expected: FAIL with "Cannot find module './tutorialFlagsApi'"

- [ ] **Step 4: Implement `tutorialFlagsApi.ts`**

```ts
// src/tutorials/tutorialFlagsApi.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TutorialFlags, TutorialScreenKey, TUTORIAL_SCREEN_KEYS } from './types';

function tutorialFlagsDocRef(uid: string) {
  return doc(db, 'users', uid, 'config', 'tutorials');
}

export async function getTutorialFlags(uid: string): Promise<TutorialFlags> {
  const snap = await getDoc(tutorialFlagsDocRef(uid));
  const data = (snap.exists() ? snap.data() : {}) as Partial<TutorialFlags> | undefined;
  const flags = {} as TutorialFlags;
  for (const key of TUTORIAL_SCREEN_KEYS) {
    flags[key] = data?.[key] ?? false;
  }
  return flags;
}

export async function markTutorialSeen(uid: string, key: TutorialScreenKey): Promise<void> {
  await setDoc(tutorialFlagsDocRef(uid), { [key]: true }, { merge: true });
}

export async function resetAllTutorialFlags(uid: string): Promise<void> {
  const flags: Partial<Record<TutorialScreenKey, boolean>> = {};
  for (const key of TUTORIAL_SCREEN_KEYS) {
    flags[key] = false;
  }
  await setDoc(tutorialFlagsDocRef(uid), flags, { merge: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/tutorials/tutorialFlagsApi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/tutorials/types.ts src/tutorials/tutorialFlagsApi.ts src/tutorials/tutorialFlagsApi.test.ts
git commit -m "feat(tutorials): add tutorial flags data model and Firestore API"
```

---

### Task 2: Tutorial content data

**Files:**
- Create: `src/tutorials/tutorialContent.ts`

**Interfaces:**
- Consumes: `TutorialScreenKey`, `TutorialStep` from `./types` (Task 1).
- Produces: `tutorialContent: Record<TutorialScreenKey, TutorialStep[]>` — consumed by screen wiring in Tasks 6-8.

- [ ] **Step 1: Write `tutorialContent.ts`**

```ts
// src/tutorials/tutorialContent.ts
import { TutorialScreenKey, TutorialStep } from './types';

export const tutorialContent: Record<TutorialScreenKey, TutorialStep[]> = {
  dashboard: [
    {
      title: 'Your day at a glance',
      body: "The activity rings and day health % show how much of today you've completed across every domain.",
    },
    {
      title: 'Keep your streak',
      body: 'The streak counter tracks consecutive days you hit your day health goal.',
    },
    {
      title: 'Trends and consistency',
      body: 'The trend chart and consistency heatmap show your health history over time.',
    },
    {
      title: 'Jump in',
      body: 'Tap any domain row to open that screen. The "Due now" strip surfaces anything due today across all domains.',
    },
  ],
  workout: [
    { title: 'Punch in', body: "Tap Punch In to mark today's workout done." },
    { title: 'Log an exercise', body: 'Add an exercise and detail (e.g. "3x10" or "30 min") to keep a history.' },
  ],
  learning: [
    { title: 'Punch in', body: "Tap Punch In to mark today's learning done." },
    { title: 'Add a note', body: 'Add a note on what you studied to keep a history.' },
  ],
  chores: [
    { title: 'Check off chores', body: 'Check off chores due today as you finish them.' },
    { title: 'Add a chore', body: 'Add a new recurring chore to track going forward.' },
  ],
  finances: [
    { title: 'Log a transaction', body: 'Log a transaction with amount, category, and whether it is income or an expense.' },
    { title: 'Set a budget', body: 'Set a monthly budget per category and watch the bar fill as you spend.' },
    { title: 'Track bills', body: 'Add a bill with its due day to get a "Due today" flag when it is due.' },
  ],
  meals: [
    { title: 'Grocery list', body: 'Check off grocery items as you buy them, and add new items to the list.' },
    { title: 'Log your meals', body: 'Log what you ate today to keep a history.' },
  ],
  health: [
    { title: 'Track sleep', body: "Save tonight's bedtime and wake time to track sleep duration." },
    { title: 'Track weight', body: 'Log your weight to see the change since your last entry.' },
  ],
  goals: [
    { title: 'Add a goal', body: 'Add a goal with a target date and comma-separated milestones.' },
    { title: 'Track milestones', body: 'Check off milestones as you complete them.' },
    { title: 'Weekly review', body: 'Fill out the weekly review (what went well / badly / focus next) when it is due.' },
  ],
  settings: [
    { title: 'Reminders', body: 'Set reminder times for workout, dinner, learning, and the weekly review.' },
    { title: 'Replay tutorials', body: 'Replay tutorials from here any time using the button below.' },
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this file has no dedicated test — it's exercised via `useTutorial`/`TutorialStoryboard`/screen tests in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/tutorials/tutorialContent.ts
git commit -m "feat(tutorials): add per-screen tutorial step content"
```

---

### Task 3: `useTutorial` hook

**Files:**
- Create: `src/tutorials/useTutorial.ts`
- Test: `src/tutorials/useTutorial.test.ts`

**Interfaces:**
- Consumes: `getTutorialFlags`, `markTutorialSeen` from `./tutorialFlagsApi` (Task 1); `TutorialScreenKey` from `./types`.
- Produces: `useTutorial(uid: string, screenKey: TutorialScreenKey): { isOpen: boolean; dismiss: () => void }` — consumed by all 9 screens in Tasks 6-8.

- [ ] **Step 1: Write the failing test**

```ts
// src/tutorials/useTutorial.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockGetTutorialFlags = vi.fn();
const mockMarkTutorialSeen = vi.fn().mockResolvedValue(undefined);

vi.mock('./tutorialFlagsApi', () => ({
  getTutorialFlags: (...args: [string]) => mockGetTutorialFlags(...args),
  markTutorialSeen: (...args: [string, string]) => mockMarkTutorialSeen(...args),
}));

import { useTutorial } from './useTutorial';

describe('useTutorial', () => {
  beforeEach(() => {
    mockGetTutorialFlags.mockReset();
    mockMarkTutorialSeen.mockClear();
  });

  it('opens when the flag for the screen is unseen', async () => {
    mockGetTutorialFlags.mockResolvedValue({ workout: false });
    const { result } = renderHook(() => useTutorial('user1', 'workout'));
    await waitFor(() => expect(result.current.isOpen).toBe(true));
  });

  it('stays closed when the flag for the screen is already seen', async () => {
    mockGetTutorialFlags.mockResolvedValue({ workout: true });
    const { result } = renderHook(() => useTutorial('user1', 'workout'));
    await waitFor(() => expect(mockGetTutorialFlags).toHaveBeenCalled());
    expect(result.current.isOpen).toBe(false);
  });

  it('calls markTutorialSeen and closes on dismiss', async () => {
    mockGetTutorialFlags.mockResolvedValue({ workout: false });
    const { result } = renderHook(() => useTutorial('user1', 'workout'));
    await waitFor(() => expect(result.current.isOpen).toBe(true));

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isOpen).toBe(false);
    expect(mockMarkTutorialSeen).toHaveBeenCalledWith('user1', 'workout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tutorials/useTutorial.test.ts`
Expected: FAIL with "Cannot find module './useTutorial'"

- [ ] **Step 3: Implement `useTutorial.ts`**

```ts
// src/tutorials/useTutorial.ts
import { useEffect, useState } from 'react';
import { getTutorialFlags, markTutorialSeen } from './tutorialFlagsApi';
import { TutorialScreenKey } from './types';

export function useTutorial(uid: string, screenKey: TutorialScreenKey) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTutorialFlags(uid).then((flags) => {
      if (!cancelled && !flags[screenKey]) {
        setIsOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uid, screenKey]);

  function dismiss() {
    setIsOpen(false);
    markTutorialSeen(uid, screenKey);
  }

  return { isOpen, dismiss };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tutorials/useTutorial.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tutorials/useTutorial.ts src/tutorials/useTutorial.test.ts
git commit -m "feat(tutorials): add useTutorial hook"
```

---

### Task 4: `TutorialStoryboard` modal component

**Files:**
- Create: `src/tutorials/TutorialStoryboard.tsx`
- Test: `src/tutorials/TutorialStoryboard.test.tsx`

**Interfaces:**
- Consumes: `TutorialStep` from `./types` (Task 1).
- Produces: `TutorialStoryboard({ title: string; steps: TutorialStep[]; onDismiss: () => void })` — consumed by all 9 screens in Tasks 6-8.

- [ ] **Step 1: Write the failing test**

```tsx
// src/tutorials/TutorialStoryboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorialStoryboard } from './TutorialStoryboard';

const steps = [
  { title: 'Step one', body: 'Body one' },
  { title: 'Step two', body: 'Body two' },
  { title: 'Step three', body: 'Body three' },
];

describe('TutorialStoryboard', () => {
  it('shows the first step and advances on Next', async () => {
    const onDismiss = vi.fn();
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={onDismiss} />);

    expect(screen.getByText('Step one')).toBeInTheDocument();
    expect(screen.getByText('Body one')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Step two')).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('goes back to the previous step', async () => {
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step two')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step one')).toBeInTheDocument();
  });

  it('calls onDismiss immediately when Skip is clicked', async () => {
    const onDismiss = vi.fn();
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={onDismiss} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows "Got it" on the last step and calls onDismiss when clicked', async () => {
    const onDismiss = vi.fn();
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={onDismiss} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step three')).toBeInTheDocument();

    const lastButton = screen.getByRole('button', { name: 'Got it' });
    await user.click(lastButton);

    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tutorials/TutorialStoryboard.test.tsx`
Expected: FAIL with "Cannot find module './TutorialStoryboard'"

- [ ] **Step 3: Implement `TutorialStoryboard.tsx`**

```tsx
// src/tutorials/TutorialStoryboard.tsx
import { useState } from 'react';
import { TutorialStep } from './types';

export function TutorialStoryboard({
  title,
  steps,
  onDismiss,
}: {
  title: string;
  steps: TutorialStep[];
  onDismiss: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  function handleNext() {
    if (isLast) {
      onDismiss();
      return;
    }
    setIndex((i) => i + 1);
  }

  function handleBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-line rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted">
            {title} · Step {index + 1} of {steps.length}
          </p>
          <button type="button" onClick={onDismiss} className="font-mono text-xs text-muted hover:text-ink">
            Skip
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-primary' : 'bg-line'}`}
            />
          ))}
        </div>

        <div>
          <h2 className="font-display font-bold text-lg">{step.title}</h2>
          <p className="text-sm text-ink mt-2">{step.body}</p>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleBack}
            disabled={index === 0}
            className="font-mono text-xs text-muted disabled:opacity-30 px-3 py-1.5"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="bg-primary text-white rounded-lg px-4 py-2 font-display font-semibold text-sm hover:bg-primary-dark"
          >
            {isLast ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tutorials/TutorialStoryboard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tutorials/TutorialStoryboard.tsx src/tutorials/TutorialStoryboard.test.tsx
git commit -m "feat(tutorials): add TutorialStoryboard modal component"
```

---

### Task 5: `ScreenHeader` component

**Files:**
- Create: `src/components/ScreenHeader.tsx`
- Test: `src/components/ScreenHeader.test.tsx`

**Interfaces:**
- Consumes: `useNavigate` from `react-router-dom`.
- Produces: `ScreenHeader({ label: string })` — renders back arrow, "Home / {label}" breadcrumb, and `<h1>{label}</h1>`. Consumed by 7 domain screens + Settings in Tasks 6-7.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ScreenHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ScreenHeader } from './ScreenHeader';

function renderAtWorkout() {
  return render(
    <MemoryRouter initialEntries={['/workout']}>
      <Routes>
        <Route path="/" element={<div>Home screen</div>} />
        <Route path="/workout" element={<ScreenHeader label="Workout" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ScreenHeader', () => {
  it('renders the label as the visible heading', () => {
    renderAtWorkout();
    expect(screen.getByRole('heading', { name: 'Workout' })).toBeInTheDocument();
  });

  it('navigates to / when the back arrow is clicked', async () => {
    renderAtWorkout();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

  it('navigates to / when the Home breadcrumb is clicked', async () => {
    renderAtWorkout();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ScreenHeader.test.tsx`
Expected: FAIL with "Cannot find module './ScreenHeader'"

- [ ] **Step 3: Implement `ScreenHeader.tsx`**

```tsx
// src/components/ScreenHeader.tsx
import { useNavigate } from 'react-router-dom';

export function ScreenHeader({ label }: { label: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 font-mono text-xs text-muted">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="hover:text-ink"
        >
          ←
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1">
          <button type="button" onClick={() => navigate('/')} className="hover:text-ink hover:underline">
            Home
          </button>
          <span>/</span>
          <span className="text-ink">{label}</span>
        </nav>
      </div>
      <h1 className="text-xl font-semibold">{label}</h1>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ScreenHeader.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ScreenHeader.tsx src/components/ScreenHeader.test.tsx
git commit -m "feat(components): add ScreenHeader with back arrow and breadcrumb"
```

---

### Task 6: Wire `ScreenHeader` + tutorial into the 7 domain screens

**Files:**
- Modify: `src/domains/workout/WorkoutScreen.tsx`, `src/domains/workout/WorkoutScreen.test.tsx`
- Modify: `src/domains/learning/LearningScreen.tsx`, `src/domains/learning/LearningScreen.test.tsx`
- Modify: `src/domains/chores/ChoresScreen.tsx`, `src/domains/chores/ChoresScreen.test.tsx`
- Modify: `src/domains/finances/FinancesScreen.tsx`, `src/domains/finances/FinancesScreen.test.tsx`
- Modify: `src/domains/meals/MealsScreen.tsx`, `src/domains/meals/MealsScreen.test.tsx`
- Modify: `src/domains/health/HealthScreen.tsx`, `src/domains/health/HealthScreen.test.tsx`
- Modify: `src/domains/goals/GoalsScreen.tsx`, `src/domains/goals/GoalsScreen.test.tsx`

**Interfaces:**
- Consumes: `ScreenHeader` (Task 5), `useTutorial` (Task 3), `TutorialStoryboard` (Task 4), `tutorialContent` (Task 2).

Each screen gets the same three edits:
1. Remove the bare `<h1 className="text-xl font-semibold">...</h1>` and replace it with `<ScreenHeader label="..." />` (same text).
2. Add `const tutorial = useTutorial(uid, '<key>');` inside the component body.
3. Render `{tutorial.isOpen && <TutorialStoryboard title="<Label>" steps={tutorialContent.<key>} onDismiss={tutorial.dismiss} />}` as the last child of the screen's root `<div>`.

Each screen's existing test file renders the screen directly (no `<MemoryRouter>`), which will now throw because `ScreenHeader` calls `useNavigate()`. Fix by wrapping every `render(...)` call in `<MemoryRouter>` and mocking `../../tutorials/useTutorial` to return a closed tutorial so the modal doesn't interfere with existing assertions.

- [ ] **Step 1: Update `WorkoutScreen.tsx`**

```tsx
// src/domains/workout/WorkoutScreen.tsx
import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setWorkoutDone } from '../shared/completionsApi';
import { listWorkoutLogEntries, addWorkoutLogEntry } from './workoutApi';
import { WorkoutLogEntry, DailyCompletion } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function WorkoutScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [exercise, setExercise] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'workout');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    getCompletion(uid).then(setCompletion).catch(handleError);
    listWorkoutLogEntries(uid).then(setEntries).catch(handleError);
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

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
      <ScreenHeader label="Workout" />
      <PunchInButton done={completion?.workout ?? false} onToggle={handlePunchIn} />
      <form onSubmit={handleAddEntry} className="flex flex-wrap gap-2">
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
      {tutorial.isOpen && (
        <TutorialStoryboard title="Workout" steps={tutorialContent.workout} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `WorkoutScreen.test.tsx`** — wrap in `MemoryRouter`, mock `useTutorial`

```tsx
// src/domains/workout/WorkoutScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { WorkoutScreen } from './WorkoutScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <WorkoutScreen uid="user1" />
    </MemoryRouter>
  );
}

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

    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetWorkoutDone).toHaveBeenCalledWith('user1', true);
  });

  it('adds a log entry', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
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

  it('shows an error message instead of hanging when loading fails', async () => {
    mockGetCompletion.mockRejectedValue(new Error('offline'));
    mockListEntries.mockResolvedValue([]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong: offline')).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 3: Run Workout tests**

Run: `npx vitest run src/domains/workout/WorkoutScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 4: Repeat the same pattern for `LearningScreen`**

`LearningScreen.tsx` — replace `<h1 className="text-xl font-semibold">Learning</h1>` with `<ScreenHeader label="Learning" />`; add imports `ScreenHeader`, `useTutorial`, `TutorialStoryboard`, `tutorialContent` (relative paths `../../components/ScreenHeader`, `../../tutorials/useTutorial`, `../../tutorials/TutorialStoryboard`, `../../tutorials/tutorialContent`); add `const tutorial = useTutorial(uid, 'learning');`; append before the closing root `</div>`:

```tsx
      {tutorial.isOpen && (
        <TutorialStoryboard title="Learning" steps={tutorialContent.learning} onDismiss={tutorial.dismiss} />
      )}
```

`LearningScreen.test.tsx` — add `import { MemoryRouter } from 'react-router-dom';`, add `vi.mock('../../tutorials/useTutorial', () => ({ useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }) }));`, and wrap every `render(<LearningScreen uid="user1" />)` call with `<MemoryRouter>...</MemoryRouter>`.

- [ ] **Step 5: Run Learning tests**

Run: `npx vitest run src/domains/learning/LearningScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Repeat for `ChoresScreen`**

`ChoresScreen.tsx` — replace `<h1 className="text-xl font-semibold">Chores</h1>` with `<ScreenHeader label="Chores" />`; same four imports (paths `../../components/ScreenHeader`, `../../tutorials/useTutorial`, `../../tutorials/TutorialStoryboard`, `../../tutorials/tutorialContent`); `const tutorial = useTutorial(uid, 'chores');`; append before the closing root `</div>`:

```tsx
      {tutorial.isOpen && (
        <TutorialStoryboard title="Chores" steps={tutorialContent.chores} onDismiss={tutorial.dismiss} />
      )}
```

`ChoresScreen.test.tsx` — same `MemoryRouter` wrap + `useTutorial` mock as Step 2.

- [ ] **Step 7: Run Chores tests**

Run: `npx vitest run src/domains/chores/ChoresScreen.test.tsx`
Expected: PASS

- [ ] **Step 8: Repeat for `FinancesScreen`**

`FinancesScreen.tsx` — replace `<h1 className="text-xl font-semibold">Finances</h1>` with `<ScreenHeader label="Finances" />`; same four imports (paths `../../components/ScreenHeader`, `../../tutorials/useTutorial`, `../../tutorials/TutorialStoryboard`, `../../tutorials/tutorialContent`); `const tutorial = useTutorial(uid, 'finances');`; append before the closing root `</div>` (after the Bills `</section>`):

```tsx
      {tutorial.isOpen && (
        <TutorialStoryboard title="Finances" steps={tutorialContent.finances} onDismiss={tutorial.dismiss} />
      )}
```

`FinancesScreen.test.tsx` — same `MemoryRouter` wrap + `useTutorial` mock as Step 2.

- [ ] **Step 9: Run Finances tests**

Run: `npx vitest run src/domains/finances/FinancesScreen.test.tsx`
Expected: PASS

- [ ] **Step 10: Repeat for `MealsScreen`**

`MealsScreen.tsx` — replace `<h1 className="text-xl font-semibold">Meals &amp; Groceries</h1>` with `<ScreenHeader label="Meals & Groceries" />` (JSX text, no `&amp;` needed since it's now a prop string); same four imports; `const tutorial = useTutorial(uid, 'meals');`; append before the closing root `</div>` (after the meals `</section>`):

```tsx
      {tutorial.isOpen && (
        <TutorialStoryboard title="Meals & Groceries" steps={tutorialContent.meals} onDismiss={tutorial.dismiss} />
      )}
```

`MealsScreen.test.tsx` — same `MemoryRouter` wrap + `useTutorial` mock as Step 2.

- [ ] **Step 11: Run Meals tests**

Run: `npx vitest run src/domains/meals/MealsScreen.test.tsx`
Expected: PASS

- [ ] **Step 12: Repeat for `HealthScreen`**

`HealthScreen.tsx` — replace `<h1 className="text-xl font-semibold">Sleep &amp; Health</h1>` with `<ScreenHeader label="Sleep & Health" />`; same four imports; `const tutorial = useTutorial(uid, 'health');`; append before the closing root `</div>` (after the Weight `</section>`):

```tsx
      {tutorial.isOpen && (
        <TutorialStoryboard title="Sleep & Health" steps={tutorialContent.health} onDismiss={tutorial.dismiss} />
      )}
```

`HealthScreen.test.tsx` — same `MemoryRouter` wrap + `useTutorial` mock as Step 2.

- [ ] **Step 13: Run Health tests**

Run: `npx vitest run src/domains/health/HealthScreen.test.tsx`
Expected: PASS

- [ ] **Step 14: Repeat for `GoalsScreen`**

`GoalsScreen.tsx` — replace `<h1 className="text-xl font-semibold">Goals &amp; Journaling</h1>` with `<ScreenHeader label="Goals & Journaling" />`; same four imports; `const tutorial = useTutorial(uid, 'goals');`; append before the closing root `</div>` (after the Weekly review `</section>`):

```tsx
      {tutorial.isOpen && (
        <TutorialStoryboard title="Goals & Journaling" steps={tutorialContent.goals} onDismiss={tutorial.dismiss} />
      )}
```

`GoalsScreen.test.tsx` — same `MemoryRouter` wrap + `useTutorial` mock as Step 2.

- [ ] **Step 15: Run Goals tests**

Run: `npx vitest run src/domains/goals/GoalsScreen.test.tsx`
Expected: PASS

- [ ] **Step 16: Run the full test suite for a sanity check**

Run: `npx vitest run src/domains`
Expected: PASS across all 7 domain screens

- [ ] **Step 17: Commit**

```bash
git add src/domains/workout src/domains/learning src/domains/chores src/domains/finances src/domains/meals src/domains/health src/domains/goals
git commit -m "feat(domains): wire ScreenHeader and first-time tutorials into all 7 domain screens"
```

---

### Task 7: Wire `ScreenHeader` + tutorial + "Replay all tutorials" into Settings

**Files:**
- Modify: `src/domains/settings/SettingsScreen.tsx`
- Modify: `src/domains/settings/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `ScreenHeader` (Task 5), `useTutorial` (Task 3), `TutorialStoryboard` (Task 4), `tutorialContent` (Task 2), `resetAllTutorialFlags` (Task 1).

- [ ] **Step 1: Update `SettingsScreen.tsx`**

```tsx
// src/domains/settings/SettingsScreen.tsx
import { useEffect, useState, FormEvent } from 'react';
import { getReminderConfig, saveReminderConfig } from './reminderConfigApi';
import { ReminderConfig } from '../shared/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';
import { resetAllTutorialFlags } from '../../tutorials/tutorialFlagsApi';

export function SettingsScreen({ uid }: { uid: string }) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tutorialsReset, setTutorialsReset] = useState(false);
  const tutorial = useTutorial(uid, 'settings');

  useEffect(() => {
    getReminderConfig(uid)
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, [uid]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    try {
      await saveReminderConfig(uid, config);
      setSaveError(null);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }

  async function handleReplayTutorials() {
    await resetAllTutorialFlags(uid);
    setTutorialsReset(true);
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (!config) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <ScreenHeader label="Settings" />
      <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
        <label className="flex flex-col text-sm" htmlFor="workoutTime">
          Workout reminder
          <input
            id="workoutTime"
            type="time"
            value={config.workoutTime}
            onChange={(e) => {
              setConfig({ ...config, workoutTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="dinnerTime">
          Dinner prep reminder
          <input
            id="dinnerTime"
            type="time"
            value={config.dinnerTime}
            onChange={(e) => {
              setConfig({ ...config, dinnerTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="learningTime">
          Learning reminder
          <input
            id="learningTime"
            type="time"
            value={config.learningTime}
            onChange={(e) => {
              setConfig({ ...config, learningTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="weeklyReviewTime">
          Weekly review reminder (Sunday)
          <input
            id="weeklyReviewTime"
            type="time"
            value={config.weeklyReviewTime}
            onChange={(e) => {
              setConfig({ ...config, weeklyReviewTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <p className="text-sm text-gray-600">Timezone: {config.timezone}</p>
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2 self-start">
          Save
        </button>
        {saveError && <p className="text-sm text-red-700">{saveError}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </form>

      <section className="flex flex-col gap-2 max-w-sm">
        <h2 className="font-semibold">Tutorials</h2>
        <button
          type="button"
          onClick={handleReplayTutorials}
          className="bg-blue-600 text-white rounded px-3 py-2 self-start"
        >
          Replay all tutorials
        </button>
        {tutorialsReset && (
          <p className="text-sm text-green-700">Tutorials will show again next time you visit each screen.</p>
        )}
      </section>

      {tutorial.isOpen && (
        <TutorialStoryboard title="Settings" steps={tutorialContent.settings} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `SettingsScreen.test.tsx`** — wrap in `MemoryRouter`, mock `useTutorial`, add replay-button tests

```tsx
// src/domains/settings/SettingsScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetReminderConfig = vi.fn();
const mockSaveReminderConfig = vi.fn();
const mockResetAllTutorialFlags = vi.fn().mockResolvedValue(undefined);

vi.mock('./reminderConfigApi', () => ({
  getReminderConfig: (...args: unknown[]) => mockGetReminderConfig(...args),
  saveReminderConfig: (...args: unknown[]) => mockSaveReminderConfig(...args),
}));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));
vi.mock('../../tutorials/tutorialFlagsApi', () => ({
  resetAllTutorialFlags: (...args: unknown[]) => mockResetAllTutorialFlags(...args),
}));

import { SettingsScreen } from './SettingsScreen';

const config = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <SettingsScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockGetReminderConfig.mockReset();
    mockSaveReminderConfig.mockReset().mockResolvedValue(undefined);
    mockResetAllTutorialFlags.mockClear();
  });

  it('shows a loading state before the config resolves', () => {
    mockGetReminderConfig.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the loaded reminder times', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));
    expect(screen.getByLabelText('Dinner prep reminder')).toHaveValue('19:00');
    expect(screen.getByLabelText('Learning reminder')).toHaveValue('20:00');
    expect(screen.getByLabelText('Weekly review reminder (Sunday)')).toHaveValue('18:00');
  });

  it('saves the edited config on submit', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveReminderConfig).toHaveBeenCalledWith('user1', { ...config, workoutTime: '07:00' });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('shows an error message when save fails', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    mockSaveReminderConfig.mockRejectedValue(new Error('Network error'));
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Network error/)).toBeInTheDocument();
    expect(screen.getByLabelText('Workout reminder')).toHaveValue('07:00');
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('clears the Saved message when editing after a successful save', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '08:00');

    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('resets all tutorial flags and shows a confirmation when Replay all tutorials is clicked', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Replay all tutorials' }));

    expect(mockResetAllTutorialFlags).toHaveBeenCalledWith('user1');
    expect(
      await screen.findByText('Tutorials will show again next time you visit each screen.')
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run Settings tests**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add src/domains/settings
git commit -m "feat(settings): add ScreenHeader, first-time tutorial, and replay-all-tutorials button"
```

---

### Task 8: Wire tutorial into Dashboard (no `ScreenHeader`)

**Files:**
- Modify: `src/dashboard/Dashboard.tsx`
- Modify: `src/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useTutorial` (Task 3), `TutorialStoryboard` (Task 4), `tutorialContent` (Task 2).
- Dashboard does NOT get `ScreenHeader` — it is the app root.

- [ ] **Step 1: Update `Dashboard.tsx`** — add imports and hook, render the storyboard as the last child of the outer `<div className="flex justify-center ...">`

```tsx
// src/dashboard/Dashboard.tsx (top of file)
import { useDashboardData } from './useDashboardData';
import { DueNowStrip } from './DueNowStrip';
import { TrendChart } from './TrendChart';
import { ConsistencyHeatmap } from './ConsistencyHeatmap';
import { ActivityRings, RingSegment } from '../components/ActivityRings';
import { isBillDueToday } from '../domains/finances/billsApi';
import { todayId, dayOfMonth, daysInMonth, dayOfWeek } from '../domains/shared/dateUtils';
import { computeSleepDurationHours } from '../domains/health/healthLogic';
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';
import { useTutorial } from '../tutorials/useTutorial';
import { TutorialStoryboard } from '../tutorials/TutorialStoryboard';
import { tutorialContent } from '../tutorials/tutorialContent';
```

Inside `Dashboard`, add right after the `useDashboardData` destructure:

```tsx
  const tutorial = useTutorial(uid, 'dashboard');
```

And change the final return's outer wrapper to include the storyboard as the last child:

```tsx
  return (
    <div className="flex justify-center px-3 sm:px-6 py-4 sm:py-8">
      <div className="w-full max-w-xl md:max-w-2xl lg:max-w-4xl bg-card border border-line rounded-2xl shadow-[0_30px_60px_-34px_rgba(21,24,26,0.28)] overflow-hidden">
        {/* ...unchanged header, rings, trend, heatmap, domains, due-now sections... */}
      </div>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Dashboard" steps={tutorialContent.dashboard} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
```

(Everything between the two `<div>` tags stays exactly as it is today — only the hook call and the trailing `TutorialStoryboard` block are new.)

- [ ] **Step 2: Update `Dashboard.test.tsx`** — mock `useTutorial` alongside the existing `useDashboardData` mock

Add near the top, alongside the existing `vi.mock` calls:

```tsx
vi.mock('../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));
```

No other changes needed — `Dashboard` doesn't use `useNavigate` (it takes `onNavigate` as a prop), so no `MemoryRouter` wrap is required.

- [ ] **Step 3: Run Dashboard tests**

Run: `npx vitest run src/dashboard/Dashboard.test.tsx`
Expected: PASS (all existing tests)

- [ ] **Step 4: Add a dedicated test for the tutorial wiring**

Add to `Dashboard.test.tsx`, replacing the static `useTutorial` mock with a mock function so one test can override it:

```tsx
const mockUseTutorial = vi.fn(() => ({ isOpen: false, dismiss: vi.fn() }));
vi.mock('../tutorials/useTutorial', () => ({
  useTutorial: (...args: [string, string]) => mockUseTutorial(...args),
}));
```

Then add a test:

```tsx
  it('shows the tutorial storyboard when useTutorial reports it is open', () => {
    mockUseTutorial.mockReturnValueOnce({ isOpen: true, dismiss: vi.fn() });
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(mockUseTutorial).toHaveBeenCalledWith('user1', 'dashboard');
  });
```

- [ ] **Step 5: Run Dashboard tests again**

Run: `npx vitest run src/dashboard/Dashboard.test.tsx`
Expected: PASS (all tests including the new one)

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS across the whole project

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/Dashboard.tsx src/dashboard/Dashboard.test.tsx
git commit -m "feat(dashboard): wire in the first-time tutorial storyboard"
```

---

## Self-Review Notes

- Spec §1 (data model) → Task 1.
- Spec §2 (back arrow + breadcrumb) → Task 5 (component) + Tasks 6-7 (wiring into 7 domain screens + Settings; Dashboard explicitly excluded per Task 8).
- Spec §3 (tutorial storyboards: content, hook, component, wiring) → Tasks 2, 3, 4, and wiring across Tasks 6-8 (all 9 screens).
- Spec §4 (Settings replay-all) → Task 7.
- Spec §5 (testing) → `tutorialFlagsApi.test.ts` (Task 1), `useTutorial.test.ts` (Task 3), `ScreenHeader.test.tsx` (Task 5), `TutorialStoryboard.test.tsx` (Task 4), existing screen tests updated (Tasks 6-8).
- Non-goals confirmed: no coach-marks (modal only, Task 4), no per-tutorial replay buttons (single button, Task 7), no `App.tsx` changes (not touched in any task).
