# Weekday-Recurring Plans + Streak Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Workout, Learning, Health, and Meals define weekday-recurring plans (mirroring Chores/Reminders' `cadence`/`weeklyDays` model), and give every recurring item (Chores, Reminders, and the 4 new plan types) an all-time point total and a current streak, both stored as running counters updated on completion.

**Architecture:** Each domain gets a new Firestore-backed "plan" CRUD module (`isXDueToday` pure helper included) at `users/{uid}/<collection>`, following `choresApi.ts` exactly. A new shared `streakLogic.ts` module provides one pure function, `applyCompletion`, used by every domain's completion path to bump `points`/`currentStreak`. Chores/Reminders wire it into their existing per-item checkbox flow (`setChoreDone`/`setReminderDone`); the 4 new plan domains wire it into their existing log-entry save functions, since completion there is derived ("any log entry today completes all of today's due plans on that page"), not a separate checkbox. The dashboard's due-item and day-health aggregation (`dashboardLogic.ts`) extends to include the 4 new domains.

**Tech Stack:** React 18 + TypeScript, Vite, Firebase/Firestore, Vitest + Testing Library.

## Global Constraints

- Follow existing file/module conventions exactly: one `<domain>Api.ts` per Firestore collection, `is<X>DueToday(item, dow)` as a pure exported function, `points`/`currentStreak`/`lastCompletedDate` optional fields (not required) on every recurring-item type, so existing test fixtures that omit them keep compiling.
- `weeklyDays` semantics: `0` (Sun) .. `6` (Sat), matching `dateUtils.dayOfWeek`.
- No new routes, sidebar entries, or tutorial screens — all new UI lives inside the 4 existing domain screens as an added section.
- Unchecking a chore/reminder (`done === false`) never changes `points`/`currentStreak` — only completing does.
- Per spec: do not touch Goals or Finances, and do not refactor `RemindersScreen.tsx` to use the new shared `WeekdayPicker`.

---

### Task 1: Shared types + streak logic

**Files:**
- Modify: `src/domains/shared/types.ts`
- Create: `src/domains/shared/streakLogic.ts`
- Create: `src/domains/shared/streakLogic.test.ts`

**Interfaces:**
- Produces: `WorkoutRoutine`, `LearningPlan`, `HealthPlan`, `MealPlan` types; `points?`/`currentStreak?`/`lastCompletedDate?` added to `ChoreConfig` and `CustomReminder`; `previousDueDateBefore(date: string, cadence: 'daily' | 'weekly', weeklyDays?: number[]): string | undefined`; `applyCompletion(item: { points?: number; currentStreak?: number; lastCompletedDate?: string; cadence: 'daily' | 'weekly'; weeklyDays?: number[] }, completedDate: string): { points: number; currentStreak: number; lastCompletedDate: string }`.

- [ ] **Step 1: Add streak fields to `ChoreConfig`/`CustomReminder` and the 4 new plan types in `types.ts`**

In `src/domains/shared/types.ts`, replace the `ChoreConfig` and `CustomReminder` interfaces:

```typescript
export interface ChoreConfig {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface CustomReminder {
  id: string;
  label: string;
  time: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}
```

Then add, after `LearningLogEntry`:

```typescript
export interface WorkoutRoutine {
  id: string;
  name: string;
  exercises: { id: string; name: string }[];
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface LearningPlan {
  id: string;
  topic: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface HealthPlan {
  id: string;
  label: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

export interface MealPlan {
  id: string;
  name: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}
```

- [ ] **Step 2: Write the failing test for `streakLogic.ts`**

Create `src/domains/shared/streakLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { previousDueDateBefore, applyCompletion } from './streakLogic';

describe('previousDueDateBefore', () => {
  it('returns yesterday for a daily cadence', () => {
    expect(previousDueDateBefore('2026-08-05', 'daily')).toBe('2026-08-04');
  });

  it('returns the most recent prior matching weekday for a weekly cadence', () => {
    // 2026-08-05 is a Wednesday (dow 3); the prior Wednesday is 2026-07-29.
    expect(previousDueDateBefore('2026-08-05', 'weekly', [3])).toBe('2026-07-29');
  });

  it('finds the closest prior day among several configured weekdays', () => {
    // Mon/Wed/Fri; closest day before Wed 2026-08-05 is Mon 2026-08-03.
    expect(previousDueDateBefore('2026-08-05', 'weekly', [1, 3, 5])).toBe('2026-08-03');
  });

  it('returns undefined when no weekly days are configured', () => {
    expect(previousDueDateBefore('2026-08-05', 'weekly', [])).toBeUndefined();
  });
});

describe('applyCompletion', () => {
  const dailyItem = { cadence: 'daily' as const, points: 0, currentStreak: 0, lastCompletedDate: undefined };

  it('awards 1 point and starts a streak of 1 on first-ever completion', () => {
    const result = applyCompletion(dailyItem, '2026-08-05');
    expect(result).toEqual({ points: 1, currentStreak: 1, lastCompletedDate: '2026-08-05' });
  });

  it('continues the streak when the previous due day was completed', () => {
    const item = { cadence: 'daily' as const, points: 10, currentStreak: 3, lastCompletedDate: '2026-08-04' };
    const result = applyCompletion(item, '2026-08-05');
    expect(result).toEqual({ points: 11, currentStreak: 4, lastCompletedDate: '2026-08-05' });
  });

  it('resets the streak to 1 when a due day was skipped', () => {
    const item = { cadence: 'daily' as const, points: 10, currentStreak: 5, lastCompletedDate: '2026-08-02' };
    const result = applyCompletion(item, '2026-08-05');
    expect(result).toEqual({ points: 11, currentStreak: 1, lastCompletedDate: '2026-08-05' });
  });

  it('continues a weekly streak across the correct prior weekday', () => {
    const item = {
      cadence: 'weekly' as const,
      weeklyDays: [3],
      points: 2,
      currentStreak: 2,
      lastCompletedDate: '2026-07-29',
    };
    const result = applyCompletion(item, '2026-08-05');
    expect(result).toEqual({ points: 3, currentStreak: 3, lastCompletedDate: '2026-08-05' });
  });

  it('treats missing points/currentStreak as 0', () => {
    const result = applyCompletion({ cadence: 'daily' as const }, '2026-08-05');
    expect(result).toEqual({ points: 1, currentStreak: 1, lastCompletedDate: '2026-08-05' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/domains/shared/streakLogic.test.ts`
Expected: FAIL — `streakLogic.ts` does not exist yet.

- [ ] **Step 4: Implement `streakLogic.ts`**

Create `src/domains/shared/streakLogic.ts`:

```typescript
import { todayId } from './dateUtils';

export function previousDueDateBefore(
  date: string,
  cadence: 'daily' | 'weekly',
  weeklyDays?: number[]
): string | undefined {
  const cursor = new Date(`${date}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (cadence === 'daily' || (weeklyDays?.includes(cursor.getDay()) ?? false)) {
      return todayId(cursor);
    }
  }
  return undefined;
}

interface StreakFields {
  points?: number;
  currentStreak?: number;
  lastCompletedDate?: string;
}

interface RecurrenceFields {
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}

export function applyCompletion<T extends StreakFields & RecurrenceFields>(
  item: T,
  completedDate: string
): { points: number; currentStreak: number; lastCompletedDate: string } {
  const prevDue = previousDueDateBefore(completedDate, item.cadence, item.weeklyDays);
  const continues = item.lastCompletedDate !== undefined && item.lastCompletedDate === prevDue;
  return {
    points: (item.points ?? 0) + 1,
    currentStreak: continues ? (item.currentStreak ?? 0) + 1 : 1,
    lastCompletedDate: completedDate,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/domains/shared/streakLogic.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors (the added fields are optional, so existing `ChoreConfig`/`CustomReminder` literals across the codebase still compile).

- [ ] **Step 7: Commit**

```bash
git add src/domains/shared/types.ts src/domains/shared/streakLogic.ts src/domains/shared/streakLogic.test.ts
git commit -m "feat: add streak/points types and shared streak logic"
```

---

### Task 2: Wire streak updates into Chores/Reminders completion

**Files:**
- Modify: `src/domains/shared/completionsApi.ts`
- Modify: `src/domains/shared/completionsApi.test.ts`
- Modify: `src/domains/chores/choresApi.ts`
- Modify: `src/domains/chores/choresApi.test.ts`
- Modify: `src/domains/reminders/remindersApi.ts`
- Modify: `src/domains/reminders/remindersApi.test.ts`

**Interfaces:**
- Consumes: `applyCompletion` from Task 1 (`src/domains/shared/streakLogic.ts`).
- Produces: `setChoreDone(uid: string, chore: ChoreConfig, done: boolean, date?: string): Promise<void>` (signature changed from `choreId: string` to the full `chore: ChoreConfig`); `setReminderDone(uid: string, reminder: CustomReminder, done: boolean, date?: string): Promise<void>` (same change). `listChores`/`saveChore`/`listCustomReminders`/`saveCustomReminder` now round-trip `points`/`currentStreak`/`lastCompletedDate`.

- [ ] **Step 1: Update `choresApi.ts` to persist streak fields**

Replace `src/domains/chores/choresApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ChoreConfig } from '../shared/types';

export async function listChores(uid: string): Promise<ChoreConfig[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'chores'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<ChoreConfig, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveChore(uid: string, chore: ChoreConfig): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'chores', chore.id), {
    name: chore.name,
    cadence: chore.cadence,
    weeklyDays: chore.weeklyDays ?? null,
    points: chore.points ?? 0,
    currentStreak: chore.currentStreak ?? 0,
    lastCompletedDate: chore.lastCompletedDate ?? null,
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

- [ ] **Step 2: Update `choresApi.test.ts` expectations for the new fields**

In `src/domains/chores/choresApi.test.ts`, update the two CRUD tests:

```typescript
  it('listChores maps Firestore docs to ChoreConfig objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'c1', data: () => ({ name: 'Dishes', cadence: 'daily', weeklyDays: null }) }],
    });
    const result = await listChores('user1');
    expect(result).toEqual([
      { id: 'c1', name: 'Dishes', cadence: 'daily', weeklyDays: null, points: 0, currentStreak: 0 },
    ]);
  });

  it('saveChore writes the chore fields', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    await saveChore('user1', chore);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Dishes',
      cadence: 'daily',
      weeklyDays: null,
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });
```

- [ ] **Step 3: Apply the same two changes to `remindersApi.ts` and its test**

Replace `src/domains/reminders/remindersApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { CustomReminder } from '../shared/types';

export async function listCustomReminders(uid: string): Promise<CustomReminder[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'customReminders'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<CustomReminder, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveCustomReminder(uid: string, reminder: CustomReminder): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'customReminders', reminder.id), {
    label: reminder.label,
    time: reminder.time,
    cadence: reminder.cadence,
    weeklyDays: reminder.weeklyDays ?? null,
    points: reminder.points ?? 0,
    currentStreak: reminder.currentStreak ?? 0,
    lastCompletedDate: reminder.lastCompletedDate ?? null,
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

In `src/domains/reminders/remindersApi.test.ts`, update the two CRUD tests the same way as chores (add `points: 0, currentStreak: 0` to the `listCustomReminders` expectation, and `points: 0, currentStreak: 0, lastCompletedDate: null` to the `saveCustomReminder` expectation).

- [ ] **Step 4: Update `completionsApi.test.ts` for the new `setChoreDone`/`setReminderDone` signatures**

Replace `src/domains/shared/completionsApi.test.ts` in full:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChoreConfig, CustomReminder } from './types';

const mockDoc = vi.fn((...args: unknown[]) => ({ path: args.join('/') }));
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockLimit = vi.fn((..._args: unknown[]) => ({}));
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

const mockSaveChore = vi.fn().mockResolvedValue(undefined);
vi.mock('../chores/choresApi', () => ({
  saveChore: (...args: [string, ChoreConfig]) => mockSaveChore(...args),
}));

const mockSaveCustomReminder = vi.fn().mockResolvedValue(undefined);
vi.mock('../reminders/remindersApi', () => ({
  saveCustomReminder: (...args: [string, CustomReminder]) => mockSaveCustomReminder(...args),
}));

import {
  getCompletion,
  listRecentCompletions,
  setWorkoutDone,
  setLearningDone,
  setChoreDone,
  setReminderDone,
} from './completionsApi';

describe('completionsApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSaveChore.mockClear();
    mockSaveCustomReminder.mockClear();
  });

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
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20', workout: true }) });
    const result = await getCompletion('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', workout: true, learning: false, chores: {}, reminders: {} });
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

  it('setChoreDone merges a single chore flag and awards a streak point when done', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily', points: 2, currentStreak: 1, lastCompletedDate: '2026-07-19' };
    await setChoreDone('user1', chore, true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', chores: { c1: true } },
      { merge: true }
    );
    expect(mockSaveChore).toHaveBeenCalledWith('user1', {
      ...chore,
      points: 3,
      currentStreak: 2,
      lastCompletedDate: '2026-07-20',
    });
  });

  it('setChoreDone does not touch streak fields when unchecking', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily', points: 2, currentStreak: 1, lastCompletedDate: '2026-07-20' };
    await setChoreDone('user1', chore, false, '2026-07-20');
    expect(mockSaveChore).not.toHaveBeenCalled();
  });

  it('setChoreDone does not double-award points for an already-completed date', async () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily', points: 2, currentStreak: 1, lastCompletedDate: '2026-07-20' };
    await setChoreDone('user1', chore, true, '2026-07-20');
    expect(mockSaveChore).not.toHaveBeenCalled();
  });

  it('setReminderDone merges a single reminder flag and awards a streak point when done', async () => {
    const reminder: CustomReminder = { id: 'r1', label: 'Drink water', time: '10:00', cadence: 'daily' };
    await setReminderDone('user1', reminder, true, '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { date: '2026-07-20', reminders: { r1: true } },
      { merge: true }
    );
    expect(mockSaveCustomReminder).toHaveBeenCalledWith('user1', {
      ...reminder,
      points: 1,
      currentStreak: 1,
      lastCompletedDate: '2026-07-20',
    });
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

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/domains/shared/completionsApi.test.ts`
Expected: FAIL — `setChoreDone`/`setReminderDone` don't yet accept a full item or call `saveChore`/`saveCustomReminder`.

- [ ] **Step 6: Implement the streak wiring in `completionsApi.ts`**

Replace `src/domains/shared/completionsApi.ts` in full:

```typescript
import { collection, doc, getDoc, getDocs, orderBy, limit, query, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ChoreConfig, CustomReminder, DailyCompletion } from './types';
import { todayId } from './dateUtils';
import { applyCompletion } from './streakLogic';
import { saveChore } from '../chores/choresApi';
import { saveCustomReminder } from '../reminders/remindersApi';

export function completionDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'completions', date);
}

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
  chore: ChoreConfig,
  done: boolean,
  date: string = todayId()
): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, chores: { [chore.id]: done } }, { merge: true });
  if (done && chore.lastCompletedDate !== date) {
    await saveChore(uid, { ...chore, ...applyCompletion(chore, date) });
  }
}

export async function setReminderDone(
  uid: string,
  reminder: CustomReminder,
  done: boolean,
  date: string = todayId()
): Promise<void> {
  await setDoc(completionDocRef(uid, date), { date, reminders: { [reminder.id]: done } }, { merge: true });
  if (done && reminder.lastCompletedDate !== date) {
    await saveCustomReminder(uid, { ...reminder, ...applyCompletion(reminder, date) });
  }
}
```

- [ ] **Step 7: Run all three test files to verify they pass**

Run: `npx vitest run src/domains/shared/completionsApi.test.ts src/domains/chores/choresApi.test.ts src/domains/reminders/remindersApi.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/domains/shared/completionsApi.ts src/domains/shared/completionsApi.test.ts src/domains/chores/choresApi.ts src/domains/chores/choresApi.test.ts src/domains/reminders/remindersApi.ts src/domains/reminders/remindersApi.test.ts
git commit -m "feat: award streak points when a chore or reminder is completed"
```

---

### Task 3: Update ChoresScreen/RemindersScreen for the new `setChoreDone`/`setReminderDone` signature and streak badges

**Files:**
- Modify: `src/domains/chores/ChoresScreen.tsx`
- Modify: `src/domains/chores/ChoresScreen.test.tsx`
- Modify: `src/domains/reminders/RemindersScreen.tsx`
- Modify: `src/domains/reminders/RemindersScreen.test.tsx`

**Interfaces:**
- Consumes: `applyCompletion` from Task 1; `setChoreDone`/`setReminderDone` new signatures from Task 2.

- [ ] **Step 1: Update `ChoresScreen.test.tsx`'s mock and assertion for the new signature**

In `src/domains/chores/ChoresScreen.test.tsx`, change the `setChoreDone` mock type and the assertion:

```typescript
vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setChoreDone: (...args: [string, unknown, boolean]) => mockSetChoreDone(...args),
}));
```

```typescript
  it('lists chores and lets you mark one done', async () => {
    mockListChores.mockResolvedValue([{ id: 'c1', name: 'Dishes', cadence: 'daily' }]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    renderScreen();

    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /Dishes/ }));

    expect(mockSetChoreDone).toHaveBeenCalledWith(
      'user1',
      { id: 'c1', name: 'Dishes', cadence: 'daily' },
      true
    );
  });
```

Add one new test for the streak badge, appended to the `describe('ChoresScreen', ...)` block:

```typescript
  it('shows the streak and points badge for a chore', async () => {
    mockListChores.mockResolvedValue([
      { id: 'c1', name: 'Dishes', cadence: 'daily', points: 12, currentStreak: 4 },
    ]);
    mockGetCompletion.mockResolvedValue({ date: '2026-07-20', workout: false, learning: false, chores: {} });

    renderScreen();

    await waitFor(() => expect(screen.getByText(/4.*12 pts/)).toBeInTheDocument());
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/chores/ChoresScreen.test.tsx`
Expected: FAIL — `ChoresScreen` still passes `chore.id` to `handleToggle`/`setChoreDone`, and renders no badge.

- [ ] **Step 3: Update `ChoresScreen.tsx`**

Replace `src/domains/chores/ChoresScreen.tsx` in full:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { listChores, saveChore, isChoreDueToday } from './choresApi';
import { getCompletion, setChoreDone } from '../shared/completionsApi';
import { applyCompletion } from '../shared/streakLogic';
import { ChoreConfig, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function ChoresScreen({ uid }: { uid: string }) {
  const [chores, setChores] = useState<ChoreConfig[]>([]);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [newChoreName, setNewChoreName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'chores');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listChores(uid).then(setChores).catch(handleError);
    getCompletion(uid).then(setCompletion).catch(handleError);
  }, [uid]);

  async function handleToggle(chore: ChoreConfig, done: boolean) {
    await setChoreDone(uid, chore, done);
    setCompletion((prev) =>
      prev ? { ...prev, chores: { ...prev.chores, [chore.id]: done } } : prev
    );
    if (done && chore.lastCompletedDate !== todayId()) {
      const updated = applyCompletion(chore, todayId());
      setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, ...updated } : c)));
    }
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

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  return (
    <PageCard>
      <ScreenHeader label="Chores" />
      <ul id="chores-list" className="flex flex-col gap-2">
        {chores.map((chore) => {
          const dueToday = isChoreDueToday(chore, dow);
          const done = completion?.chores?.[chore.id] ?? false;
          return (
            <li key={chore.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
              <input
                type="checkbox"
                aria-label={chore.name}
                checked={done}
                disabled={!dueToday}
                onChange={(e) => handleToggle(chore, e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm flex-1">{chore.name}</span>
              <span className="font-mono text-xs text-muted">
                🔥{chore.currentStreak ?? 0} · {chore.points ?? 0} pts
              </span>
              {!dueToday && <span className="font-mono text-xs text-muted">not due today</span>}
            </li>
          );
        })}
      </ul>
      <form id="chores-form" onSubmit={handleAddChore} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="New chore name"
          value={newChoreName}
          onChange={(e) => setNewChoreName(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" className={buttonClass}>
          Add chore
        </button>
      </form>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Chores" steps={tutorialContent.chores} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/chores/ChoresScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Repeat the same change for `RemindersScreen.tsx`**

In `src/domains/reminders/RemindersScreen.test.tsx`, update the `setReminderDone` mock signature comment/type and the toggle assertion analogously to Step 1 (mock type becomes `(...args: [string, unknown, boolean]) => mockSetReminderDone(...args)`, and the toggle test asserts `mockSetReminderDone).toHaveBeenCalledWith('user1', <the full reminder object used in that test's mockListCustomReminders fixture>, true)`).

In `src/domains/reminders/RemindersScreen.tsx`:
- Change `handleToggle(reminderId: string, done: boolean)` to `handleToggle(reminder: CustomReminder, done: boolean)`, calling `setReminderDone(uid, reminder, done)`, updating `completion` the same way as before, and — mirroring `ChoresScreen` — when `done && reminder.lastCompletedDate !== todayId()`, computing `applyCompletion(reminder, todayId())` and updating the matching entry in the `reminders` state array.
- Change the checkbox's `onChange` to `onChange={(e) => handleToggle(reminder, e.target.checked)}`.
- Add `import { applyCompletion } from '../shared/streakLogic';` and use `todayId` (already imported).
- In the `<li>`, add a badge span next to the existing `time`/`cadenceSummary` spans: `<span className="font-mono text-xs text-muted">🔥{reminder.currentStreak ?? 0} · {reminder.points ?? 0} pts</span>`.

- [ ] **Step 6: Run the reminders test to verify it passes**

Run: `npx vitest run src/domains/reminders/RemindersScreen.test.tsx`
Expected: PASS

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors

- [ ] **Step 8: Commit**

```bash
git add src/domains/chores/ChoresScreen.tsx src/domains/chores/ChoresScreen.test.tsx src/domains/reminders/RemindersScreen.tsx src/domains/reminders/RemindersScreen.test.tsx
git commit -m "feat: show streak/points badges on Chores and Reminders"
```

---

### Task 4: Shared `WeekdayPicker` component

**Files:**
- Create: `src/domains/shared/WeekdayPicker.tsx`
- Create: `src/domains/shared/WeekdayPicker.test.tsx`

**Interfaces:**
- Produces: `WeekdayPicker({ value: number[]; onChange: (days: number[]) => void }): JSX.Element`; `weekdaySummary(weeklyDays: number[] | undefined): string` (e.g. `"Mon, Wed, Fri"` or `"No days selected"`).

- [ ] **Step 1: Write the failing test**

Create `src/domains/shared/WeekdayPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekdayPicker, weekdaySummary } from './WeekdayPicker';

describe('weekdaySummary', () => {
  it('joins selected weekday labels', () => {
    expect(weekdaySummary([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('falls back to a placeholder when nothing is selected', () => {
    expect(weekdaySummary([])).toBe('No days selected');
    expect(weekdaySummary(undefined)).toBe('No days selected');
  });
});

describe('WeekdayPicker', () => {
  it('adds a day to the selection on click', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    expect(onChange).toHaveBeenCalledWith([3]);
  });

  it('removes an already-selected day on click', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[1, 3]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }));
    expect(onChange).toHaveBeenCalledWith([3]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/shared/WeekdayPicker.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `WeekdayPicker.tsx`**

Create `src/domains/shared/WeekdayPicker.tsx`:

```tsx
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdaySummary(weeklyDays: number[] | undefined): string {
  return (weeklyDays ?? []).map((d) => WEEKDAY_LABELS[d]).join(', ') || 'No days selected';
}

export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  function toggleDay(day: number) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-wrap gap-3">
      {WEEKDAY_LABELS.map((dayLabel, day) => (
        <label key={day} className="flex items-center gap-1 text-sm text-muted">
          <input
            type="checkbox"
            aria-label={dayLabel}
            checked={value.includes(day)}
            onChange={() => toggleDay(day)}
            className="accent-primary w-4 h-4"
          />
          {dayLabel}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/shared/WeekdayPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/shared/WeekdayPicker.tsx src/domains/shared/WeekdayPicker.test.tsx
git commit -m "feat: add shared WeekdayPicker component"
```

---

### Task 5: Workout routines API

**Files:**
- Create: `src/domains/workout/workoutRoutinesApi.ts`
- Create: `src/domains/workout/workoutRoutinesApi.test.ts`

**Interfaces:**
- Consumes: `WorkoutRoutine` from Task 1.
- Produces: `listWorkoutRoutines(uid): Promise<WorkoutRoutine[]>`, `saveWorkoutRoutine(uid, routine): Promise<void>`, `deleteWorkoutRoutine(uid, id): Promise<void>`, `isWorkoutRoutineDueToday(routine, dow): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/domains/workout/workoutRoutinesApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkoutRoutine } from '../shared/types';

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

import {
  listWorkoutRoutines,
  saveWorkoutRoutine,
  deleteWorkoutRoutine,
  isWorkoutRoutineDueToday,
} from './workoutRoutinesApi';

describe('isWorkoutRoutineDueToday', () => {
  it('is always due for daily routines', () => {
    const routine: WorkoutRoutine = { id: 'w1', name: 'Full Body', exercises: [], cadence: 'daily' };
    expect(isWorkoutRoutineDueToday(routine, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const routine: WorkoutRoutine = {
      id: 'w2',
      name: 'Push Day',
      exercises: [],
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
    };
    expect(isWorkoutRoutineDueToday(routine, 3)).toBe(true);
    expect(isWorkoutRoutineDueToday(routine, 2)).toBe(false);
  });
});

describe('workoutRoutinesApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listWorkoutRoutines maps Firestore docs to WorkoutRoutine objects, defaulting points/currentStreak', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'w1',
          data: () => ({
            name: 'Push Day',
            exercises: [{ id: 'e1', name: 'Bench Press' }],
            cadence: 'weekly',
            weeklyDays: [1, 3, 5],
          }),
        },
      ],
    });
    const result = await listWorkoutRoutines('user1');
    expect(result).toEqual([
      {
        id: 'w1',
        name: 'Push Day',
        exercises: [{ id: 'e1', name: 'Bench Press' }],
        cadence: 'weekly',
        weeklyDays: [1, 3, 5],
        points: 0,
        currentStreak: 0,
      },
    ]);
  });

  it('saveWorkoutRoutine writes the routine fields', async () => {
    const routine: WorkoutRoutine = {
      id: 'w1',
      name: 'Push Day',
      exercises: [{ id: 'e1', name: 'Bench Press' }],
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
    };
    await saveWorkoutRoutine('user1', routine);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Push Day',
      exercises: [{ id: 'e1', name: 'Bench Press' }],
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteWorkoutRoutine removes the routine doc', async () => {
    await deleteWorkoutRoutine('user1', 'w1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/workout/workoutRoutinesApi.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `workoutRoutinesApi.ts`**

Create `src/domains/workout/workoutRoutinesApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WorkoutRoutine } from '../shared/types';

export async function listWorkoutRoutines(uid: string): Promise<WorkoutRoutine[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'workoutRoutines'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<WorkoutRoutine, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveWorkoutRoutine(uid: string, routine: WorkoutRoutine): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'workoutRoutines', routine.id), {
    name: routine.name,
    exercises: routine.exercises,
    cadence: routine.cadence,
    weeklyDays: routine.weeklyDays ?? null,
    points: routine.points ?? 0,
    currentStreak: routine.currentStreak ?? 0,
    lastCompletedDate: routine.lastCompletedDate ?? null,
  });
}

export async function deleteWorkoutRoutine(uid: string, routineId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'workoutRoutines', routineId));
}

export function isWorkoutRoutineDueToday(routine: WorkoutRoutine, dow: number): boolean {
  if (routine.cadence === 'daily') return true;
  return routine.weeklyDays?.includes(dow) ?? false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/workout/workoutRoutinesApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/workout/workoutRoutinesApi.ts src/domains/workout/workoutRoutinesApi.test.ts
git commit -m "feat: add workout routines CRUD API"
```

---

### Task 6: WorkoutScreen — routines section + completion wiring

**Files:**
- Modify: `src/domains/workout/WorkoutScreen.tsx`
- Modify: `src/domains/workout/WorkoutScreen.test.tsx`

**Interfaces:**
- Consumes: `listWorkoutRoutines`, `saveWorkoutRoutine`, `deleteWorkoutRoutine`, `isWorkoutRoutineDueToday` from Task 5; `WeekdayPicker`, `weekdaySummary` from Task 4; `applyCompletion` from Task 1; `dayOfWeek` from `dateUtils.ts`.

- [ ] **Step 1: Read the existing `WorkoutScreen.test.tsx` to see current mocks**

Run: `cat src/domains/workout/WorkoutScreen.test.tsx`

(This file exists already — inspect it so the new mocks/tests you add in Step 2 match its existing `vi.mock` style for `./workoutApi` and `../shared/completionsApi` exactly, the same way `ChoresScreen.test.tsx` mocks `./choresApi`.)

- [ ] **Step 2: Add routine-related mocks and new tests to `WorkoutScreen.test.tsx`**

Add a `vi.mock('./workoutRoutinesApi', ...)` block (mirroring the existing `./workoutApi` mock style found in Step 1) exposing `listWorkoutRoutines`, `saveWorkoutRoutine`, `deleteWorkoutRoutine`, and the real `isWorkoutRoutineDueToday` (re-exported via `vi.importActual`, same pattern as `ChoresScreen.test.tsx`'s `choresApi` mock). Add these tests to the `describe('WorkoutScreen', ...)` block:

```typescript
  it('adds a new workout routine with weekday repeat', async () => {
    mockListWorkoutRoutines.mockResolvedValue([]);
    // ...existing entries/completion mocks from the file's other tests...

    renderScreen();
    await waitFor(() => expect(mockListWorkoutRoutines).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Routine name (e.g. Push Day)'), 'Push Day');
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    await user.type(screen.getByPlaceholderText('Exercise name', { selector: '#routine-form input' }), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add routine' }));

    expect(mockSaveWorkoutRoutine).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ name: 'Push Day', weeklyDays: [3], exercises: [expect.objectContaining({ name: 'Bench Press' })] })
    );
  });

  it('shows a due-today badge for a routine scheduled today and awards a streak when a session is logged', async () => {
    mockListWorkoutRoutines.mockResolvedValue([
      { id: 'w1', name: 'Push Day', exercises: [{ id: 'e1', name: 'Bench Press' }], cadence: 'daily', points: 0, currentStreak: 0 },
    ]);
    // ...existing entries/completion mocks...

    renderScreen();
    await waitFor(() => expect(screen.getByText('Push Day')).toBeInTheDocument());
    expect(screen.getByText('Due today')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Workout name (e.g. Chest Workout)'), 'Chest Workout');
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.type(screen.getByPlaceholderText('Reps'), '10');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await waitFor(() =>
      expect(mockSaveWorkoutRoutine).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ id: 'w1', points: 1, currentStreak: 1 })
      )
    );
  });
```

Fill in the exact mock setup for `entries`/`completion` by copying the pattern already used in this file's existing `describe` block (same `mockListWorkoutLogEntries`/`mockGetCompletion` resolved values used elsewhere in the file).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/domains/workout/WorkoutScreen.test.tsx`
Expected: FAIL — no routines UI exists yet.

- [ ] **Step 4: Add the routines section and completion wiring to `WorkoutScreen.tsx`**

Add these imports to `src/domains/workout/WorkoutScreen.tsx`:

```typescript
import {
  listWorkoutRoutines,
  saveWorkoutRoutine,
  deleteWorkoutRoutine,
  isWorkoutRoutineDueToday,
} from './workoutRoutinesApi';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { WorkoutRoutine } from '../shared/types';
import { dayOfWeek } from '../shared/dateUtils';
```

Add state (alongside the existing `useState` calls):

```typescript
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [routineName, setRoutineName] = useState('');
  const [routineCadence, setRoutineCadence] = useState<'daily' | 'weekly'>('daily');
  const [routineWeeklyDays, setRoutineWeeklyDays] = useState<number[]>([]);
  const [routineExerciseNames, setRoutineExerciseNames] = useState<string[]>(['']);
```

In the data-loading `useEffect`, add: `listWorkoutRoutines(uid).then(setRoutines).catch(handleError);`

Add handlers (near `handleSave`):

```typescript
  async function handleAddRoutine(e: FormEvent) {
    e.preventDefault();
    const exerciseNames = routineExerciseNames.map((n) => n.trim()).filter(Boolean);
    if (!routineName.trim() || exerciseNames.length === 0) return;
    const routine: WorkoutRoutine = {
      id: crypto.randomUUID(),
      name: routineName.trim(),
      exercises: exerciseNames.map((name) => ({ id: crypto.randomUUID(), name })),
      cadence: routineCadence,
      ...(routineCadence === 'weekly' ? { weeklyDays: routineWeeklyDays } : {}),
    };
    await saveWorkoutRoutine(uid, routine);
    setRoutines((prev) => [...prev, routine]);
    setRoutineName('');
    setRoutineCadence('daily');
    setRoutineWeeklyDays([]);
    setRoutineExerciseNames(['']);
  }

  async function handleRemoveRoutine(routineId: string) {
    await deleteWorkoutRoutine(uid, routineId);
    setRoutines((prev) => prev.filter((r) => r.id !== routineId));
  }
```

In `handleSave`, right after `setEntries((prev) => [{ id, ...session }, ...prev]);`, add the due-routine completion sweep:

```typescript
    const today = todayId();
    const dow = dayOfWeek(today);
    const dueRoutines = routines.filter((r) => isWorkoutRoutineDueToday(r, dow) && r.lastCompletedDate !== today);
    for (const routine of dueRoutines) {
      const updated = { ...routine, ...applyCompletion(routine, today) };
      await saveWorkoutRoutine(uid, updated);
      setRoutines((prev) => prev.map((r) => (r.id === routine.id ? updated : r)));
    }
```

In the JSX, add a "Routines" section above the existing `<form id="workout-form" ...>`:

```tsx
      <section id="workout-routines" className="flex flex-col gap-3">
        <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted">Routines</p>
        <ul className="flex flex-col gap-2">
          {routines.map((routine) => {
            const dueToday = isWorkoutRoutineDueToday(routine, dayOfWeek(todayId()));
            return (
              <li key={routine.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
                <span className="text-sm flex-1">
                  {routine.name} — {routine.exercises.map((ex) => ex.name).join(', ')}
                </span>
                <span className="font-mono text-xs text-muted">
                  {routine.cadence === 'daily' ? 'Daily' : weekdaySummary(routine.weeklyDays)}
                </span>
                <span className="font-mono text-xs text-muted">
                  🔥{routine.currentStreak ?? 0} · {routine.points ?? 0} pts
                </span>
                {dueToday && <span className="font-mono text-xs text-primary">Due today</span>}
                <button
                  type="button"
                  onClick={() => handleRemoveRoutine(routine.id)}
                  className="text-xs text-muted hover:text-ink"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <form id="routine-form" onSubmit={handleAddRoutine} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Routine name (e.g. Push Day)"
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            className={fieldClass}
          />
          {routineExerciseNames.map((name, i) => (
            <input
              key={i}
              type="text"
              placeholder="Exercise name"
              value={name}
              onChange={(e) =>
                setRoutineExerciseNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
              }
              className={fieldClass}
            />
          ))}
          <button
            type="button"
            onClick={() => setRoutineExerciseNames((prev) => [...prev, ''])}
            className="text-sm text-primary self-start"
          >
            Add exercise
          </button>
          <select
            value={routineCadence}
            onChange={(e) => setRoutineCadence(e.target.value as 'daily' | 'weekly')}
            className={fieldClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Specific weekdays</option>
          </select>
          {routineCadence === 'weekly' && (
            <WeekdayPicker value={routineWeeklyDays} onChange={setRoutineWeeklyDays} />
          )}
          <button type="submit" className={buttonClass}>
            Add routine
          </button>
        </form>
      </section>
      <hr className="border-line" />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/domains/workout/WorkoutScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/workout/WorkoutScreen.tsx src/domains/workout/WorkoutScreen.test.tsx
git commit -m "feat: add weekday-recurring workout routines to WorkoutScreen"
```

---

### Task 7: Learning plans API

**Files:**
- Create: `src/domains/learning/learningPlansApi.ts`
- Create: `src/domains/learning/learningPlansApi.test.ts`

**Interfaces:**
- Consumes: `LearningPlan` from Task 1.
- Produces: `listLearningPlans(uid): Promise<LearningPlan[]>`, `saveLearningPlan(uid, plan): Promise<void>`, `deleteLearningPlan(uid, id): Promise<void>`, `isLearningPlanDueToday(plan, dow): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/domains/learning/learningPlansApi.test.ts` (identical structure to Task 5's test, substituting `LearningPlan { id, topic, cadence, weeklyDays }` for `WorkoutRoutine`, and collection `learningPlans`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LearningPlan } from '../shared/types';

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

import { listLearningPlans, saveLearningPlan, deleteLearningPlan, isLearningPlanDueToday } from './learningPlansApi';

describe('isLearningPlanDueToday', () => {
  it('is always due for daily plans', () => {
    const plan: LearningPlan = { id: 'l1', topic: 'Spanish', cadence: 'daily' };
    expect(isLearningPlanDueToday(plan, 3)).toBe(true);
  });

  it('is due only on matching weekly days', () => {
    const plan: LearningPlan = { id: 'l2', topic: 'Guitar', cadence: 'weekly', weeklyDays: [1, 3, 5] };
    expect(isLearningPlanDueToday(plan, 3)).toBe(true);
    expect(isLearningPlanDueToday(plan, 2)).toBe(false);
  });
});

describe('learningPlansApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listLearningPlans maps Firestore docs to LearningPlan objects, defaulting points/currentStreak', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'l1', data: () => ({ topic: 'Spanish', cadence: 'weekly', weeklyDays: [1, 3, 5] }) }],
    });
    const result = await listLearningPlans('user1');
    expect(result).toEqual([
      { id: 'l1', topic: 'Spanish', cadence: 'weekly', weeklyDays: [1, 3, 5], points: 0, currentStreak: 0 },
    ]);
  });

  it('saveLearningPlan writes the plan fields', async () => {
    const plan: LearningPlan = { id: 'l1', topic: 'Spanish', cadence: 'weekly', weeklyDays: [1, 3, 5] };
    await saveLearningPlan('user1', plan);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      topic: 'Spanish',
      cadence: 'weekly',
      weeklyDays: [1, 3, 5],
      points: 0,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('deleteLearningPlan removes the plan doc', async () => {
    await deleteLearningPlan('user1', 'l1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/learning/learningPlansApi.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `learningPlansApi.ts`**

Create `src/domains/learning/learningPlansApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LearningPlan } from '../shared/types';

export async function listLearningPlans(uid: string): Promise<LearningPlan[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'learningPlans'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<LearningPlan, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveLearningPlan(uid: string, plan: LearningPlan): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'learningPlans', plan.id), {
    topic: plan.topic,
    cadence: plan.cadence,
    weeklyDays: plan.weeklyDays ?? null,
    points: plan.points ?? 0,
    currentStreak: plan.currentStreak ?? 0,
    lastCompletedDate: plan.lastCompletedDate ?? null,
  });
}

export async function deleteLearningPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'learningPlans', planId));
}

export function isLearningPlanDueToday(plan: LearningPlan, dow: number): boolean {
  if (plan.cadence === 'daily') return true;
  return plan.weeklyDays?.includes(dow) ?? false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/learning/learningPlansApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/learning/learningPlansApi.ts src/domains/learning/learningPlansApi.test.ts
git commit -m "feat: add learning plans CRUD API"
```

---

### Task 8: LearningScreen — plans section + completion wiring

**Files:**
- Modify: `src/domains/learning/LearningScreen.tsx`
- Modify: `src/domains/learning/LearningScreen.test.tsx`

**Interfaces:**
- Consumes: `listLearningPlans`, `saveLearningPlan`, `deleteLearningPlan`, `isLearningPlanDueToday` from Task 7; `WeekdayPicker`, `weekdaySummary` from Task 4; `applyCompletion` from Task 1.

- [ ] **Step 1: Inspect the existing test file's mock style**

Run: `cat src/domains/learning/LearningScreen.test.tsx`

- [ ] **Step 2: Add plan-related mocks and tests to `LearningScreen.test.tsx`**

Following the same structure as Task 6 Step 2, add a `vi.mock('./learningPlansApi', ...)` block and two tests: adding a plan with a weekday picker, and logging an entry today awarding a streak point to a due plan (asserting `mockSaveLearningPlan` was called with `expect.objectContaining({ id: <planId>, points: 1, currentStreak: 1 })`).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/domains/learning/LearningScreen.test.tsx`
Expected: FAIL

- [ ] **Step 4: Add the plans section and completion wiring to `LearningScreen.tsx`**

Add imports:

```typescript
import {
  listLearningPlans,
  saveLearningPlan,
  deleteLearningPlan,
  isLearningPlanDueToday,
} from './learningPlansApi';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { LearningPlan } from '../shared/types';
import { dayOfWeek } from '../shared/dateUtils';
```

Add state:

```typescript
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [planTopic, setPlanTopic] = useState('');
  const [planCadence, setPlanCadence] = useState<'daily' | 'weekly'>('daily');
  const [planWeeklyDays, setPlanWeeklyDays] = useState<number[]>([]);
```

In the data-loading `useEffect`: `listLearningPlans(uid).then(setPlans).catch(handleError);`

Add handlers:

```typescript
  async function handleAddPlan(e: FormEvent) {
    e.preventDefault();
    if (!planTopic.trim()) return;
    const plan: LearningPlan = {
      id: crypto.randomUUID(),
      topic: planTopic.trim(),
      cadence: planCadence,
      ...(planCadence === 'weekly' ? { weeklyDays: planWeeklyDays } : {}),
    };
    await saveLearningPlan(uid, plan);
    setPlans((prev) => [...prev, plan]);
    setPlanTopic('');
    setPlanCadence('daily');
    setPlanWeeklyDays([]);
  }

  async function handleRemovePlan(planId: string) {
    await deleteLearningPlan(uid, planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }
```

In `handleAddEntry`, right after `setEntries((prev) => [{ id, ...entry }, ...prev]);`, add the same due-plan sweep pattern as Task 6 Step 4, substituting `plans`/`isLearningPlanDueToday`/`saveLearningPlan`/`setPlans`.

In the JSX, add a "Plans" section above the existing `<form id="learning-form" ...>` following the same list/add-form structure as Task 6's routines section, but with a plain topic `<input placeholder="Topic (e.g. Spanish)">` instead of the exercise sub-form (no per-item exercises for Learning).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/domains/learning/LearningScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domains/learning/LearningScreen.tsx src/domains/learning/LearningScreen.test.tsx
git commit -m "feat: add weekday-recurring learning plans to LearningScreen"
```

---

### Task 9: Health plans API

**Files:**
- Create: `src/domains/health/healthPlansApi.ts`
- Create: `src/domains/health/healthPlansApi.test.ts`

**Interfaces:**
- Consumes: `HealthPlan` from Task 1.
- Produces: `listHealthPlans(uid): Promise<HealthPlan[]>`, `saveHealthPlan(uid, plan): Promise<void>`, `deleteHealthPlan(uid, id): Promise<void>`, `isHealthPlanDueToday(plan, dow): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/domains/health/healthPlansApi.test.ts`, structured exactly like Task 7 Step 1's test but for `HealthPlan { id, label, cadence, weeklyDays }`, collection `healthPlans`, function names `listHealthPlans`/`saveHealthPlan`/`deleteHealthPlan`/`isHealthPlanDueToday`, and a fixture like `{ id: 'h1', label: 'Weigh-in', cadence: 'weekly', weeklyDays: [1, 4] }`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/health/healthPlansApi.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `healthPlansApi.ts`**

Create `src/domains/health/healthPlansApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { HealthPlan } from '../shared/types';

export async function listHealthPlans(uid: string): Promise<HealthPlan[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'healthPlans'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<HealthPlan, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveHealthPlan(uid: string, plan: HealthPlan): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'healthPlans', plan.id), {
    label: plan.label,
    cadence: plan.cadence,
    weeklyDays: plan.weeklyDays ?? null,
    points: plan.points ?? 0,
    currentStreak: plan.currentStreak ?? 0,
    lastCompletedDate: plan.lastCompletedDate ?? null,
  });
}

export async function deleteHealthPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'healthPlans', planId));
}

export function isHealthPlanDueToday(plan: HealthPlan, dow: number): boolean {
  if (plan.cadence === 'daily') return true;
  return plan.weeklyDays?.includes(dow) ?? false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/health/healthPlansApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/health/healthPlansApi.ts src/domains/health/healthPlansApi.test.ts
git commit -m "feat: add health plans CRUD API"
```

---

### Task 10: HealthScreen — plans section + completion wiring

**Files:**
- Modify: `src/domains/health/HealthScreen.tsx`
- Modify: `src/domains/health/HealthScreen.test.tsx`

**Interfaces:**
- Consumes: `listHealthPlans`, `saveHealthPlan`, `deleteHealthPlan`, `isHealthPlanDueToday` from Task 9; `WeekdayPicker`, `weekdaySummary` from Task 4; `applyCompletion` from Task 1.

- [ ] **Step 1: Inspect the existing test file's mock style**

Run: `cat src/domains/health/HealthScreen.test.tsx`

- [ ] **Step 2: Add plan-related mocks and tests to `HealthScreen.test.tsx`**

Add a `vi.mock('./healthPlansApi', ...)` block and two tests: adding a plan with a weekday picker (label `"Weigh-in"`), and saving a sleep log OR logging a weight entry today (either counts, per the "any log entry" rule) awarding a streak point to a due plan.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/domains/health/HealthScreen.test.tsx`
Expected: FAIL

- [ ] **Step 4: Add the plans section and completion wiring to `HealthScreen.tsx`**

Add imports:

```typescript
import { listHealthPlans, saveHealthPlan, deleteHealthPlan, isHealthPlanDueToday } from './healthPlansApi';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { HealthPlan } from '../shared/types';
import { dayOfWeek } from '../shared/dateUtils';
```

Add state and a shared helper for the due-plan sweep, since both `handleSaveSleep` and `handleAddWeight` are "log entry today" events for this page:

```typescript
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [planLabel, setPlanLabel] = useState('');
  const [planCadence, setPlanCadence] = useState<'daily' | 'weekly'>('daily');
  const [planWeeklyDays, setPlanWeeklyDays] = useState<number[]>([]);

  async function completeDuePlansToday() {
    const today = todayId();
    const dow = dayOfWeek(today);
    const duePlans = plans.filter((p) => isHealthPlanDueToday(p, dow) && p.lastCompletedDate !== today);
    for (const plan of duePlans) {
      const updated = { ...plan, ...applyCompletion(plan, today) };
      await saveHealthPlan(uid, updated);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    }
  }
```

In the data-loading `useEffect`: `listHealthPlans(uid).then(setPlans).catch(handleError);`

At the end of both `handleSaveSleep` and `handleAddWeight` (after their existing state updates), add: `await completeDuePlansToday();`

Add `handleAddPlan`/`handleRemovePlan` handlers identical in shape to Task 8's, using `HealthPlan`/`planLabel`/`saveHealthPlan`/`deleteHealthPlan`.

In the JSX, add a "Plans" section (list + add form with a `planLabel` text input placeholder `"Check-in label (e.g. Weigh-in)"`, cadence select, `WeekdayPicker`) above the existing `<section id="health-sleep">`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/domains/health/HealthScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domains/health/HealthScreen.tsx src/domains/health/HealthScreen.test.tsx
git commit -m "feat: add weekday-recurring health plans to HealthScreen"
```

---

### Task 11: Meal plans API

**Files:**
- Create: `src/domains/meals/mealPlansApi.ts`
- Create: `src/domains/meals/mealPlansApi.test.ts`

**Interfaces:**
- Consumes: `MealPlan` from Task 1.
- Produces: `listMealPlans(uid): Promise<MealPlan[]>`, `saveMealPlan(uid, plan): Promise<void>`, `deleteMealPlan(uid, id): Promise<void>`, `isMealPlanDueToday(plan, dow): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/domains/meals/mealPlansApi.test.ts`, structured like Task 9's test but for `MealPlan { id, name, meal, cadence, weeklyDays }`, collection `mealPlans`, function names `listMealPlans`/`saveMealPlan`/`deleteMealPlan`/`isMealPlanDueToday`, and a fixture like `{ id: 'm1', name: 'Grilled chicken', meal: 'dinner', cadence: 'weekly', weeklyDays: [2, 4] }`. The `saveMealPlan` write-shape test must include `meal: 'dinner'` in the expected written object.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/meals/mealPlansApi.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `mealPlansApi.ts`**

Create `src/domains/meals/mealPlansApi.ts`:

```typescript
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MealPlan } from '../shared/types';

export async function listMealPlans(uid: string): Promise<MealPlan[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'mealPlans'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<MealPlan, 'id'>;
    return { id: d.id, ...data, points: data.points ?? 0, currentStreak: data.currentStreak ?? 0 };
  });
}

export async function saveMealPlan(uid: string, plan: MealPlan): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'mealPlans', plan.id), {
    name: plan.name,
    meal: plan.meal,
    cadence: plan.cadence,
    weeklyDays: plan.weeklyDays ?? null,
    points: plan.points ?? 0,
    currentStreak: plan.currentStreak ?? 0,
    lastCompletedDate: plan.lastCompletedDate ?? null,
  });
}

export async function deleteMealPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'mealPlans', planId));
}

export function isMealPlanDueToday(plan: MealPlan, dow: number): boolean {
  if (plan.cadence === 'daily') return true;
  return plan.weeklyDays?.includes(dow) ?? false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/meals/mealPlansApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/meals/mealPlansApi.ts src/domains/meals/mealPlansApi.test.ts
git commit -m "feat: add meal plans CRUD API"
```

---

### Task 12: MealsScreen — meal plans section + completion wiring

**Files:**
- Modify: `src/domains/meals/MealsScreen.tsx`
- Modify: `src/domains/meals/MealsScreen.test.tsx`

**Interfaces:**
- Consumes: `listMealPlans`, `saveMealPlan`, `deleteMealPlan`, `isMealPlanDueToday` from Task 11; `WeekdayPicker`, `weekdaySummary` from Task 4; `applyCompletion` from Task 1.

- [ ] **Step 1: Add plan-related mocks and tests to `MealsScreen.test.tsx`**

Add a `vi.mock('./mealPlansApi', ...)` block and two tests: adding a meal plan (name + meal-type select + weekday picker), and adding a meal log entry today awarding a streak point to a due plan.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/meals/MealsScreen.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add the meal plans section and completion wiring to `MealsScreen.tsx`**

Add imports:

```typescript
import { listMealPlans, saveMealPlan, deleteMealPlan, isMealPlanDueToday } from './mealPlansApi';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { MealPlan } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
```

Add state:

```typescript
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [planName, setPlanName] = useState('');
  const [planMeal, setPlanMeal] = useState<MealPlan['meal']>('dinner');
  const [planCadence, setPlanCadence] = useState<'daily' | 'weekly'>('daily');
  const [planWeeklyDays, setPlanWeeklyDays] = useState<number[]>([]);
```

In the data-loading `useEffect`: `listMealPlans(uid).then(setPlans).catch(handleError);`

Add handlers:

```typescript
  async function handleAddPlan(e: FormEvent) {
    e.preventDefault();
    if (!planName.trim()) return;
    const plan: MealPlan = {
      id: crypto.randomUUID(),
      name: planName.trim(),
      meal: planMeal,
      cadence: planCadence,
      ...(planCadence === 'weekly' ? { weeklyDays: planWeeklyDays } : {}),
    };
    await saveMealPlan(uid, plan);
    setPlans((prev) => [...prev, plan]);
    setPlanName('');
    setPlanMeal('dinner');
    setPlanCadence('daily');
    setPlanWeeklyDays([]);
  }

  async function handleRemovePlan(planId: string) {
    await deleteMealPlan(uid, planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }
```

In `handleAddMealEntry`, right after `setMealLog((prev) => ...)`, add the due-plan sweep (same pattern as Task 6 Step 4, using `todayId()`/`dayOfWeek`/`plans`/`isMealPlanDueToday`/`saveMealPlan`/`setPlans`).

In the JSX, add a "Meal plans" section (list showing `name`, `meal` type, cadence summary, streak/points badge, due-today badge, remove button; add form with name input, a `<select>` for `meal` with options `breakfast`/`lunch`/`dinner`/`snack`, cadence select, `WeekdayPicker`) above the existing `<section id="meals-grocery">`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/meals/MealsScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domains/meals/MealsScreen.tsx src/domains/meals/MealsScreen.test.tsx
git commit -m "feat: add weekday-recurring meal plans to MealsScreen"
```

---

### Task 13: Dashboard aggregation — due items for the 4 new domains + `computeDayHealth` extension

**Files:**
- Modify: `src/dashboard/dashboardLogic.ts`
- Modify: `src/dashboard/dashboardLogic.test.ts`

**Interfaces:**
- Consumes: `isWorkoutRoutineDueToday`, `isLearningPlanDueToday`, `isHealthPlanDueToday`, `isMealPlanDueToday` from Tasks 5/7/9/11; `WorkoutRoutine`, `LearningPlan`, `HealthPlan`, `MealPlan` from Task 1.
- Produces: `computeWorkoutDueItems(routines: WorkoutRoutine[], hasLoggedToday: boolean, dow: number): DueItem[]`, `computeLearningPlanDueItems(plans: LearningPlan[], hasLoggedToday: boolean, dow: number): DueItem[]`, `computeHealthPlanDueItems(plans: HealthPlan[], hasLoggedToday: boolean, dow: number): DueItem[]`, `computeMealPlanDueItems(plans: MealPlan[], hasLoggedToday: boolean, dow: number): DueItem[]`. `computeDayHealth`'s signature gains a 4th parameter: `dueTodayPlanDomains: { domain: string; ids: string[]; done: boolean }[] = []`.

- [ ] **Step 1: Write the failing tests**

Append to `src/dashboard/dashboardLogic.test.ts`, adding the new imports at the top (`computeWorkoutDueItems, computeLearningPlanDueItems, computeHealthPlanDueItems, computeMealPlanDueItems`) and these `describe` blocks:

```typescript
import { WorkoutRoutine, LearningPlan, HealthPlan, MealPlan } from '../domains/shared/types';

describe('computeWorkoutDueItems', () => {
  const routines: WorkoutRoutine[] = [
    { id: 'w1', name: 'Push Day', exercises: [], cadence: 'weekly', weeklyDays: [1] },
  ];

  it('lists a due routine when nothing has been logged today', () => {
    expect(computeWorkoutDueItems(routines, false, 1)).toEqual([
      { id: 'w1', label: 'Push Day', domain: 'workout' },
    ]);
  });

  it('returns nothing once something has been logged today', () => {
    expect(computeWorkoutDueItems(routines, true, 1)).toEqual([]);
  });

  it('returns nothing when no routine is due today', () => {
    expect(computeWorkoutDueItems(routines, false, 2)).toEqual([]);
  });
});

describe('computeLearningPlanDueItems', () => {
  it('lists a due plan when nothing has been logged today', () => {
    const plans: LearningPlan[] = [{ id: 'l1', topic: 'Spanish', cadence: 'daily' }];
    expect(computeLearningPlanDueItems(plans, false, 3)).toEqual([
      { id: 'l1', label: 'Spanish', domain: 'learning' },
    ]);
  });
});

describe('computeHealthPlanDueItems', () => {
  it('lists a due plan when nothing has been logged today', () => {
    const plans: HealthPlan[] = [{ id: 'h1', label: 'Weigh-in', cadence: 'daily' }];
    expect(computeHealthPlanDueItems(plans, false, 3)).toEqual([
      { id: 'h1', label: 'Weigh-in', domain: 'health' },
    ]);
  });
});

describe('computeMealPlanDueItems', () => {
  it('lists a due plan when nothing has been logged today', () => {
    const plans: MealPlan[] = [{ id: 'm1', name: 'Grilled chicken', meal: 'dinner', cadence: 'daily' }];
    expect(computeMealPlanDueItems(plans, false, 3)).toEqual([
      { id: 'm1', label: 'Grilled chicken', domain: 'meals' },
    ]);
  });
});
```

Update the existing `computeDayHealth` `describe` block, adding a test for the new 4th param:

```typescript
  it('folds a fully-completed new-domain due list into the task count', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: {},
    };
    // 2 base + 1 workout-routine domain (done) = 3 tasks, all done = 100%
    expect(
      computeDayHealth(completion, [], [], [{ domain: 'workout', ids: ['w1'], done: true }])
    ).toBe(100);
  });

  it('counts an undone new-domain due list as not done', () => {
    const completion: DailyCompletion = {
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: {},
      reminders: {},
    };
    // 2 base + 1 workout-routine domain (not done) = 3 tasks, 2 done = 67%
    expect(
      computeDayHealth(completion, [], [], [{ domain: 'workout', ids: ['w1'], done: false }])
    ).toBe(67);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: FAIL — the new functions and `computeDayHealth` parameter don't exist yet.

- [ ] **Step 3: Implement the changes in `dashboardLogic.ts`**

Add these imports at the top of `src/dashboard/dashboardLogic.ts`:

```typescript
import { WorkoutRoutine, LearningPlan, HealthPlan, MealPlan } from '../domains/shared/types';
import { isWorkoutRoutineDueToday } from '../domains/workout/workoutRoutinesApi';
import { isLearningPlanDueToday } from '../domains/learning/learningPlansApi';
import { isHealthPlanDueToday } from '../domains/health/healthPlansApi';
import { isMealPlanDueToday } from '../domains/meals/mealPlansApi';
```

Add these functions (after `computeReminderDueItems`):

```typescript
export function computeWorkoutDueItems(routines: WorkoutRoutine[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return routines
    .filter((r) => isWorkoutRoutineDueToday(r, dow))
    .map((r) => ({ id: r.id, label: r.name, domain: 'workout' as const }));
}

export function computeLearningPlanDueItems(plans: LearningPlan[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return plans
    .filter((p) => isLearningPlanDueToday(p, dow))
    .map((p) => ({ id: p.id, label: p.topic, domain: 'learning' as const }));
}

export function computeHealthPlanDueItems(plans: HealthPlan[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return plans
    .filter((p) => isHealthPlanDueToday(p, dow))
    .map((p) => ({ id: p.id, label: p.label, domain: 'health' as const }));
}

export function computeMealPlanDueItems(plans: MealPlan[], hasLoggedToday: boolean, dow: number): DueItem[] {
  if (hasLoggedToday) return [];
  return plans
    .filter((p) => isMealPlanDueToday(p, dow))
    .map((p) => ({ id: p.id, label: p.name, domain: 'meals' as const }));
}
```

Replace `computeDayHealth`:

```typescript
export function computeDayHealth(
  completion: DailyCompletion,
  dueTodayChoreIds: string[],
  dueTodayReminderIds: string[] = [],
  dueTodayPlanDomains: { domain: string; ids: string[]; done: boolean }[] = []
): number {
  const planTaskCount = dueTodayPlanDomains.reduce((sum, d) => sum + d.ids.length, 0);
  const planDoneCount = dueTodayPlanDomains.reduce((sum, d) => sum + (d.done ? d.ids.length : 0), 0);
  const totalTasks = 2 + dueTodayChoreIds.length + dueTodayReminderIds.length + planTaskCount;
  const doneTasks =
    (completion.workout ? 1 : 0) +
    (completion.learning ? 1 : 0) +
    dueTodayChoreIds.filter((id) => completion.chores[id]).length +
    dueTodayReminderIds.filter((id) => completion.reminders[id]).length +
    planDoneCount;
  return totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
}
```

Note: `computeDayHealthHistory` is unchanged — it stays scoped to chores/reminders, since the 4 new plan domains' "done" state depends on per-page log lists that `computeDayHealthHistory`'s current inputs (`history: DailyCompletion[]`) don't carry. Extending historical day-health for the new domains is out of scope (see the spec's "Out of scope" section).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/dashboardLogic.ts src/dashboard/dashboardLogic.test.ts
git commit -m "feat: fold workout/learning/health/meal plans into dashboard due items and day health"
```

---

### Task 14: `useDashboardData` — fetch and wire the 4 new domains

**Files:**
- Modify: `src/dashboard/useDashboardData.ts`
- Find and modify: `src/dashboard/useDashboardData.test.ts` (inspect it first; it isn't shown above)

**Interfaces:**
- Consumes: `listWorkoutRoutines`/`listWorkoutLogEntries`, `listLearningPlans`/`listLearningLogEntries`, `listHealthPlans`/`getSleepLog`+`listWeightEntries`, `listMealPlans`/`getMealLog`; `computeWorkoutDueItems`, `computeLearningPlanDueItems`, `computeHealthPlanDueItems`, `computeMealPlanDueItems`, updated `computeDayHealth` from Task 13.
- Produces: `DashboardData` gains `dueTodayPlanDomains: { domain: string; ids: string[]; done: boolean }[]` (or the 4 individual plan lists, whichever the existing consumers of `DashboardData` — check `Dashboard.tsx` — most naturally need; keep `dueItems` as the single list every consumer already renders generically via `DueNowStrip`, per the existing pattern noted in the custom-reminders spec).

- [ ] **Step 1: Read `useDashboardData.test.ts` and `Dashboard.tsx` to confirm the exact `DashboardData` consumption pattern**

Run: `cat src/dashboard/useDashboardData.test.ts src/dashboard/Dashboard.tsx`

Confirm: does `Dashboard.tsx` read any `DashboardData` fields besides `dueItems`, `dayHealth`, `streak`, `healthHistory`, and the raw per-domain lists (`chores`, `reminders`, etc.) already listed in the current interface? This determines whether the 4 new plan lists (`workoutRoutines`, `learningPlans`, `healthPlans`, `mealPlans`) need to be added to `DashboardData`'s public shape or are purely internal to the hook's due-item computation.

- [ ] **Step 2: Add a failing test to `useDashboardData.test.ts`**

Following that file's existing mock style (mock every new API module: `./domains/workout/workoutRoutinesApi`, `./domains/workout/workoutApi`'s `listWorkoutLogEntries`, `./domains/learning/learningPlansApi`, `./domains/learning/learningApi`'s `listLearningLogEntries`, `./domains/health/healthPlansApi`, `./domains/health/weightApi`'s `listWeightEntries`, `./domains/meals/mealPlansApi`, `./domains/meals/mealLogApi`'s `getMealLog`), add a test asserting that a due-today workout routine with no workout log entry dated today appears in `dueItems`, and disappears when a log entry dated today is present.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement the wiring in `useDashboardData.ts`**

Add imports:

```typescript
import { listWorkoutRoutines, isWorkoutRoutineDueToday } from '../domains/workout/workoutRoutinesApi';
import { listWorkoutLogEntries } from '../domains/workout/workoutApi';
import { listLearningPlans } from '../domains/learning/learningPlansApi';
import { listLearningLogEntries } from '../domains/learning/learningApi';
import { listHealthPlans } from '../domains/health/healthPlansApi';
import { listWeightEntries } from '../domains/health/weightApi';
import { listMealPlans } from '../domains/meals/mealPlansApi';
import { getMealLog } from '../domains/meals/mealLogApi';
import { WorkoutRoutine, LearningPlan, HealthPlan, MealPlan, WorkoutLogEntry, LearningLogEntry } from '../domains/shared/types';
import {
  computeWorkoutDueItems,
  computeLearningPlanDueItems,
  computeHealthPlanDueItems,
  computeMealPlanDueItems,
} from './dashboardLogic';
```

Add state for the 4 plan lists and their log lists:

```typescript
  const [workoutRoutines, setWorkoutRoutines] = useState<WorkoutRoutine[]>([]);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutLogEntry[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [learningEntries, setLearningEntries] = useState<LearningLogEntry[]>([]);
  const [healthPlans, setHealthPlans] = useState<HealthPlan[]>([]);
  const [weightEntryDates, setWeightEntryDates] = useState<string[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [mealLogHasToday, setMealLogHasToday] = useState(false);
```

In the `Promise.all([...])` call, add the 8 new fetches (`listWorkoutRoutines(uid)`, `listWorkoutLogEntries(uid)`, `listLearningPlans(uid)`, `listLearningLogEntries(uid)`, `listHealthPlans(uid)`, `listWeightEntries(uid)`, `listMealPlans(uid)`, `getMealLog(uid)`), destructure them in the `.then(...)` callback, and set the corresponding state (for `weightEntryDates`, map the weight entries to `.map((w) => w.date)`; for `mealLogHasToday`, compute `mealLog.entries.length > 0` — note `getMealLog` already scopes to today's doc via its default `date = todayId()` parameter, so any entries present means something was logged today).

In the "no completion yet" early-return object, add the corresponding empty defaults (`workoutRoutines: []`, etc. — or omit the 4 lists entirely from `DashboardData` if Step 1 found they're not needed externally, keeping this hook's job purely to fold them into `dueItems`/`dayHealth`).

After the existing `dueTodayReminderIds` line, compute:

```typescript
  const hasLoggedWorkoutToday = workoutEntries.some((e) => e.date === todayId());
  const hasLoggedLearningToday = learningEntries.some((e) => e.date === todayId());
  // Note: getSleepLog always returns an object stamped with today's date even when
  // nothing was saved (it defaults bedtime/wakeTime to ''), so `sleepLog.date` alone
  // can't signal whether today's sleep was actually logged — check the fields instead.
  const hasLoggedHealthToday =
    weightEntryDates.includes(todayId()) || Boolean(sleepLog?.bedtime && sleepLog?.wakeTime);
  const dueTodayWorkoutIds = workoutRoutines.filter((r) => isWorkoutRoutineDueToday(r, dow)).map((r) => r.id);
  const dueTodayLearningPlanIds = learningPlans.filter((p) => isLearningPlanDueToday(p, dow)).map((p) => p.id);
  const dueTodayHealthPlanIds = healthPlans.filter((p) => isHealthPlanDueToday(p, dow)).map((p) => p.id);
  const dueTodayMealPlanIds = mealPlans.filter((p) => isMealPlanDueToday(p, dow)).map((p) => p.id);
  const dueTodayPlanDomains = [
    { domain: 'workout', ids: dueTodayWorkoutIds, done: hasLoggedWorkoutToday },
    { domain: 'learning', ids: dueTodayLearningPlanIds, done: hasLoggedLearningToday },
    { domain: 'health', ids: dueTodayHealthPlanIds, done: hasLoggedHealthToday },
    { domain: 'meals', ids: dueTodayMealPlanIds, done: mealLogHasToday },
  ];
```

(This duplicates each plan-list's `isXDueToday` filter that also runs inside `computeXDueItems` — matching the existing pattern where `useDashboardData` already independently computes `dueTodayChoreIds`/`dueTodayReminderIds` via the same `isChoreDueToday`/`isCustomReminderDueToday` filters used inside `computeDueItems`/`computeReminderDueItems`.)

Extend `dueItems`:

```typescript
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeReminderDueItems(reminders, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
    ...computeWeeklyReviewDueItem(dow, weeklyReview),
    ...computeWorkoutDueItems(workoutRoutines, hasLoggedWorkoutToday, dow),
    ...computeLearningPlanDueItems(learningPlans, hasLoggedLearningToday, dow),
    ...computeHealthPlanDueItems(healthPlans, hasLoggedHealthToday, dow),
    ...computeMealPlanDueItems(mealPlans, mealLogHasToday, dow),
  ];
```

Update the `computeDayHealth` call to pass the 4th argument: `computeDayHealth(completion, dueTodayChoreIds, dueTodayReminderIds, dueTodayPlanDomains)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors anywhere in the project

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/useDashboardData.ts src/dashboard/useDashboardData.test.ts
git commit -m "feat: fold workout/learning/health/meal plans into dashboard data"
```

---

## Final verification

- [ ] Run `npx vitest run` — full suite passes.
- [ ] Run `npx tsc --noEmit` — no type errors.
- [ ] Run `npx eslint src` (or the project's configured lint script, if different — check `package.json`) — no new lint errors.
- [ ] Manually smoke-test in the browser (`npm run dev`): on Workout, Learning, Health, and Meals, add a weekly-recurring plan for today's weekday, confirm it shows "Due today", log an entry on that page, confirm the plan's streak/points badge increments and it drops off the dashboard's due list; confirm Chores/Reminders' streak badges increment when checked off.
