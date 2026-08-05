# Custom Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create their own recurring reminders (label + time + daily/weekly-days cadence) from a new Reminders screen, with notifications delivered via both the background push worker and the foreground scheduler, and with due-today reminders folded into the dashboard's "Due now" strip and day health %.

**Architecture:** `CustomReminder` is a new per-user Firestore collection (`users/{uid}/customReminders`), structurally identical to the existing `ChoreConfig` (daily/weekly-days cadence) plus a `time` field. Completion is tracked the same way chores are (`DailyCompletion.reminders` map). The background worker and foreground scheduler both grow a second, dynamic loop alongside their existing fixed-reminder loops.

**Tech Stack:** React 18 + TypeScript (Vite), Firebase Firestore, Cloudflare Workers, Vitest + Testing Library.

## Global Constraints

- `CustomReminder.weeklyDays` uses the same 0 (Sunday) – 6 (Saturday) convention as `ChoreConfig.weeklyDays`.
- Client-side reminder ids use `crypto.randomUUID()`, matching `ChoresScreen`/`GoalsScreen`.
- The worker's `reminderState/{id}` docs are keyed by the reminder's own id; this can't collide with the fixed keys (`workout`, `dinner`, `learning`, `weeklyReview`, `billDue`, `choreDue`) since those are never valid UUIDs.
- Do not modify `shouldFireDaily`/`shouldFireWeekly` — add a new function instead. They're tested and used elsewhere; no functional reason to touch them.
- Do not add a "Reminders" ring/row to `Dashboard.tsx`'s domain list — only `dueItems` and `dayHealth` integrate, per the design doc. `Dashboard.tsx` needs no code changes; it already consumes `dueItems`/`dayHealth` generically from `useDashboardData`.
- `computeDayHealth` and `computeDayHealthHistory` get their new reminders parameter with a default of `[]` (or `[]` for the due-ids array), so every existing call site and existing test keeps working unchanged.

---

### Task 1: Data model

**Files:**
- Modify: `src/domains/shared/types.ts`
- Modify: `src/tutorials/types.ts`
- Modify: `src/tutorials/tutorialContent.ts`

**Interfaces:**
- Produces: `CustomReminder { id, label, time, cadence: 'daily' | 'weekly', weeklyDays?: number[] }`, `DailyCompletion.reminders: Record<string, boolean>`, `DomainKey` including `'reminders'`, `TutorialScreenKey` including `'reminders'` — consumed by every later task.

- [ ] **Step 1: Add `CustomReminder` and extend `DailyCompletion`/`DomainKey`**

In `src/domains/shared/types.ts`, add near `ChoreConfig`:

```typescript
export interface CustomReminder {
  id: string;
  label: string;
  time: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}
```

Change:

```typescript
export type DomainKey = 'workout' | 'learning' | 'chores' | 'finances' | 'meals' | 'health' | 'goals';
```

to:

```typescript
export type DomainKey = 'workout' | 'learning' | 'chores' | 'finances' | 'meals' | 'health' | 'goals' | 'reminders';
```

Change:

```typescript
export interface DailyCompletion {
  date: string;
  workout: boolean;
  learning: boolean;
  chores: Record<string, boolean>;
}
```

to:

```typescript
export interface DailyCompletion {
  date: string;
  workout: boolean;
  learning: boolean;
  chores: Record<string, boolean>;
  reminders: Record<string, boolean>;
}
```

- [ ] **Step 2: Run the full test suite to see what breaks**

Run: `npx vitest run`
Expected: FAIL in every test file that constructs a `DailyCompletion` object literal without a `reminders` field and passes it through a function whose return value is checked with `toEqual` (TypeScript won't catch this at test runtime since these are plain object literals, so most tests will still pass — but any test asserting an exact `DailyCompletion` shape returned from `getCompletion`/`useDashboardData` may now mismatch if the source added a default). Note which suites fail; they'll be fixed in their own tasks (`completionsApi.test.ts` in Task 3, `dashboardLogic.test.ts`/`useDashboardData.test.ts` in Tasks 4–5). Confirm no *other* unrelated suite fails — if one does, stop and investigate.

- [ ] **Step 3: Add `'reminders'` to `TutorialScreenKey`**

In `src/tutorials/types.ts`, change:

```typescript
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
```

to:

```typescript
export type TutorialScreenKey =
  | 'dashboard'
  | 'workout'
  | 'learning'
  | 'chores'
  | 'finances'
  | 'meals'
  | 'health'
  | 'goals'
  | 'reminders'
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
  'reminders',
  'settings',
];
```

`src/tutorials/tutorialFlagsApi.test.ts` iterates `TUTORIAL_SCREEN_KEYS` generically, so it covers the new key automatically — no changes needed there.

- [ ] **Step 4: Add tutorial content for the reminders screen**

In `src/tutorials/tutorialContent.ts`, add a `reminders` entry (object key order doesn't matter to TypeScript, but place it near `goals` for readability):

```typescript
  reminders: [
    {
      title: 'Add a reminder',
      body: 'Add a reminder with a label, time, and how often it repeats.',
      targetId: 'reminders-form',
    },
    {
      title: 'Check them off',
      body: 'Check off reminders due today, or remove ones you no longer need.',
      targetId: 'reminders-list',
    },
  ],
```

- [ ] **Step 5: Run the tutorials suite**

Run: `npx vitest run src/tutorials`
Expected: PASS (no changes needed to `tutorialFlagsApi.test.ts`; `tutorialContent.ts` has no dedicated test file)

- [ ] **Step 6: Commit**

```bash
git add src/domains/shared/types.ts src/tutorials/types.ts src/tutorials/tutorialContent.ts
git commit -m "feat: add CustomReminder type and reminders tutorial content"
```

---

### Task 2: `remindersApi.ts` — CRUD and due-today check

**Files:**
- Create: `src/domains/reminders/remindersApi.ts`
- Create: `src/domains/reminders/remindersApi.test.ts`

**Interfaces:**
- Consumes: `CustomReminder` from Task 1.
- Produces: `listCustomReminders(uid): Promise<CustomReminder[]>`, `saveCustomReminder(uid, reminder): Promise<void>`, `deleteCustomReminder(uid, id): Promise<void>`, `isCustomReminderDueToday(reminder, dow): boolean` — consumed by Task 5 (dashboard), Task 6 (screen), Task 8 (foreground scheduler).

- [ ] **Step 1: Write the failing tests**

Create `src/domains/reminders/remindersApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomReminder } from '../shared/types';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
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

import { listCustomReminders, saveCustomReminder, deleteCustomReminder, isCustomReminderDueToday } from './remindersApi';

describe('isCustomReminderDueToday', () => {
  it('is always due for daily reminders', () => {
    const reminder: CustomReminder = { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' };
    expect(isCustomReminderDueToday(reminder, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const reminder: CustomReminder = {
      id: 'r2',
      label: 'Gym',
      time: '07:00',
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
    };
    expect(isCustomReminderDueToday(reminder, 3)).toBe(true);
    expect(isCustomReminderDueToday(reminder, 2)).toBe(false);
  });

  it('is not due for weekly reminders with no matching days configured', () => {
    const reminder: CustomReminder = { id: 'r3', label: 'Read', time: '21:00', cadence: 'weekly' };
    expect(isCustomReminderDueToday(reminder, 3)).toBe(false);
  });
});

describe('remindersApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listCustomReminders maps Firestore docs to CustomReminder objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'r1', data: () => ({ label: 'Drink water', time: '10:00', cadence: 'daily', weeklyDays: null }) }],
    });
    const result = await listCustomReminders('user1');
    expect(result).toEqual([{ id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily', weeklyDays: null }]);
  });

  it('saveCustomReminder writes the reminder fields', async () => {
    const reminder: CustomReminder = { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' };
    await saveCustomReminder('user1', reminder);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      label: 'Drink water',
      time: '10:00',
      cadence: 'daily',
      weeklyDays: null,
    });
  });

  it('deleteCustomReminder removes the reminder doc', async () => {
    await deleteCustomReminder('user1', 'r1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domains/reminders/remindersApi.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement `remindersApi.ts`**

Create `src/domains/reminders/remindersApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { CustomReminder } from '../shared/types';

export async function listCustomReminders(uid: string): Promise<CustomReminder[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'customReminders'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomReminder, 'id'>) }));
}

export async function saveCustomReminder(uid: string, reminder: CustomReminder): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'customReminders', reminder.id), {
    label: reminder.label,
    time: reminder.time,
    cadence: reminder.cadence,
    weeklyDays: reminder.weeklyDays ?? null,
  });
}

export async function deleteCustomReminder(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'customReminders', id));
}

export function isCustomReminderDueToday(reminder: CustomReminder, dow: number): boolean {
  if (reminder.cadence === 'daily') return true;
  return reminder.weeklyDays?.includes(dow) ?? false;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domains/reminders/remindersApi.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/reminders/remindersApi.ts src/domains/reminders/remindersApi.test.ts
git commit -m "feat: add remindersApi CRUD for custom reminders"
```

---

### Task 3: `completionsApi.ts` — track reminder completion

**Files:**
- Modify: `src/domains/shared/completionsApi.ts`
- Modify: `src/domains/shared/completionsApi.test.ts`

**Interfaces:**
- Produces: `setReminderDone(uid, reminderId, done, date?): Promise<void>`, consumed by Task 6 (`RemindersScreen`). `getCompletion` now defaults `reminders` to `{}`, consumed by Tasks 4–6.

- [ ] **Step 1: Write the failing tests**

In `src/domains/shared/completionsApi.test.ts`, update the two existing `getCompletion` expectations and add new tests. Replace:

```typescript
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

  it('fills in defaults for fields missing from a partially-written doc', async () => {
    // Realistic case: setWorkoutDone's merge:true write only ever sets
    // {date, workout}, so a doc touched by just one setter has no
    // `learning`/`chores` fields at all until another setter writes them.
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20', workout: true }) });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: true, learning: false, chores: {} });
  });
```

with:

```typescript
  it('returns an empty completion when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: false, learning: false, chores: {}, reminders: {} });
  });

  it('returns the stored completion when a doc exists', async () => {
    const stored = {
      date: '2026-07-20',
      workout: true,
      learning: false,
      chores: { c1: true },
      reminders: { r1: true },
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual(stored);
  });

  it('fills in defaults for fields missing from a partially-written doc', async () => {
    // Realistic case: setWorkoutDone's merge:true write only ever sets
    // {date, workout}, so a doc touched by just one setter has no
    // `learning`/`chores`/`reminders` fields at all until another setter
    // writes them.
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20', workout: true }) });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: true, learning: false, chores: {}, reminders: {} });
  });
```

Then add a new test alongside `setChoreDone`'s test (and add `setReminderDone` to the import list):

```typescript
import {
  getCompletion,
  listRecentCompletions,
  setWorkoutDone,
  setLearningDone,
  setChoreDone,
  setReminderDone,
} from './completionsApi';
```

```typescript
  it('setReminderDone merges a single reminder flag', async () => {
    await setReminderDone('user1', 'r1', true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', reminders: { r1: true } },
      { merge: true }
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domains/shared/completionsApi.test.ts`
Expected: FAIL — `getCompletion` doesn't default `reminders`, and `setReminderDone` doesn't exist.

- [ ] **Step 3: Implement the changes**

In `src/domains/shared/completionsApi.ts`, change:

```typescript
export async function getCompletion(uid: string, date: string = todayId()): Promise<DailyCompletion> {
  const snap = await getDoc(completionDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<DailyCompletion>) : {};
  return {
    date,
    workout: data.workout ?? false,
    learning: data.learning ?? false,
    chores: data.chores ?? {},
  };
}
```

to:

```typescript
export async function getCompletion(uid: string, date: string = todayId()): Promise<DailyCompletion> {
  const snap = await getDoc(completionDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<DailyCompletion>) : {};
  return {
    date,
    workout: data.workout ?? false,
    learning: data.learning ?? false,
    chores: data.chores ?? {},
    reminders: data.reminders ?? {},
  };
}
```

and add, after `setChoreDone`:

```typescript
export async function setReminderDone(
  uid: string,
  reminderId: string,
  done: boolean,
  date: string = todayId()
): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, reminders: { [reminderId]: done } }, { merge: true });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domains/shared/completionsApi.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full suite to catch other call sites that construct `DailyCompletion` literals**

Run: `npx vitest run`
Expected: Several existing tests across `WorkoutScreen`, `ChoresScreen`, `dashboardLogic`, `useDashboardData`, etc. construct `DailyCompletion` object literals directly (e.g. `{ date: '...', workout: false, learning: false, chores: {} }`) without a `reminders` field. Since these are plain JS object literals compared with `toEqual`/passed to functions that only read `.workout`/`.learning`/`.chores`, most will keep passing at runtime. Confirm this by reading the failures list: only `dashboardLogic.test.ts` (Task 4) and `useDashboardData.test.ts` (Task 5) should actually fail, because `computeDayHealth`/history functions will be extended in those tasks to read `.reminders`. If anything else fails, stop and investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/domains/shared/completionsApi.ts src/domains/shared/completionsApi.test.ts
git commit -m "feat: track custom reminder completion in DailyCompletion"
```

---

### Task 4: Dashboard logic — due items and day health

**Files:**
- Modify: `src/dashboard/dashboardLogic.ts`
- Modify: `src/dashboard/dashboardLogic.test.ts`

**Interfaces:**
- Consumes: `CustomReminder`, `isCustomReminderDueToday` from Tasks 1–2.
- Produces: `computeReminderDueItems(reminders, completion, dow): DueItem[]`; `computeDayHealth(completion, dueTodayChoreIds, dueTodayReminderIds = []): number` (signature extended); `computeDayHealthHistory(history, chores, reminders = []): DayHealthPoint[]` (signature extended) — consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

In `src/dashboard/dashboardLogic.test.ts`, add `CustomReminder` to the type import:

```typescript
import { ChoreConfig, CustomReminder, DailyCompletion, Bill, GroceryItem, WeeklyReview } from '../domains/shared/types';
```

and update the import of functions under test to include the new one:

```typescript
import {
  computeStreak,
  computeDueItems,
  computeReminderDueItems,
  computeDayHealth,
  computeBillDueItems,
  computeGroceryDueItem,
  computeWeeklyReviewDueItem,
} from './dashboardLogic';
```

Update the two `DailyCompletion` literals in the `computeDueItems`/`computeDayHealth` describe blocks to include `reminders: {}` (they don't need reminder data, just the field to satisfy the type/shape):

```typescript
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
      reminders: {},
    };
    const result = computeDueItems(chores, completion, 1);
    expect(result).toEqual([{ id: 'c2', label: 'Laundry', domain: 'chores' }]);
  });
});

describe('computeReminderDueItems', () => {
  const reminders: CustomReminder[] = [
    { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    { id: 'r2', label: 'Gym', time: '07:00', cadence: 'weekly', weeklyDays: [1] },
  ];

  it('lists due, not-yet-done reminders only', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: {},
      reminders: { r1: true },
    };
    const result = computeReminderDueItems(reminders, completion, 1);
    expect(result).toEqual([{ id: 'r2', label: 'Gym', domain: 'reminders' }]);
  });
});

describe('computeDayHealth', () => {
  it('computes percentage of done tasks including due chores', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: false,
      chores: { c1: true },
      reminders: {},
    };
    expect(computeDayHealth(completion, ['c1'])).toBe(67);
  });

  it('returns 100 when there are no tasks at all', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    };
    // workout + learning always count as 2 base tasks, so this case only
    // arises hypothetically; guard against division by zero regardless.
    expect(computeDayHealth(completion, [])).toBe(0);
  });

  it('folds due, unchecked reminders into the task count', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: { r1: true },
    };
    // 2 base + 2 reminders = 4 tasks; workout+learning+r1 done = 3/4 = 75%
    expect(computeDayHealth(completion, [], ['r1', 'r2'])).toBe(75);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: FAIL — `computeReminderDueItems` doesn't exist, and `computeDayHealth` doesn't accept a third argument.

- [ ] **Step 3: Implement the changes**

In `src/dashboard/dashboardLogic.ts`, add the import:

```typescript
import { ChoreConfig, CustomReminder, DailyCompletion, DueItem, Bill, GroceryItem, WeeklyReview } from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';
import { isCustomReminderDueToday } from '../domains/reminders/remindersApi';
```

Add, after `computeDueItems`:

```typescript
export function computeReminderDueItems(
  reminders: CustomReminder[],
  completion: DailyCompletion,
  dow: number
): DueItem[] {
  return reminders
    .filter((r) => isCustomReminderDueToday(r, dow) && !completion.reminders[r.id])
    .map((r) => ({ id: r.id, label: r.label, domain: 'reminders' as const }));
}
```

Change `computeDayHealth`:

```typescript
export function computeDayHealth(completion: DailyCompletion, dueTodayChoreIds: string[]): number {
  const totalTasks = 2 + dueTodayChoreIds.length;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length;
  return totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
}
```

to:

```typescript
export function computeDayHealth(
  completion: DailyCompletion,
  dueTodayChoreIds: string[],
  dueTodayReminderIds: string[] = []
): number {
  const totalTasks = 2 + dueTodayChoreIds.length + dueTodayReminderIds.length;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length +
    dueTodayReminderIds.filter((id) => completion.reminders[id]).length;
  return totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
}
```

Change `computeDayHealthHistory`:

```typescript
export function computeDayHealthHistory(
  history: DailyCompletion[],
  chores: ChoreConfig[]
): DayHealthPoint[] {
  return [...history]
    .reverse()
    .map((day) => {
      const dueChoreIds = chores
        .filter((c) => isChoreDueToday(c, dayOfWeek(day.date)))
        .map((c) => c.id);
      return { date: day.date, value: computeDayHealth(day, dueChoreIds) };
    });
}
```

to:

```typescript
export function computeDayHealthHistory(
  history: DailyCompletion[],
  chores: ChoreConfig[],
  reminders: CustomReminder[] = []
): DayHealthPoint[] {
  return [...history]
    .reverse()
    .map((day) => {
      const dow = dayOfWeek(day.date);
      const dueChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
      const dueReminderIds = reminders.filter((r) => isCustomReminderDueToday(r, dow)).map((r) => r.id);
      return { date: day.date, value: computeDayHealth(day, dueChoreIds, dueReminderIds) };
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/dashboardLogic.ts src/dashboard/dashboardLogic.test.ts
git commit -m "feat: fold custom reminders into dashboard due items and day health"
```

---

### Task 5: `useDashboardData` — fetch and wire in custom reminders

**Files:**
- Modify: `src/dashboard/useDashboardData.ts`
- Modify: `src/dashboard/useDashboardData.test.ts`

**Interfaces:**
- Consumes: `listCustomReminders` (Task 2), `computeReminderDueItems`/updated `computeDayHealth`/`computeDayHealthHistory` (Task 4).
- Produces: `DashboardData.reminders: CustomReminder[]`, `DashboardData.dueTodayReminderIds: string[]` — available to any future consumer (not consumed by `Dashboard.tsx` per the design's explicit no-ring-row decision, but returned for completeness and testability).

- [ ] **Step 1: Write the failing test**

In `src/dashboard/useDashboardData.test.ts`, add a mock for the new API and a new test. Add near the other `vi.mock` calls:

```typescript
const mockListCustomReminders = vi.fn();

vi.mock('../domains/reminders/remindersApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/reminders/remindersApi')>(
    '../domains/reminders/remindersApi'
  );
  return { ...actual, listCustomReminders: (...args: [string]) => mockListCustomReminders(...args) };
});
```

Add `mockListCustomReminders.mockReset()` to the top-level `beforeEach`, and default it to `[]` in every existing test that doesn't explicitly set it (the mock resolves to `undefined` otherwise, which breaks `.filter()` inside `computeReminderDueItems`). Update the `beforeEach`:

```typescript
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockListRecentCompletions.mockReset();
    mockListChores.mockReset();
    mockListBills.mockReset();
    mockListGroceryItems.mockReset();
    mockListCustomReminders.mockReset().mockResolvedValue([]);
  });
```

(The `.mockResolvedValue([])` default means existing tests that never call `mockListCustomReminders.mockResolvedValue(...)` still get an empty array, so their `dayHealth`/`dueItems` assertions are unaffected.)

Then add a new test after the first one (`'loads completion, history, chores, bills, and groceries...'`):

```typescript
  it('loads custom reminders and folds due ones into dueItems and dayHealth', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: {},
    });
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);

    const { result } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListCustomReminders).toHaveBeenCalledWith('user1');
    expect(result.current.reminders).toEqual([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);
    expect(result.current.dueTodayReminderIds).toEqual(['r1']);
    expect(result.current.dueItems).toEqual(
      expect.arrayContaining([{ id: 'r1', label: 'Drink water', domain: 'reminders' }])
    );
    // 2 base tasks + 1 due reminder = 3; workout+learning done, reminder not = 2/3 = 67%
    expect(result.current.dayHealth).toBe(67);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: FAIL — `useDashboardData` doesn't fetch reminders yet, so `result.current.reminders` is `undefined`.

- [ ] **Step 3: Implement the changes**

In `src/dashboard/useDashboardData.ts`, add imports:

```typescript
import { listCustomReminders } from '../domains/reminders/remindersApi';
import {
  ChoreConfig,
  CustomReminder,
  DailyCompletion,
  DueItem,
  Bill,
  GroceryItem,
  SleepLog,
  Goal,
  WeeklyReview,
} from '../domains/shared/types';
```

Add the import for `computeReminderDueItems`:

```typescript
import {
  computeStreak,
  computeDueItems,
  computeReminderDueItems,
  computeDayHealth,
  computeDayHealthHistory,
  computeBillDueItems,
  computeGroceryDueItem,
  computeWeeklyReviewDueItem,
  DayHealthPoint,
} from './dashboardLogic';
```

Extend `DashboardData`:

```typescript
export interface DashboardData {
  loading: boolean;
  error: string | null;
  completion: DailyCompletion | null;
  chores: ChoreConfig[];
  bills: Bill[];
  groceryItems: GroceryItem[];
  reminders: CustomReminder[];
  dueItems: DueItem[];
  dueTodayChoreIds: string[];
  dueTodayReminderIds: string[];
  streak: number;
  dayHealth: number;
  healthHistory: DayHealthPoint[];
  sleepLog: SleepLog | null;
  goals: Goal[];
  weeklyReview: WeeklyReview | null;
}
```

Add a `reminders` state slot next to `chores`:

```typescript
  const [reminders, setReminders] = useState<CustomReminder[]>([]);
```

Add `listCustomReminders(uid)` to the `Promise.all` array and destructure it, in the same position each time:

```typescript
    Promise.all([
      getCompletion(uid),
      listRecentCompletions(uid, STREAK_HISTORY_DAYS),
      listChores(uid),
      listBills(uid),
      listGroceryItems(uid),
      listCustomReminders(uid),
      getSleepLog(uid),
      listGoals(uid),
      getWeeklyReview(uid, weekId(todayId())),
    ])
      .then(([todayCompletion, recentHistory, choreList, billList, groceryList, reminderList, sleep, goalList, review]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
        setBills(billList);
        setGroceryItems(groceryList);
        setReminders(reminderList);
        setSleepLog(sleep);
        setGoals(goalList);
        setWeeklyReview(review);
        setLoading(false);
      })
```

Update the early-return (no-completion) object to include the new fields:

```typescript
  if (!completion) {
    return {
      loading,
      error,
      completion: null,
      chores: [],
      bills: [],
      groceryItems: [],
      reminders: [],
      dueItems: [],
      dueTodayChoreIds: [],
      dueTodayReminderIds: [],
      streak: 0,
      dayHealth: 0,
      healthHistory: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
    };
  }
```

Update the computed-values block and final return:

```typescript
  const dow = dayOfWeek(todayId());
  const domNow = dayOfMonth(todayId());
  const dimNow = daysInMonth(todayId());
  const dueTodayReminderIds = reminders.filter((r) => isCustomReminderDueToday(r, dow)).map((r) => r.id);
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeReminderDueItems(reminders, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
    ...computeWeeklyReviewDueItem(dow, weeklyReview),
  ];
  const dueTodayChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds, dueTodayReminderIds);
  const healthHistory = computeDayHealthHistory(history, chores, reminders);

  return {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    reminders,
    dueItems,
    dueTodayChoreIds,
    dueTodayReminderIds,
    streak,
    dayHealth,
    healthHistory,
    sleepLog,
    goals,
    weeklyReview,
  };
```

Add the `isCustomReminderDueToday` import alongside `isChoreDueToday`:

```typescript
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { listCustomReminders, isCustomReminderDueToday } from '../domains/reminders/remindersApi';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS — this is the point where every `DailyCompletion`-shape mismatch from Task 1's Step 2 should now be resolved. If anything outside `dashboard`/`shared`/`reminders` still fails, stop and investigate.

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/useDashboardData.ts src/dashboard/useDashboardData.test.ts
git commit -m "feat: fetch custom reminders into dashboard data"
```

---

### Task 6: `RemindersScreen.tsx` and wiring (route, sidebar, tutorial)

**Files:**
- Create: `src/domains/reminders/RemindersScreen.tsx`
- Create: `src/domains/reminders/RemindersScreen.test.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listCustomReminders`, `saveCustomReminder`, `deleteCustomReminder`, `isCustomReminderDueToday` (Task 2); `setReminderDone`, `getCompletion` (Task 3); `CustomReminder`, `DailyCompletion` (Task 1).

- [ ] **Step 1: Write the failing tests**

Create `src/domains/reminders/RemindersScreen.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListCustomReminders = vi.fn();
const mockSaveCustomReminder = vi.fn().mockResolvedValue(undefined);
const mockDeleteCustomReminder = vi.fn().mockResolvedValue(undefined);
const mockGetCompletion = vi.fn();
const mockSetReminderDone = vi.fn().mockResolvedValue(undefined);

vi.mock('./remindersApi', async () => {
  const actual = await vi.importActual<typeof import('./remindersApi')>('./remindersApi');
  return {
    ...actual,
    listCustomReminders: (...args: [string]) => mockListCustomReminders(...args),
    saveCustomReminder: (...args: [string, unknown]) => mockSaveCustomReminder(...args),
    deleteCustomReminder: (...args: [string, string]) => mockDeleteCustomReminder(...args),
  };
});
vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setReminderDone: (...args: [string, string, boolean]) => mockSetReminderDone(...args),
}));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { RemindersScreen } from './RemindersScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <RemindersScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('RemindersScreen', () => {
  beforeEach(() => {
    mockListCustomReminders.mockReset();
    mockGetCompletion.mockReset();
    mockSaveCustomReminder.mockClear();
    mockDeleteCustomReminder.mockClear();
    mockSetReminderDone.mockClear();
  });

  it('lists reminders and lets you mark one done', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText('Drink water')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /Drink water/ }));

    expect(mockSetReminderDone).toHaveBeenCalledWith('user1', 'r1', true);
  });

  it('adds a new daily reminder', async () => {
    mockListCustomReminders.mockResolvedValue([]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();
    await waitFor(() => expect(mockListCustomReminders).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Reminder label'), 'Take medication');
    await user.type(screen.getByLabelText('Time'), '08:00');
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));

    expect(mockSaveCustomReminder).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ label: 'Take medication', time: '08:00', cadence: 'daily' })
    );
  });

  it('adds a weekly reminder with selected weekdays', async () => {
    mockListCustomReminders.mockResolvedValue([]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();
    await waitFor(() => expect(mockListCustomReminders).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Reminder label'), 'Gym');
    await user.type(screen.getByLabelText('Time'), '07:00');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'weekly');
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }));
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));

    expect(mockSaveCustomReminder).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ label: 'Gym', time: '07:00', cadence: 'weekly', weeklyDays: [1, 3] })
    );
  });

  it('removes a reminder', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' },
    ]);
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Drink water')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(mockDeleteCustomReminder).toHaveBeenCalledWith('user1', 'r1');
    await waitFor(() => expect(screen.queryByText('Drink water')).not.toBeInTheDocument());
  });

  it('shows an error message instead of hanging when loading fails', async () => {
    mockListCustomReminders.mockRejectedValue(new Error('offline'));
    mockGetCompletion.mockResolvedValue({
      date: '2026-08-05',
      workout: false,
      learning: false,
      chores: {},
      reminders: {},
    });

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong: offline')).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domains/reminders/RemindersScreen.test.tsx`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement `RemindersScreen.tsx`**

Create `src/domains/reminders/RemindersScreen.tsx`:

```typescript
import { useEffect, useState, FormEvent } from 'react';
import {
  listCustomReminders,
  saveCustomReminder,
  deleteCustomReminder,
  isCustomReminderDueToday,
} from './remindersApi';
import { getCompletion, setReminderDone } from '../shared/completionsApi';
import { CustomReminder, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cadenceSummary(reminder: CustomReminder): string {
  if (reminder.cadence === 'daily') return 'Daily';
  return (reminder.weeklyDays ?? []).map((d) => WEEKDAY_LABELS[d]).join(', ') || 'No days selected';
}

export function RemindersScreen({ uid }: { uid: string }) {
  const [reminders, setReminders] = useState<CustomReminder[]>([]);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'reminders');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listCustomReminders(uid).then(setReminders).catch(handleError);
    getCompletion(uid).then(setCompletion).catch(handleError);
  }, [uid]);

  async function handleToggle(reminderId: string, done: boolean) {
    await setReminderDone(uid, reminderId, done);
    setCompletion((prev) =>
      prev ? { ...prev, reminders: { ...prev.reminders, [reminderId]: done } } : prev
    );
  }

  function toggleWeekday(day: number) {
    setWeeklyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleAddReminder(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !time) return;
    const reminder: CustomReminder = {
      id: crypto.randomUUID(),
      label: label.trim(),
      time,
      cadence,
      ...(cadence === 'weekly' ? { weeklyDays } : {}),
    };
    await saveCustomReminder(uid, reminder);
    setReminders((prev) => [...prev, reminder]);
    setLabel('');
    setTime('');
    setCadence('daily');
    setWeeklyDays([]);
  }

  async function handleRemove(reminderId: string) {
    await deleteCustomReminder(uid, reminderId);
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  const dow = dayOfWeek(todayId());

  return (
    <PageCard>
      <ScreenHeader label="Reminders" />
      <ul id="reminders-list" className="flex flex-col gap-2">
        {reminders.map((reminder) => {
          const dueToday = isCustomReminderDueToday(reminder, dow);
          const done = completion?.reminders?.[reminder.id] ?? false;
          return (
            <li key={reminder.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
              <input
                type="checkbox"
                aria-label={reminder.label}
                checked={done}
                disabled={!dueToday}
                onChange={(e) => handleToggle(reminder.id, e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm flex-1">{reminder.label}</span>
              <span className="font-mono text-xs text-muted">{reminder.time}</span>
              <span className="font-mono text-xs text-muted">{cadenceSummary(reminder)}</span>
              {!dueToday && <span className="font-mono text-xs text-muted">not due today</span>}
              <button
                type="button"
                onClick={() => handleRemove(reminder.id)}
                className="text-xs text-muted hover:text-ink"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <form id="reminders-form" onSubmit={handleAddReminder} className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Reminder label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="reminder-time">
            Time
            <input
              id="reminder-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="reminder-cadence">
            Repeats
            <select
              id="reminder-cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as 'daily' | 'weekly')}
              className={fieldClass}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Specific weekdays</option>
            </select>
          </label>
        </div>
        {cadence === 'weekly' && (
          <div className="flex flex-wrap gap-3">
            {WEEKDAY_LABELS.map((dayLabel, day) => (
              <label key={day} className="flex items-center gap-1 text-sm text-muted">
                <input
                  type="checkbox"
                  aria-label={dayLabel}
                  checked={weeklyDays.includes(day)}
                  onChange={() => toggleWeekday(day)}
                  className="accent-primary w-4 h-4"
                />
                {dayLabel}
              </label>
            ))}
          </div>
        )}
        <button type="submit" className={buttonClass}>
          Add reminder
        </button>
      </form>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Reminders" steps={tutorialContent.reminders} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domains/reminders/RemindersScreen.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire the route and sidebar entry**

In `src/components/Sidebar.tsx`, add a nav entry after `goals`:

```typescript
const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', color: '#3947C4' },
  { path: '/workout', label: 'Workout', color: '#C4502D' },
  { path: '/learning', label: 'Learning', color: '#2E6E9E' },
  { path: '/chores', label: 'Chores', color: '#A8842A' },
  { path: '/finances', label: 'Finances', color: '#2E7A54' },
  { path: '/meals', label: 'Meals', color: '#B4527E' },
  { path: '/health', label: 'Health', color: '#2E8E88' },
  { path: '/goals', label: 'Goals', color: '#6C5DA0' },
  { path: '/reminders', label: 'Reminders', color: '#D68A2E' },
];
```

In `src/App.tsx`, add the import:

```typescript
import { RemindersScreen } from './domains/reminders/RemindersScreen';
```

and the route, after `/goals`:

```typescript
          <Route path="/goals" element={<GoalsScreen uid={uid} />} />
          <Route path="/reminders" element={<RemindersScreen uid={uid} />} />
```

- [ ] **Step 6: Run the full client test suite**

Run: `npx vitest run`
Expected: PASS (no regressions)

- [ ] **Step 7: Run the TypeScript build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/domains/reminders/RemindersScreen.tsx src/domains/reminders/RemindersScreen.test.tsx src/components/Sidebar.tsx src/App.tsx
git commit -m "feat: add Reminders screen with add/check-off/remove and route it in"
```

---

### Task 7: Background worker — check and push custom reminders

**Files:**
- Modify: `workers/reminders/src/reminders.ts`
- Modify: `workers/reminders/src/reminders.test.ts`
- Modify: `workers/reminders/src/index.ts`
- Modify: `workers/reminders/src/index.test.ts`

**Interfaces:**
- Produces: `shouldFireCustomReminder(now, timeZone, time, weeklyDays, lastSentDate, windowMinutes = 2): FireCheck` in `reminders.ts`, consumed by `index.ts` in this same task.

- [ ] **Step 1: Write the failing tests for `shouldFireCustomReminder`**

In `workers/reminders/src/reminders.test.ts`, add the import and new describe block:

```typescript
import { parseHHMM, shouldFireDaily, shouldFireWeekly, shouldFireCustomReminder } from './reminders';
```

```typescript
describe('shouldFireCustomReminder', () => {
  it('fires a daily reminder (no weeklyDays) within the window', () => {
    const now = new Date('2026-07-23T10:01:00Z');
    const result = shouldFireCustomReminder(now, 'UTC', '10:00', undefined, null);
    expect(result).toEqual({ fire: true, todayId: '2026-07-23' });
  });

  it('fires a weekly reminder only on a matching weekday', () => {
    // 2026-07-20 is a Monday (weekday 1)
    const now = new Date('2026-07-20T07:01:00Z');
    expect(shouldFireCustomReminder(now, 'UTC', '07:00', [1, 3, 5], null).fire).toBe(true);
    expect(shouldFireCustomReminder(now, 'UTC', '07:00', [2, 4], null).fire).toBe(false);
  });

  it('does not fire twice on the same day', () => {
    const now = new Date('2026-07-23T10:01:00Z');
    const result = shouldFireCustomReminder(now, 'UTC', '10:00', undefined, '2026-07-23');
    expect(result.fire).toBe(false);
  });

  it('does not fire outside the time window', () => {
    const now = new Date('2026-07-23T11:00:00Z');
    const result = shouldFireCustomReminder(now, 'UTC', '10:00', undefined, null);
    expect(result.fire).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workers/reminders && npx vitest run src/reminders.test.ts`
Expected: FAIL — `shouldFireCustomReminder` doesn't exist.

- [ ] **Step 3: Implement `shouldFireCustomReminder`**

In `workers/reminders/src/reminders.ts`, add after `shouldFireWeekly`:

```typescript
export function shouldFireCustomReminder(
  now: Date,
  timeZone: string,
  time: string,
  weeklyDays: number[] | undefined,
  lastSentDate: string | null,
  windowMinutes = 2,
): FireCheck {
  const todayId = zonedDateId(now, timeZone);
  if (lastSentDate === todayId) return { fire: false, todayId };
  if (weeklyDays && !weeklyDays.includes(zonedWeekday(now, timeZone))) return { fire: false, todayId };
  const diff = Math.abs(zonedMinutesSinceMidnight(now, timeZone) - parseHHMM(time));
  return { fire: diff < windowMinutes, todayId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workers/reminders && npx vitest run src/reminders.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Write the failing test for the worker's custom reminder loop**

In `workers/reminders/src/index.test.ts`, add a test inside `describe('runReminderCheck', ...)`, after the `'sends no pushes for a user who has disabled notifications'` test:

```typescript
  it('fires a due custom reminder and records lastSentDate', async () => {
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'uid1', data: {} }];
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      if (path === 'users/uid1/customReminders') {
        return [{ id: 'r1', data: { label: 'Drink water', time: '06:45', cadence: 'daily' } }];
      }
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') return defaultConfig;
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:46:00Z'));

    expect(mockSendPush).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-a', title: 'Reminder', body: 'Drink water' })
    );
    expect(mockPatchDocument).toHaveBeenCalledWith(
      'proj1',
      'access-token',
      'users/uid1/reminderState/r1',
      { lastSentDate: '2026-07-23' }
    );
  });

  it('does not fire a custom reminder that is not due yet', async () => {
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'uid1', data: {} }];
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      if (path === 'users/uid1/customReminders') {
        return [{ id: 'r1', data: { label: 'Drink water', time: '20:00', cadence: 'daily' } }];
      }
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') return defaultConfig;
      // Suppress the fixed "workout" reminder (defaultConfig.workoutTime is
      // '06:45', within the window of `now` below) so it doesn't also fire
      // and pollute this test's "nothing fired" assertion.
      if (path === 'users/uid1/reminderState/workout') return { lastSentDate: '2026-07-23' };
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:46:00Z'));

    expect(mockSendPush).not.toHaveBeenCalled();
  });
```

Note: the first test above (`'fires a due custom reminder...'`) doesn't suppress the fixed workout reminder, so with `now` at `06:46 UTC` and `defaultConfig.workoutTime: '06:45'`, that fixed reminder *also* fires in that test run. That's fine — the test asserts the custom-reminder push with `toHaveBeenCalledWith(expect.objectContaining(...))` rather than `toHaveBeenCalledTimes`, so the extra fixed-reminder push doesn't break the assertion. The second test above needs the explicit suppression shown, since it asserts nothing fired at all.

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: FAIL — the worker doesn't check `customReminders` yet.

- [ ] **Step 7: Implement the custom reminder loop in `runReminderCheckForUser`**

In `workers/reminders/src/index.ts`, add the import:

```typescript
import { shouldFireDaily, shouldFireWeekly, shouldFireCustomReminder } from './reminders';
```

Add a local interface near `interface PushJob`:

```typescript
interface CustomReminderDoc {
  id: string;
  label: string;
  time: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}
```

In `runReminderCheckForUser`, after the existing chore-due block and before `if (jobs.length === 0) return;`, add:

```typescript
  const customReminders = await listDocuments(projectId, accessToken, `${base}/customReminders`);
  for (const doc of customReminders) {
    const reminder = { id: doc.id, ...doc.data } as CustomReminderDoc;
    const state = await getDocument(projectId, accessToken, `${base}/reminderState/${reminder.id}`);
    const check = shouldFireCustomReminder(
      now,
      config.timezone,
      reminder.time,
      reminder.weeklyDays,
      lastSentDateOf(state),
    );
    if (check.fire) {
      jobs.push({ key: reminder.id, todayId: check.todayId, title: 'Reminder', body: reminder.label });
    }
  }
```

- [ ] **Step 8: Run the worker tests to verify they pass**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: PASS (all tests)

- [ ] **Step 9: Run the full worker suite**

Run: `cd workers/reminders && npx vitest run`
Expected: PASS (no regressions)

- [ ] **Step 10: Commit**

```bash
git add workers/reminders/src/reminders.ts workers/reminders/src/reminders.test.ts workers/reminders/src/index.ts workers/reminders/src/index.test.ts
git commit -m "feat: fire push notifications for due custom reminders"
```

---

### Task 8: Foreground scheduler — dynamic custom reminders

**Files:**
- Modify: `src/notifications/useLocalReminderScheduler.ts`
- Modify: `src/notifications/useLocalReminderScheduler.test.ts`

**Interfaces:**
- Consumes: `listCustomReminders`, `isCustomReminderDueToday` from Task 2; `CustomReminder` from Task 1.

- [ ] **Step 1: Write the failing tests**

In `src/notifications/useLocalReminderScheduler.test.ts`, add a mock for `remindersApi` near the existing `reminderConfigApi` mock:

```typescript
const mockGetReminderConfig = vi.fn();
const mockListCustomReminders = vi.fn();
vi.mock('../domains/settings/reminderConfigApi', () => ({
  getReminderConfig: (...args: unknown[]) => mockGetReminderConfig(...args),
}));
vi.mock('../domains/reminders/remindersApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/reminders/remindersApi')>(
    '../domains/reminders/remindersApi'
  );
  return { ...actual, listCustomReminders: (...args: unknown[]) => mockListCustomReminders(...args) };
});
```

Add `mockListCustomReminders.mockReset().mockResolvedValue([])` to the top-level `beforeEach` (so existing tests, which don't care about custom reminders, keep passing):

```typescript
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 6, 30, 0));
    mockGetReminderConfig.mockReset().mockResolvedValue(config);
    mockListCustomReminders.mockReset().mockResolvedValue([]);
    mockShowNotification.mockReset();
    localStorage.clear();
    vi.stubGlobal('Notification', { permission: 'granted' });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ showNotification: mockShowNotification }) },
      configurable: true,
    });
  });
```

Add new tests at the end of the `describe` block:

```typescript
  it('schedules and fires a notification for a due custom reminder', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Drink water', time: '06:45', cadence: 'daily' },
    ]);
    renderHook(() => useLocalReminderScheduler('user1'));
    await vi.waitFor(() => expect(mockListCustomReminders).toHaveBeenCalledWith('user1'));
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Reminder',
      expect.objectContaining({ body: 'Drink water', tag: 'r1-2026-07-23' }),
    );
  });

  it('does not schedule a custom reminder not due today', async () => {
    mockListCustomReminders.mockResolvedValue([
      { id: 'r1', label: 'Gym', time: '06:45', cadence: 'weekly', weeklyDays: [2, 4] }, // 2026-07-23 is a Thursday (4) — wait, check below
    ]);
    renderHook(() => useLocalReminderScheduler('user1'));
    await vi.waitFor(() => expect(mockListCustomReminders).toHaveBeenCalledWith('user1'));
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(mockShowNotification).not.toHaveBeenCalledWith('Reminder', expect.anything());
  });
```

`2026-07-23` is a Thursday (weekday `4`). Fix the second test's `weeklyDays` to exclude Thursday so it's genuinely not due — use `weeklyDays: [1, 2]` (Monday, Tuesday):

```typescript
      { id: 'r1', label: 'Gym', time: '06:45', cadence: 'weekly', weeklyDays: [1, 2] },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notifications/useLocalReminderScheduler.test.ts`
Expected: FAIL — the scheduler doesn't fetch or schedule custom reminders yet.

- [ ] **Step 3: Implement the dynamic loop**

In `src/notifications/useLocalReminderScheduler.ts`, add the import:

```typescript
import { listCustomReminders, isCustomReminderDueToday } from '../domains/reminders/remindersApi';
```

In the `useEffect`, after the existing `for (const reminder of LOCAL_REMINDERS) { ... }` loop and before the closing of the `.then((config) => { ... })` callback, add a second data fetch and loop. Since the custom reminder list needs its own async fetch alongside the config fetch, restructure the `.then` chain to fetch both in parallel:

Replace:

```typescript
    getReminderConfig(uid).then((config) => {
      if (cancelled) return;
      const now = new Date();
      const dateId = localDateId(now);

      for (const reminder of LOCAL_REMINDERS) {
        if (reminder.weekdayOnly !== undefined && now.getDay() !== reminder.weekdayOnly) continue;
        if (localStorage.getItem(shownKey(reminder.key, dateId))) continue;

        const fireAt = todayFireTime(reminder.getTime(config), now);
        if (!fireAt) continue;

        const delay = fireAt.getTime() - now.getTime();
        const timeoutId = setTimeout(() => {
          localStorage.setItem(shownKey(reminder.key, dateId), '1');
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(reminder.title, {
              body: reminder.body,
              tag: `${reminder.key}-${dateId}`,
              icon: '/icons/icon-192.png',
            });
          });
        }, delay);
        timeoutIds.push(timeoutId);
      }
    });
```

with:

```typescript
    Promise.all([getReminderConfig(uid), listCustomReminders(uid)]).then(([config, customReminders]) => {
      if (cancelled) return;
      const now = new Date();
      const dateId = localDateId(now);

      function scheduleIfDue(key: string, time: string, title: string, body: string) {
        if (localStorage.getItem(shownKey(key, dateId))) return;
        const fireAt = todayFireTime(time, now);
        if (!fireAt) return;

        const delay = fireAt.getTime() - now.getTime();
        const timeoutId = setTimeout(() => {
          localStorage.setItem(shownKey(key, dateId), '1');
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              tag: `${key}-${dateId}`,
              icon: '/icons/icon-192.png',
            });
          });
        }, delay);
        timeoutIds.push(timeoutId);
      }

      for (const reminder of LOCAL_REMINDERS) {
        if (reminder.weekdayOnly !== undefined && now.getDay() !== reminder.weekdayOnly) continue;
        scheduleIfDue(reminder.key, reminder.getTime(config), reminder.title, reminder.body);
      }

      for (const reminder of customReminders) {
        if (!isCustomReminderDueToday(reminder, now.getDay())) continue;
        scheduleIfDue(reminder.id, reminder.time, 'Reminder', reminder.label);
      }
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/notifications/useLocalReminderScheduler.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Run the full client test suite**

Run: `npx vitest run`
Expected: PASS (no regressions)

- [ ] **Step 6: Run the TypeScript build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/notifications/useLocalReminderScheduler.ts src/notifications/useLocalReminderScheduler.test.ts
git commit -m "feat: schedule foreground notifications for due custom reminders"
```

---

## Manual verification (not automated)

1. Run `npm run dev`, open the new Reminders screen from the sidebar, add a daily reminder and a weekly reminder (pick specific weekdays), confirm both appear with the right cadence summary, check one off, and remove one.
2. Confirm a due reminder shows up in the Dashboard's "Due now" strip, and that checking it off there (via the Reminders screen) changes the day health %.
3. Deploy the worker (`cd workers/reminders && wrangler deploy`) and, with a reminder set a couple of minutes in the future, confirm a push notification arrives with title "Reminder" and the reminder's label as the body.
4. With the app open in a foreground tab and a reminder set a few minutes out, confirm the foreground path also fires (or at least doesn't double-fire oddly — both paths use the same FCM tag / localStorage key namespace per reminder id, so duplicate suppression should hold the same way it does for the built-in reminders).
