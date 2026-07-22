# Punch In — Phase 3: Sleep & Health + Goals & Journaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Sleep & Health domain (daily bedtime/wake-time log with computed sleep duration, periodic weight entries with a trend delta) and the Goals & Journaling domain (standing goals list with milestones, Sunday-evening structured weekly review) to Punch In, and wire both into the existing Dashboard (2 more status chips, bringing the total to 7) and due-now strip (a "weekly review due" flag on Sundays).

**Architecture:** Follows the exact pattern established in Phase 1/2 — one Firestore API module per concern, one screen component per domain, pure computation functions kept separate from I/O, all Firestore paths scoped under `users/{uid}/...`. The Dashboard gains two more status chips (Health, Goals) and the due-now strip gains one more due-item source (weekly review due on Sundays), extending the pure functions in `src/dashboard/dashboardLogic.ts` and the fetch/compose logic in `src/dashboard/useDashboardData.ts` rather than restructuring them.

**Tech Stack:** Same as Phase 1/2 — Vite, React 18, TypeScript, Tailwind CSS, react-router-dom, Firebase (Auth + Firestore) client SDK v9+ modular API, Vitest, React Testing Library. No new dependencies.

## Global Constraints

- All Firestore paths are scoped under `users/{uid}/...` — no top-level collections (per spec §2, §7). New collections this phase: `users/{uid}/sleepLogs`, `users/{uid}/weightEntries`, `users/{uid}/goals`, `users/{uid}/weeklyReviews`.
- Every new Firestore read must default missing/partial fields rather than trust the raw doc shape — this was established as a hard rule during Phase 2 (a raw-cast read caused a real defaulting gap that had to be fixed after the fact, and a second gap — a missing `Array.isArray` guard on an array-shaped field — was caught in Phase 2's final review). Apply defaulting from the start in every read added this phase, both `getDoc`- and `getDocs`-based: `??`/`typeof` guards for scalars, `Array.isArray(...) ? ... : []` for array fields, narrowing (`=== 'x' ? 'x' : fallback`) for string-literal unions.
- **Exception, by design:** `getWeeklyReview` returns `null` when no review doc exists for the given week — NOT a defaulted empty `WeeklyReview` object. This is deliberate: `isWeeklyReviewDue` needs to distinguish "no review recorded yet this week" (`null`) from "a review was started/saved" (a `WeeklyReview`, even one with empty strings). Do not "fix" this into the completions/mealLog-style always-return-a-default pattern — it would break the due-flag logic.
- No goal reordering/archiving/sub-projects — goals are a flat list with `status: 'active' | 'done'` and a flat `milestones` array (per spec §4, "Standing goals list with status/milestones" — no further structure implied or approved).
- No sleep-stage tracking, no integration with wearables — sleep is a manual bedtime/wake-time log only (per spec §4, "Log bedtime/wake time daily").
- No weight-goal-tracking UI beyond the trend delta between the two most recent entries — full historical charts are out of scope for this phase (per spec §4, "simple trend view").
- Reminder times, Settings UI, and Cloud Functions/push remain out of scope (Phase 5/6 per spec §8) — the weekly-review-due flag surfaces only in the Dashboard's due-now strip in this phase, not as a push notification.
- Test suite must remain at zero warnings (no React `act()` warnings, no console noise) and `npm run build` must succeed after every task — both hard bars carried over from Phase 1/2.
- Follow the established test-environment conventions: mock `../../firebase/config` (or `../firebase/config`, depending on file depth) in any test that transitively imports it — including tests that use `vi.importActual` on a sibling module that itself imports Firebase, or tests of components/hooks that transitively import a domain API module with a real Firebase import (see Phase 2 Tasks 5/10/11 for worked examples of this exact failure mode); type mock functions invoked via spread args as `vi.fn((..._args: unknown[]) => ...)` to satisfy `tsc`'s TS2556 check (`vitest` alone won't catch this — only `npm run build` will).
- `DomainKey` (in `src/domains/shared/types.ts`) gains two new members this phase: `'health'` and `'goals'`. Every existing usage is additive-only; no existing `DomainKey` value changes meaning.

---

## File Structure

```
src/domains/shared/types.ts       — MODIFY: extend DomainKey union, add SleepLog/WeightEntry/Goal/Milestone/WeeklyReview types
src/domains/shared/dateUtils.ts   — MODIFY: add weekId(dateId)
src/domains/health/
  sleepApi.ts                      — getSleepLog, saveSleepLog
  weightApi.ts                     — addWeightEntry, listWeightEntries
  healthLogic.ts                   — computeSleepDurationHours, computeWeightChange (pure)
  HealthScreen.tsx                 — bedtime/wake-time form + duration display, weight list + add-entry form + trend delta
src/domains/goals/
  goalsApi.ts                      — listGoals, saveGoal, deleteGoal
  weeklyReviewApi.ts               — getWeeklyReview, saveWeeklyReview
  goalsLogic.ts                    — computeMilestoneProgress, isWeeklyReviewDue (pure)
  GoalsScreen.tsx                  — goals list + milestone toggles + add-goal form; weekly review form (highlighted when due)
src/dashboard/dashboardLogic.ts   — MODIFY: add computeWeeklyReviewDueItem (pure)
src/dashboard/useDashboardData.ts — MODIFY: fetch sleepLog + goals + weeklyReview, merge into dueItems, return sleepLog/goals/weeklyReview
src/dashboard/Dashboard.tsx       — MODIFY: add Health + Goals status chips
src/App.tsx                       — MODIFY: add /health and /goals routes
```

---

### Task 1: Extend shared types and date utilities

**Files:**
- Modify: `src/domains/shared/types.ts`
- Modify: `src/domains/shared/dateUtils.ts`
- Test: `src/domains/shared/dateUtils.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `DomainKey`, `DueItem` already defined)
- Produces:
  - `types.ts`: `DomainKey` extended to `'workout' | 'learning' | 'chores' | 'finances' | 'meals' | 'health' | 'goals'`; `SleepLog { date: string; bedtime: string; wakeTime: string }`; `WeightEntry { id: string; date: string; weightKg: number }`; `Milestone { id: string; label: string; done: boolean }`; `Goal { id: string; title: string; targetDate: string; status: 'active' | 'done'; milestones: Milestone[] }`; `WeeklyReview { weekId: string; wentWell: string; wentBadly: string; focusNext: string }`
  - `dateUtils.ts`: `weekId(dateId: string): string` — returns the date id (`YYYY-MM-DD`) of the Sunday that starts the week containing `dateId`.

- [ ] **Step 1: Write the failing test for weekId**

Add to `src/domains/shared/dateUtils.test.ts` (append a new `describe` block after the existing `daysInMonth` block):

```ts
describe('weekId', () => {
  it('returns the same date when given a Sunday', () => {
    expect(weekId('2026-07-19')).toBe('2026-07-19');
  });

  it('returns the preceding Sunday for a mid-week date', () => {
    expect(weekId('2026-07-22')).toBe('2026-07-19');
  });

  it('returns the preceding Sunday even when it falls in the previous month', () => {
    expect(weekId('2026-08-01')).toBe('2026-07-26');
  });
});
```

Update the import line at the top of the file to include `weekId`:

```ts
import { todayId, dayOfWeek, dayOfMonth, daysInMonth, weekId } from './dateUtils';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/shared/dateUtils.test.ts`
Expected: FAIL — `weekId is not a function` (or similar, since it's not exported yet)

- [ ] **Step 3: Implement weekId**

Append to `src/domains/shared/dateUtils.ts`:

```ts
export function weekId(dateId: string): string {
  const d = new Date(`${dateId}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/shared/dateUtils.test.ts`
Expected: PASS (13 tests: 2 `todayId` + 2 `dayOfWeek` + 2 `dayOfMonth` + 4 `daysInMonth` + 3 new `weekId`)

- [ ] **Step 5: Extend the shared types (no test — pure type declarations)**

Replace the `DomainKey` line in `src/domains/shared/types.ts`:

```ts
export type DomainKey = 'workout' | 'learning' | 'chores' | 'finances' | 'meals' | 'health' | 'goals';
```

Append to the end of `src/domains/shared/types.ts`:

```ts
export interface SleepLog {
  date: string;
  bedtime: string;
  wakeTime: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export interface Milestone {
  id: string;
  label: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  targetDate: string;
  status: 'active' | 'done';
  milestones: Milestone[];
}

export interface WeeklyReview {
  weekId: string;
  wentWell: string;
  wentBadly: string;
  focusNext: string;
}
```

- [ ] **Step 6: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (all existing tests still pass — `DomainKey`'s new union members are additive)

- [ ] **Step 7: Commit**

```bash
git add src/domains/shared/types.ts src/domains/shared/dateUtils.ts src/domains/shared/dateUtils.test.ts
git commit -m "feat: add Health/Goals shared types and weekId util"
```

---

### Task 2: Sleep API and health pure logic

**Files:**
- Create: `src/domains/health/sleepApi.ts`
- Create: `src/domains/health/healthLogic.ts`
- Test: `src/domains/health/sleepApi.test.ts`
- Test: `src/domains/health/healthLogic.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `SleepLog` from `../shared/types`; `todayId` from `../shared/dateUtils`
- Produces: `getSleepLog(uid: string, date?: string): Promise<SleepLog>`, `saveSleepLog(uid: string, log: SleepLog): Promise<void>`; `computeSleepDurationHours(bedtime: string, wakeTime: string): number`

- [ ] **Step 1: Write the failing test for sleepApi**

Create `src/domains/health/sleepApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { getSleepLog, saveSleepLog } from './sleepApi';

describe('getSleepLog', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns empty bedtime/wakeTime when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getSleepLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', bedtime: '', wakeTime: '' });
  });

  it('defaults missing fields when the doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ bedtime: '23:00' }) });
    const result = await getSleepLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', bedtime: '23:00', wakeTime: '' });
  });

  it('returns the stored bedtime and wakeTime when present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ bedtime: '23:00', wakeTime: '07:00' }),
    });
    const result = await getSleepLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' });
  });
});

describe('saveSleepLog', () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
  });

  it('writes the date, bedtime, and wakeTime', async () => {
    await saveSleepLog('user1', { date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      bedtime: '23:00',
      wakeTime: '07:00',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/health/sleepApi.test.ts`
Expected: FAIL with "Cannot find module './sleepApi'"

- [ ] **Step 3: Implement sleepApi**

Create `src/domains/health/sleepApi.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { SleepLog } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function sleepLogDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'sleepLogs', date);
}

export async function getSleepLog(uid: string, date: string = todayId()): Promise<SleepLog> {
  const snap = await getDoc(sleepLogDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<SleepLog>) : {};
  return {
    date,
    bedtime: data.bedtime ?? '',
    wakeTime: data.wakeTime ?? '',
  };
}

export async function saveSleepLog(uid: string, log: SleepLog): Promise<void> {
  await setDoc(sleepLogDocRef(uid, log.date), {
    date: log.date,
    bedtime: log.bedtime,
    wakeTime: log.wakeTime,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/health/sleepApi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for healthLogic**

Create `src/domains/health/healthLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSleepDurationHours, computeWeightChange } from './healthLogic';
import { WeightEntry } from '../shared/types';

describe('computeSleepDurationHours', () => {
  it('computes duration for an overnight sleep (crosses midnight)', () => {
    expect(computeSleepDurationHours('23:00', '07:00')).toBe(8);
  });

  it('computes a fractional duration', () => {
    expect(computeSleepDurationHours('23:30', '07:00')).toBe(7.5);
  });

  it('computes duration when both times are after midnight and wake is later than bed', () => {
    expect(computeSleepDurationHours('01:00', '09:00')).toBe(8);
  });
});

describe('computeWeightChange', () => {
  it('returns null when there are fewer than 2 entries', () => {
    expect(computeWeightChange([])).toBeNull();
    const one: WeightEntry[] = [{ id: 'w1', date: '2026-07-20', weightKg: 70 }];
    expect(computeWeightChange(one)).toBeNull();
  });

  it('returns the delta between the two most recent entries (assumed most-recent-first)', () => {
    const entries: WeightEntry[] = [
      { id: 'w2', date: '2026-07-20', weightKg: 69.5 },
      { id: 'w1', date: '2026-07-13', weightKg: 70 },
    ];
    expect(computeWeightChange(entries)).toBe(-0.5);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/domains/health/healthLogic.test.ts`
Expected: FAIL with "Cannot find module './healthLogic'"

- [ ] **Step 7: Implement healthLogic**

Create `src/domains/health/healthLogic.ts`:

```ts
import { WeightEntry } from '../shared/types';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function computeSleepDurationHours(bedtime: string, wakeTime: string): number {
  const bedMinutes = toMinutes(bedtime);
  let wakeMinutes = toMinutes(wakeTime);
  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += 24 * 60;
  }
  const hours = (wakeMinutes - bedMinutes) / 60;
  return Math.round(hours * 10) / 10;
}

export function computeWeightChange(entries: WeightEntry[]): number | null {
  if (entries.length < 2) return null;
  return Math.round((entries[0].weightKg - entries[1].weightKg) * 10) / 10;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/domains/health/healthLogic.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Commit**

```bash
git add src/domains/health/sleepApi.ts src/domains/health/sleepApi.test.ts src/domains/health/healthLogic.ts src/domains/health/healthLogic.test.ts
git commit -m "feat: add sleep log Firestore API and health pure logic"
```

---

### Task 3: Weight API

**Files:**
- Create: `src/domains/health/weightApi.ts`
- Test: `src/domains/health/weightApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `WeightEntry` from `../shared/types`
- Produces: `addWeightEntry(uid: string, entry: Omit<WeightEntry, 'id'>): Promise<string>`, `listWeightEntries(uid: string): Promise<WeightEntry[]>` (ordered most-recent-first, matching `computeWeightChange`'s assumption)

- [ ] **Step 1: Write the failing test**

Create `src/domains/health/weightApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addWeightEntry, listWeightEntries } from './weightApi';

describe('weightApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addWeightEntry writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'w1' });
    const id = await addWeightEntry('user1', { date: '2026-07-20', weightKg: 70 });
    expect(id).toBe('w1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { date: '2026-07-20', weightKg: 70 });
  });

  it('listWeightEntries maps docs to WeightEntry objects, ordered by date descending', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'w1', data: () => ({ date: '2026-07-20', weightKg: 70 }) }],
    });
    const result = await listWeightEntries('user1');
    expect(result).toEqual([{ id: 'w1', date: '2026-07-20', weightKg: 70 }]);
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
  });

  it('defaults a missing or non-numeric weightKg to 0 and a missing date to empty string', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'w1', data: () => ({ date: '2026-07-20' }) },
        { id: 'w2', data: () => ({ weightKg: 'not-a-number' }) },
      ],
    });
    const result = await listWeightEntries('user1');
    expect(result).toEqual([
      { id: 'w1', date: '2026-07-20', weightKg: 0 },
      { id: 'w2', date: '', weightKg: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/health/weightApi.test.ts`
Expected: FAIL with "Cannot find module './weightApi'"

- [ ] **Step 3: Implement weightApi**

Create `src/domains/health/weightApi.ts`:

```ts
import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WeightEntry } from '../shared/types';

export async function addWeightEntry(uid: string, entry: Omit<WeightEntry, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'weightEntries'), entry);
  return ref.id;
}

export async function listWeightEntries(uid: string): Promise<WeightEntry[]> {
  const q = query(collection(db, 'users', uid, 'weightEntries'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<WeightEntry, 'id'>>;
    return {
      id: d.id,
      date: data.date ?? '',
      weightKg: typeof data.weightKg === 'number' ? data.weightKg : 0,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/health/weightApi.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/health/weightApi.ts src/domains/health/weightApi.test.ts
git commit -m "feat: add weight entries Firestore API"
```

---

### Task 4: HealthScreen

**Files:**
- Create: `src/domains/health/HealthScreen.tsx`
- Test: `src/domains/health/HealthScreen.test.tsx`

**Interfaces:**
- Consumes: `getSleepLog`, `saveSleepLog` from `./sleepApi`; `listWeightEntries`, `addWeightEntry` from `./weightApi`; `computeSleepDurationHours`, `computeWeightChange` from `./healthLogic`; `SleepLog`, `WeightEntry` from `../shared/types`; `todayId` from `../shared/dateUtils`
- Produces: `<HealthScreen uid: string />`

- [ ] **Step 1: Write the failing tests (three rounds — sleep save, duration display, weight entry)**

Create `src/domains/health/HealthScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetSleepLog = vi.fn();
const mockSaveSleepLog = vi.fn().mockResolvedValue(undefined);
const mockListWeightEntries = vi.fn();
const mockAddWeightEntry = vi.fn().mockResolvedValue('w1');

vi.mock('./sleepApi', () => ({
  getSleepLog: (...args: [string]) => mockGetSleepLog(...args),
  saveSleepLog: (...args: [string, unknown]) => mockSaveSleepLog(...args),
}));
vi.mock('./weightApi', () => ({
  listWeightEntries: (...args: [string]) => mockListWeightEntries(...args),
  addWeightEntry: (...args: [string, unknown]) => mockAddWeightEntry(...args),
}));

import { HealthScreen } from './HealthScreen';

describe('HealthScreen', () => {
  beforeEach(() => {
    mockGetSleepLog.mockReset();
    mockSaveSleepLog.mockClear();
    mockListWeightEntries.mockReset();
    mockAddWeightEntry.mockClear();
  });

  it('saves bedtime and wake time', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);

    render(<HealthScreen uid="user1" />);
    await waitFor(() => expect(mockGetSleepLog).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Bedtime'), '23:00');
    await user.type(screen.getByLabelText('Wake time'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save sleep' }));

    expect(mockSaveSleepLog).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ bedtime: '23:00', wakeTime: '07:00' })
    );
  });

  it('shows the computed sleep duration when a log already has both times', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' });
    mockListWeightEntries.mockResolvedValue([]);

    render(<HealthScreen uid="user1" />);

    await waitFor(() => expect(screen.getByText('8h slept')).toBeInTheDocument());
  });

  it('adds a weight entry', async () => {
    mockGetSleepLog.mockResolvedValue({ date: '2026-07-20', bedtime: '', wakeTime: '' });
    mockListWeightEntries.mockResolvedValue([]);

    render(<HealthScreen uid="user1" />);
    await waitFor(() => expect(mockListWeightEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '70');
    await user.click(screen.getByRole('button', { name: 'Log weight' }));

    expect(mockAddWeightEntry).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ weightKg: 70 })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/health/HealthScreen.test.tsx`
Expected: FAIL with "Cannot find module './HealthScreen'"

- [ ] **Step 3: Implement HealthScreen**

Create `src/domains/health/HealthScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { getSleepLog, saveSleepLog } from './sleepApi';
import { listWeightEntries, addWeightEntry } from './weightApi';
import { computeSleepDurationHours, computeWeightChange } from './healthLogic';
import { SleepLog, WeightEntry } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function HealthScreen({ uid }: { uid: string }) {
  const [sleepLog, setSleepLog] = useState<SleepLog | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    getSleepLog(uid).then((log) => {
      setSleepLog(log);
      setBedtime(log.bedtime);
      setWakeTime(log.wakeTime);
    }).catch(handleError);
    listWeightEntries(uid).then(setWeightEntries).catch(handleError);
  }, [uid]);

  async function handleSaveSleep(e: FormEvent) {
    e.preventDefault();
    const log: SleepLog = { date: todayId(), bedtime, wakeTime };
    await saveSleepLog(uid, log);
    setSleepLog(log);
  }

  async function handleAddWeight(e: FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(weightKg);
    if (Number.isNaN(parsed)) return;
    const entry: Omit<WeightEntry, 'id'> = { date: todayId(), weightKg: parsed };
    const id = await addWeightEntry(uid, entry);
    setWeightEntries((prev) => [{ id, ...entry }, ...prev]);
    setWeightKg('');
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  const duration =
    sleepLog?.bedtime && sleepLog?.wakeTime
      ? computeSleepDurationHours(sleepLog.bedtime, sleepLog.wakeTime)
      : null;
  const weightChange = computeWeightChange(weightEntries);

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Sleep &amp; Health</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Sleep</h2>
        {duration !== null && <p className="text-sm text-gray-600">{duration}h slept</p>}
        <form onSubmit={handleSaveSleep} className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col text-sm">
            Bedtime
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            Wake time
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Save sleep
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Weight</h2>
        {weightChange !== null && (
          <p className="text-sm text-gray-600">
            {weightChange > 0 ? '+' : ''}
            {weightChange}kg since last entry
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {weightEntries.map((entry) => (
            <li key={entry.id} className="text-sm">
              {entry.date} — {entry.weightKg}kg
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddWeight} className="flex gap-2">
          <input
            type="number"
            placeholder="Weight (kg)"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="border rounded px-3 py-2 w-32"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Log weight
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/health/HealthScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/health/HealthScreen.tsx src/domains/health/HealthScreen.test.tsx
git commit -m "feat: add HealthScreen with sleep log and weight tracking"
```

---

### Task 5: Goals API

**Files:**
- Create: `src/domains/goals/goalsApi.ts`
- Test: `src/domains/goals/goalsApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `Goal` from `../shared/types`
- Produces: `listGoals(uid: string): Promise<Goal[]>`, `saveGoal(uid: string, goal: Goal): Promise<void>`, `deleteGoal(uid: string, goalId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/domains/goals/goalsApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Goal } from '../shared/types';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockDeleteDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listGoals, saveGoal, deleteGoal } from './goalsApi';

describe('goalsApi', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockDeleteDoc.mockReset();
  });

  it('listGoals maps docs to Goal objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'g1',
          data: () => ({
            title: 'Run a 10k',
            targetDate: '2026-12-01',
            status: 'active',
            milestones: [{ id: 'm1', label: 'Run 5k', done: true }],
          }),
        },
      ],
    });
    const result = await listGoals('user1');
    expect(result).toEqual([
      {
        id: 'g1',
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [{ id: 'm1', label: 'Run 5k', done: true }],
      },
    ]);
  });

  it('defaults missing/malformed fields on read', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ status: 'bogus' }) }],
    });
    const result = await listGoals('user1');
    expect(result).toEqual([
      { id: 'g1', title: '', targetDate: '', status: 'active', milestones: [] },
    ]);
  });

  it('defaults a non-array milestones field to an empty array', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ title: 'X', milestones: 'not-an-array' }) }],
    });
    const result = await listGoals('user1');
    expect(result[0].milestones).toEqual([]);
  });

  it('saveGoal writes the goal fields', async () => {
    const goal: Goal = {
      id: 'g1',
      title: 'Run a 10k',
      targetDate: '2026-12-01',
      status: 'active',
      milestones: [],
    };
    await saveGoal('user1', goal);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      title: 'Run a 10k',
      targetDate: '2026-12-01',
      status: 'active',
      milestones: [],
    });
  });

  it('deleteGoal removes the goal doc', async () => {
    await deleteGoal('user1', 'g1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/goals/goalsApi.test.ts`
Expected: FAIL with "Cannot find module './goalsApi'"

- [ ] **Step 3: Implement goalsApi**

Create `src/domains/goals/goalsApi.ts`:

```ts
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Goal } from '../shared/types';

export async function listGoals(uid: string): Promise<Goal[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'goals'));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<Goal, 'id'>>;
    return {
      id: d.id,
      title: data.title ?? '',
      targetDate: data.targetDate ?? '',
      status: data.status === 'done' ? 'done' : 'active',
      milestones: Array.isArray(data.milestones) ? data.milestones : [],
    };
  });
}

export async function saveGoal(uid: string, goal: Goal): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'goals', goal.id), {
    title: goal.title,
    targetDate: goal.targetDate,
    status: goal.status,
    milestones: goal.milestones,
  });
}

export async function deleteGoal(uid: string, goalId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'goals', goalId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/goals/goalsApi.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/goals/goalsApi.ts src/domains/goals/goalsApi.test.ts
git commit -m "feat: add goals Firestore API"
```

---

### Task 6: Weekly review API

**Files:**
- Create: `src/domains/goals/weeklyReviewApi.ts`
- Test: `src/domains/goals/weeklyReviewApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `WeeklyReview` from `../shared/types`
- Produces: `getWeeklyReview(uid: string, weekId: string): Promise<WeeklyReview | null>` (returns `null`, NOT a defaulted object, when no review exists yet for that week — see Global Constraints), `saveWeeklyReview(uid: string, review: WeeklyReview): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/domains/goals/weeklyReviewApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { getWeeklyReview, saveWeeklyReview } from './weeklyReviewApi';

describe('getWeeklyReview', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns null when no review exists for the week', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getWeeklyReview('user1', '2026-07-19');
    expect(result).toBeNull();
  });

  it('defaults missing fields when a review doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ wentWell: 'Slept well' }) });
    const result = await getWeeklyReview('user1', '2026-07-19');
    expect(result).toEqual({ weekId: '2026-07-19', wentWell: 'Slept well', wentBadly: '', focusNext: '' });
  });

  it('returns the stored review when fully present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ wentWell: 'A', wentBadly: 'B', focusNext: 'C' }),
    });
    const result = await getWeeklyReview('user1', '2026-07-19');
    expect(result).toEqual({ weekId: '2026-07-19', wentWell: 'A', wentBadly: 'B', focusNext: 'C' });
  });
});

describe('saveWeeklyReview', () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
  });

  it('writes the review fields', async () => {
    await saveWeeklyReview('user1', { weekId: '2026-07-19', wentWell: 'A', wentBadly: 'B', focusNext: 'C' });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      wentWell: 'A',
      wentBadly: 'B',
      focusNext: 'C',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/goals/weeklyReviewApi.test.ts`
Expected: FAIL with "Cannot find module './weeklyReviewApi'"

- [ ] **Step 3: Implement weeklyReviewApi**

Create `src/domains/goals/weeklyReviewApi.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WeeklyReview } from '../shared/types';

export function weeklyReviewDocRef(uid: string, weekId: string) {
  return doc(db, 'users', uid, 'weeklyReviews', weekId);
}

export async function getWeeklyReview(uid: string, weekId: string): Promise<WeeklyReview | null> {
  const snap = await getDoc(weeklyReviewDocRef(uid, weekId));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<Omit<WeeklyReview, 'weekId'>>;
  return {
    weekId,
    wentWell: data.wentWell ?? '',
    wentBadly: data.wentBadly ?? '',
    focusNext: data.focusNext ?? '',
  };
}

export async function saveWeeklyReview(uid: string, review: WeeklyReview): Promise<void> {
  await setDoc(weeklyReviewDocRef(uid, review.weekId), {
    wentWell: review.wentWell,
    wentBadly: review.wentBadly,
    focusNext: review.focusNext,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/goals/weeklyReviewApi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/goals/weeklyReviewApi.ts src/domains/goals/weeklyReviewApi.test.ts
git commit -m "feat: add weekly review Firestore API"
```

---

### Task 7: Goals pure logic

**Files:**
- Create: `src/domains/goals/goalsLogic.ts`
- Test: `src/domains/goals/goalsLogic.test.ts`

**Interfaces:**
- Consumes: `Goal`, `WeeklyReview` from `../shared/types`
- Produces: `computeMilestoneProgress(goal: Goal): number` (0-100, rounded), `isWeeklyReviewDue(dow: number, review: WeeklyReview | null): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domains/goals/goalsLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeMilestoneProgress, isWeeklyReviewDue } from './goalsLogic';
import { Goal } from '../shared/types';

describe('computeMilestoneProgress', () => {
  it('returns 0 when the goal has no milestones', () => {
    const goal: Goal = { id: 'g1', title: 'X', targetDate: '', status: 'active', milestones: [] };
    expect(computeMilestoneProgress(goal)).toBe(0);
  });

  it('computes the rounded percent of done milestones', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'X',
      targetDate: '',
      status: 'active',
      milestones: [
        { id: 'm1', label: 'A', done: true },
        { id: 'm2', label: 'B', done: false },
      ],
    };
    expect(computeMilestoneProgress(goal)).toBe(50);
  });

  it('returns 100 when all milestones are done', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'X',
      targetDate: '',
      status: 'active',
      milestones: [
        { id: 'm1', label: 'A', done: true },
        { id: 'm2', label: 'B', done: true },
        { id: 'm3', label: 'C', done: true },
      ],
    };
    expect(computeMilestoneProgress(goal)).toBe(100);
  });
});

describe('isWeeklyReviewDue', () => {
  it('is due on Sunday when no review has been recorded yet', () => {
    expect(isWeeklyReviewDue(0, null)).toBe(true);
  });

  it('is not due on Sunday when a review already exists', () => {
    expect(isWeeklyReviewDue(0, { weekId: '2026-07-19', wentWell: '', wentBadly: '', focusNext: '' })).toBe(
      false
    );
  });

  it('is not due on a non-Sunday day, regardless of review state', () => {
    expect(isWeeklyReviewDue(3, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/goals/goalsLogic.test.ts`
Expected: FAIL with "Cannot find module './goalsLogic'"

- [ ] **Step 3: Implement goalsLogic**

Create `src/domains/goals/goalsLogic.ts`:

```ts
import { Goal, WeeklyReview } from '../shared/types';

export function computeMilestoneProgress(goal: Goal): number {
  if (goal.milestones.length === 0) return 0;
  const doneCount = goal.milestones.filter((m) => m.done).length;
  return Math.round((doneCount / goal.milestones.length) * 100);
}

export function isWeeklyReviewDue(dow: number, review: WeeklyReview | null): boolean {
  return dow === 0 && review === null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/goals/goalsLogic.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/goals/goalsLogic.ts src/domains/goals/goalsLogic.test.ts
git commit -m "feat: add goals pure logic (milestone progress, weekly review due)"
```

---

### Task 8: GoalsScreen

**Files:**
- Create: `src/domains/goals/GoalsScreen.tsx`
- Test: `src/domains/goals/GoalsScreen.test.tsx`

**Interfaces:**
- Consumes: `listGoals`, `saveGoal` from `./goalsApi`; `getWeeklyReview`, `saveWeeklyReview` from `./weeklyReviewApi`; `computeMilestoneProgress`, `isWeeklyReviewDue` from `./goalsLogic`; `Goal`, `Milestone`, `WeeklyReview` from `../shared/types`; `todayId`, `dayOfWeek`, `weekId` from `../shared/dateUtils`
- Produces: `<GoalsScreen uid: string />`

- [ ] **Step 1: Write the failing tests (three rounds — add goal, toggle milestone, weekly review)**

Create `src/domains/goals/GoalsScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockListGoals = vi.fn();
const mockSaveGoal = vi.fn().mockResolvedValue(undefined);
const mockGetWeeklyReview = vi.fn();
const mockSaveWeeklyReview = vi.fn().mockResolvedValue(undefined);

vi.mock('./goalsApi', () => ({
  listGoals: (...args: [string]) => mockListGoals(...args),
  saveGoal: (...args: [string, unknown]) => mockSaveGoal(...args),
}));
vi.mock('./weeklyReviewApi', () => ({
  getWeeklyReview: (...args: [string, string]) => mockGetWeeklyReview(...args),
  saveWeeklyReview: (...args: [string, unknown]) => mockSaveWeeklyReview(...args),
}));

import { GoalsScreen } from './GoalsScreen';

describe('GoalsScreen', () => {
  beforeEach(() => {
    mockListGoals.mockReset();
    mockSaveGoal.mockClear();
    mockGetWeeklyReview.mockReset();
    mockSaveWeeklyReview.mockClear();
  });

  it('adds a new goal with comma-separated milestones', async () => {
    mockListGoals.mockResolvedValue([]);
    mockGetWeeklyReview.mockResolvedValue(null);

    render(<GoalsScreen uid="user1" />);
    await waitFor(() => expect(mockListGoals).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Goal title'), 'Run a 10k');
    await user.type(screen.getByPlaceholderText('Target date'), '2026-12-01');
    await user.type(screen.getByPlaceholderText('Milestones (comma separated)'), 'Run 5k, Run 8k');
    await user.click(screen.getByRole('button', { name: 'Add goal' }));

    expect(mockSaveGoal).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [
          expect.objectContaining({ label: 'Run 5k', done: false }),
          expect.objectContaining({ label: 'Run 8k', done: false }),
        ],
      })
    );
  });

  it('toggles a milestone done and persists the whole goal', async () => {
    mockListGoals.mockResolvedValue([
      {
        id: 'g1',
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [{ id: 'm1', label: 'Run 5k', done: false }],
      },
    ]);
    mockGetWeeklyReview.mockResolvedValue(null);

    render(<GoalsScreen uid="user1" />);
    await waitFor(() => expect(screen.getByText('Run 5k')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Run 5k' }));

    expect(mockSaveGoal).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        id: 'g1',
        milestones: [expect.objectContaining({ label: 'Run 5k', done: true })],
      })
    );
  });

  it('submits the weekly review', async () => {
    mockListGoals.mockResolvedValue([]);
    mockGetWeeklyReview.mockResolvedValue(null);

    render(<GoalsScreen uid="user1" />);
    await waitFor(() => expect(mockGetWeeklyReview).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What went well?'), 'Consistent workouts');
    await user.type(screen.getByPlaceholderText("What didn't go well?"), 'Missed a chore day');
    await user.type(screen.getByPlaceholderText('Focus for next week'), 'Sleep earlier');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(mockSaveWeeklyReview).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        wentWell: 'Consistent workouts',
        wentBadly: 'Missed a chore day',
        focusNext: 'Sleep earlier',
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/goals/GoalsScreen.test.tsx`
Expected: FAIL with "Cannot find module './GoalsScreen'"

- [ ] **Step 3: Implement GoalsScreen**

Create `src/domains/goals/GoalsScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { listGoals, saveGoal } from './goalsApi';
import { getWeeklyReview, saveWeeklyReview } from './weeklyReviewApi';
import { computeMilestoneProgress, isWeeklyReviewDue } from './goalsLogic';
import { Goal, Milestone, WeeklyReview } from '../shared/types';
import { todayId, dayOfWeek, weekId } from '../shared/dateUtils';

export function GoalsScreen({ uid }: { uid: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestonesInput, setMilestonesInput] = useState('');

  const [wentWell, setWentWell] = useState('');
  const [wentBadly, setWentBadly] = useState('');
  const [focusNext, setFocusNext] = useState('');

  const currentWeekId = weekId(todayId());

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listGoals(uid).then(setGoals).catch(handleError);
    getWeeklyReview(uid, currentWeekId).then((r) => {
      setReview(r);
      if (r) {
        setWentWell(r.wentWell);
        setWentBadly(r.wentBadly);
        setFocusNext(r.focusNext);
      }
    }).catch(handleError);
  }, [uid, currentWeekId]);

  async function handleAddGoal(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const milestones: Milestone[] = milestonesInput
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0)
      .map((label) => ({ id: crypto.randomUUID(), label, done: false }));
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: title.trim(),
      targetDate: targetDate.trim(),
      status: 'active',
      milestones,
    };
    await saveGoal(uid, goal);
    setGoals((prev) => [...prev, goal]);
    setTitle('');
    setTargetDate('');
    setMilestonesInput('');
  }

  async function handleToggleMilestone(goalId: string, milestoneId: string, done: boolean) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const updated: Goal = {
      ...goal,
      milestones: goal.milestones.map((m) => (m.id === milestoneId ? { ...m, done } : m)),
    };
    await saveGoal(uid, updated);
    setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
  }

  async function handleSaveReview(e: FormEvent) {
    e.preventDefault();
    const newReview: WeeklyReview = { weekId: currentWeekId, wentWell, wentBadly, focusNext };
    await saveWeeklyReview(uid, newReview);
    setReview(newReview);
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  const dow = dayOfWeek(todayId());
  const reviewDue = isWeeklyReviewDue(dow, review);

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Goals &amp; Journaling</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Goals</h2>
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => {
            const progress = computeMilestoneProgress(goal);
            return (
              <li key={goal.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{goal.title}</span>
                  <span>{goal.targetDate}</span>
                </div>
                <div className="w-full bg-gray-200 rounded h-2">
                  <div className="h-2 rounded bg-blue-500" style={{ width: `${progress}%` }} />
                </div>
                <ul className="flex flex-col gap-1 pl-3">
                  {goal.milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={m.label}
                        checked={m.done}
                        onChange={(e) => handleToggleMilestone(goal.id, m.id, e.target.checked)}
                      />
                      <span className={m.done ? 'line-through text-gray-400' : ''}>{m.label}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleAddGoal} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Target date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Milestones (comma separated)"
            value={milestonesInput}
            onChange={(e) => setMilestonesInput(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add goal
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          Weekly review {reviewDue && <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">Due today</span>}
        </h2>
        <form onSubmit={handleSaveReview} className="flex flex-col gap-2">
          <textarea
            placeholder="What went well?"
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <textarea
            placeholder="What didn't go well?"
            value={wentBadly}
            onChange={(e) => setWentBadly(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <textarea
            placeholder="Focus for next week"
            value={focusNext}
            onChange={(e) => setFocusNext(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2 self-start">
            Save review
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/goals/GoalsScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/goals/GoalsScreen.tsx src/domains/goals/GoalsScreen.test.tsx
git commit -m "feat: add GoalsScreen with milestones and weekly review"
```

---

### Task 9: Extend dashboard pure logic with weekly-review due-item

**Files:**
- Modify: `src/dashboard/dashboardLogic.ts`
- Modify: `src/dashboard/dashboardLogic.test.ts`

**Interfaces:**
- Consumes: `isWeeklyReviewDue` from `../domains/goals/goalsLogic`; `WeeklyReview`, `DueItem` from `../domains/shared/types`
- Produces: `computeWeeklyReviewDueItem(dow: number, review: WeeklyReview | null): DueItem[]`

- [ ] **Step 1: Write the failing test**

Append to `src/dashboard/dashboardLogic.test.ts`:

```ts
import { computeWeeklyReviewDueItem } from './dashboardLogic';
import { WeeklyReview } from '../domains/shared/types';

describe('computeWeeklyReviewDueItem', () => {
  it('returns a due item on Sunday when no review has been recorded', () => {
    expect(computeWeeklyReviewDueItem(0, null)).toEqual([
      { id: 'weekly-review', label: 'Weekly review due', domain: 'goals' },
    ]);
  });

  it('returns an empty array on Sunday when a review already exists', () => {
    const review: WeeklyReview = { weekId: '2026-07-19', wentWell: '', wentBadly: '', focusNext: '' };
    expect(computeWeeklyReviewDueItem(0, review)).toEqual([]);
  });

  it('returns an empty array on a non-Sunday day', () => {
    expect(computeWeeklyReviewDueItem(3, null)).toEqual([]);
  });
});
```

Add the new import at the top of `src/dashboard/dashboardLogic.test.ts` alongside the existing imports (do not remove any existing import — this file already imports `describe`, `it`, `expect` from `vitest` and the functions under test from `./dashboardLogic`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: FAIL with "computeWeeklyReviewDueItem is not a function" (or similar)

- [ ] **Step 3: Implement computeWeeklyReviewDueItem**

Add to the top imports of `src/dashboard/dashboardLogic.ts` (extend, don't replace, the existing import lines):

```ts
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';
import { WeeklyReview } from '../domains/shared/types';
```

Append to `src/dashboard/dashboardLogic.ts`:

```ts
export function computeWeeklyReviewDueItem(dow: number, review: WeeklyReview | null): DueItem[] {
  if (!isWeeklyReviewDue(dow, review)) return [];
  return [{ id: 'weekly-review', label: 'Weekly review due', domain: 'goals' as const }];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: PASS (all existing tests + 3 new)

- [ ] **Step 5: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/dashboardLogic.ts src/dashboard/dashboardLogic.test.ts
git commit -m "feat: add weekly-review-due-item calculation"
```

---

### Task 10: Extend useDashboardData with sleep, goals, and weekly review

**Files:**
- Modify: `src/dashboard/useDashboardData.ts`
- Modify: `src/dashboard/useDashboardData.test.ts`

**Interfaces:**
- Consumes: `getSleepLog` from `../domains/health/sleepApi`; `listGoals` from `../domains/goals/goalsApi`; `getWeeklyReview` from `../domains/goals/weeklyReviewApi`; `computeWeeklyReviewDueItem` from `./dashboardLogic`; `weekId` from `../domains/shared/dateUtils`; `SleepLog`, `Goal`, `WeeklyReview` from `../domains/shared/types`
- Produces: `DashboardData` extended with `sleepLog: SleepLog | null`, `goals: Goal[]`, `weeklyReview: WeeklyReview | null`

Read the CURRENT `src/dashboard/useDashboardData.ts` before making changes — it currently fetches `completion`/`history`/`chores`/`bills`/`groceryItems` via a single `Promise.all`, computes `dueItems` by concatenating `computeDueItems`, `computeBillDueItems`, and `computeGroceryDueItem`, and returns a `DashboardData` object. This task adds three more parallel fetches and one more `dueItems` source without altering any of that existing logic.

- [ ] **Step 1: Write the failing test**

Append to `src/dashboard/useDashboardData.test.ts`. This file already mocks `../domains/shared/completionsApi`, `../domains/chores/choresApi` (via `vi.importActual`), `../domains/finances/billsApi` (via `vi.importActual`), and `../domains/meals/groceryApi`, plus `firebase/firestore` and `../firebase/config`/`../../firebase/config` (needed because `choresApi`/`billsApi` transitively import real Firebase — see Global Constraints). Add three more mocks in the same style, alongside the existing `vi.mock(...)` calls at the top of the file (do not remove any existing mock):

```ts
const mockGetSleepLog = vi.fn((..._args: unknown[]) => Promise.resolve({ date: '', bedtime: '', wakeTime: '' }));
const mockListGoals = vi.fn((..._args: unknown[]) => Promise.resolve([]));
const mockGetWeeklyReview = vi.fn((..._args: unknown[]) => Promise.resolve(null));

vi.mock('../domains/health/sleepApi', () => ({
  getSleepLog: (...args: unknown[]) => mockGetSleepLog(...args),
}));
vi.mock('../domains/goals/goalsApi', () => ({
  listGoals: (...args: unknown[]) => mockListGoals(...args),
}));
vi.mock('../domains/goals/weeklyReviewApi', () => ({
  getWeeklyReview: (...args: unknown[]) => mockGetWeeklyReview(...args),
}));
```

Then add a new test to the existing `describe('useDashboardData', ...)` block (append inside it, alongside the existing test cases — do not remove any):

```ts
it('fetches sleep log, goals, and weekly review, and folds a due weekly-review into dueItems', async () => {
  mockGetSleepLog.mockResolvedValue({ date: '2026-07-19', bedtime: '23:00', wakeTime: '07:00' });
  mockListGoals.mockResolvedValue([
    { id: 'g1', title: 'Run a 10k', targetDate: '2026-12-01', status: 'active', milestones: [] },
  ]);
  mockGetWeeklyReview.mockResolvedValue(null);

  const { result } = renderHook(() => useDashboardData('user1'));

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.sleepLog).toEqual({ date: '2026-07-19', bedtime: '23:00', wakeTime: '07:00' });
  expect(result.current.goals).toEqual([
    { id: 'g1', title: 'Run a 10k', targetDate: '2026-12-01', status: 'active', milestones: [] },
  ]);
  expect(result.current.weeklyReview).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: FAIL — `result.current.sleepLog` is `undefined` (property doesn't exist yet), or a TypeScript error if run through `tsc` first

- [ ] **Step 3: Implement the extension**

In `src/dashboard/useDashboardData.ts`, extend the import block (add these lines to the existing imports, don't remove any):

```ts
import { getSleepLog } from '../domains/health/sleepApi';
import { listGoals } from '../domains/goals/goalsApi';
import { getWeeklyReview } from '../domains/goals/weeklyReviewApi';
import { SleepLog, Goal, WeeklyReview } from '../domains/shared/types';
import { weekId } from '../domains/shared/dateUtils';
import { computeWeeklyReviewDueItem } from './dashboardLogic';
```

Extend the `DashboardData` interface — add these three fields to the existing interface body:

```ts
  sleepLog: SleepLog | null;
  goals: Goal[];
  weeklyReview: WeeklyReview | null;
```

Add three more `useState` calls alongside the existing ones:

```ts
  const [sleepLog, setSleepLog] = useState<SleepLog | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null);
```

Extend the `Promise.all` array (add these three promises to the existing array of five) and the corresponding destructured result and setter calls in the `.then(...)`:

```ts
      getSleepLog(uid),
      listGoals(uid),
      getWeeklyReview(uid, weekId(todayId())),
```

```ts
      .then(([todayCompletion, recentHistory, choreList, billList, groceryList, sleep, goalList, review]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
        setBills(billList);
        setGroceryItems(groceryList);
        setSleepLog(sleep);
        setGoals(goalList);
        setWeeklyReview(review);
        setLoading(false);
      })
```

Extend the early-return object (the `if (!completion) { return { ... } }` block) with the three new fields defaulted:

```ts
      sleepLog: null,
      goals: [],
      weeklyReview: null,
```

Extend the `dueItems` composition to fold in the weekly-review due item:

```ts
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeBillDueItems(bills, domNow, dimNow),
    ...computeGroceryDueItem(groceryItems),
    ...computeWeeklyReviewDueItem(dow, weeklyReview),
  ];
```

Extend the final returned object with the three new fields:

```ts
    sleepLog,
    goals,
    weeklyReview,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: PASS (all existing tests + 1 new)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/useDashboardData.ts src/dashboard/useDashboardData.test.ts
git commit -m "feat: fetch sleep, goals, and weekly review into dashboard data"
```

---

### Task 11: Add Health and Goals chips to the Dashboard

**Files:**
- Modify: `src/dashboard/Dashboard.tsx`
- Modify: `src/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `sleepLog`, `goals`, `weeklyReview` from `useDashboardData` (Task 10); `computeSleepDurationHours` from `../domains/health/healthLogic`; `isWeeklyReviewDue` from `../domains/goals/goalsLogic`; `dayOfWeek`, `todayId` from `../domains/shared/dateUtils`; existing `StatusChip` component
- Produces: 2 more `<StatusChip>` entries in the Dashboard's chip grid (Health, Goals), bringing the total to 7

Read the CURRENT `src/dashboard/Dashboard.tsx` before making changes — it currently renders 5 chips (Workout, Learning, Chores, Finances, Meals) in a `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5` grid, computes `billsDueToday`/`uncheckedGroceryCount` inline from `bills`/`groceryItems`, and renders `DueNowStrip`. This task adds 2 more chips and widens the grid; it does not change any existing chip's behavior.

- [ ] **Step 1: Write the failing test**

Read the CURRENT `src/dashboard/Dashboard.test.tsx` first — it mocks `./useDashboardData` with a `mockUseDashboardData` factory function returning a full `DashboardData`-shaped object, and asserts on rendered chip text/status per test. Extend the mock's default/per-test return objects to include `sleepLog`, `goals`, `weeklyReview` (add these three keys wherever the file constructs a `DashboardData`-shaped mock return value — do not remove any existing key), and add `vi.mock('../firebase/config', () => ({ db: {} }))` if it is not already present (it should already be present from Phase 2 Task 11 — check before adding a duplicate).

Add a new test to the existing `describe('Dashboard', ...)` block:

```tsx
it('renders Health and Goals chips', async () => {
  mockUseDashboardData.mockReturnValue({
    loading: false,
    error: null,
    completion: { date: '2026-07-19', workout: true, learning: true, chores: {} },
    chores: [],
    bills: [],
    groceryItems: [],
    sleepLog: { date: '2026-07-19', bedtime: '23:00', wakeTime: '07:00' },
    goals: [
      { id: 'g1', title: 'Run a 10k', targetDate: '2026-12-01', status: 'active', milestones: [] },
    ],
    weeklyReview: null,
    dueItems: [],
    dueTodayChoreIds: [],
    streak: 3,
    dayHealth: 100,
  });

  render(<Dashboard uid="user1" onNavigate={vi.fn()} />);

  expect(screen.getByText('Health')).toBeInTheDocument();
  expect(screen.getByText('8h slept')).toBeInTheDocument();
  expect(screen.getByText('Goals')).toBeInTheDocument();
  expect(screen.getByText('Review due')).toBeInTheDocument();
});
```

(This test assumes `mockUseDashboardData` and the `screen`/`render`/`vi` imports already exist in the file from the current test setup — reuse them, don't reimport.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/Dashboard.test.tsx`
Expected: FAIL — `screen.getByText('Health')` throws (element not found)

- [ ] **Step 3: Implement the Health and Goals chips**

Extend the import block at the top of `src/dashboard/Dashboard.tsx` (add these lines, keep the existing ones):

```ts
import { computeSleepDurationHours } from '../domains/health/healthLogic';
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';
import { dayOfWeek } from '../domains/shared/dateUtils';
```

Extend the destructured values pulled from `useDashboardData(uid)` — add `sleepLog`, `goals`, `weeklyReview` to the existing destructuring:

```ts
    sleepLog,
    goals,
    weeklyReview,
```

Add this computation alongside the existing `domNow`/`dimNow`/`billsDueToday`/`uncheckedGroceryCount` block (after it, before the `return`):

```ts
  const sleepDuration =
    sleepLog?.bedtime && sleepLog?.wakeTime
      ? computeSleepDurationHours(sleepLog.bedtime, sleepLog.wakeTime)
      : null;
  const dow = dayOfWeek(todayId());
  const reviewDue = isWeeklyReviewDue(dow, weeklyReview);
  const activeGoalsCount = goals.filter((g) => g.status === 'active').length;
```

Change the grid `className` from `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` to `grid-cols-2 sm:grid-cols-4 md:grid-cols-7` (7 chips now).

Add two more `<StatusChip>` entries inside the grid, after the existing Meals chip:

```tsx
        <StatusChip
          label="Health"
          status={sleepDuration !== null ? 'done' : 'not-started'}
          detail={sleepDuration !== null ? `${sleepDuration}h slept` : 'Not logged'}
          onClick={() => onNavigate('/health')}
        />
        <StatusChip
          label="Goals"
          status={reviewDue ? 'in-progress' : 'done'}
          detail={reviewDue ? 'Review due' : `${activeGoalsCount} active`}
          onClick={() => onNavigate('/goals')}
        />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dashboard/Dashboard.test.tsx`
Expected: PASS (all existing tests + 1 new)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/Dashboard.tsx src/dashboard/Dashboard.test.tsx
git commit -m "feat: add Health and Goals status chips to the Dashboard"
```

---

### Task 12: Wire /health and /goals routes into App shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `HealthScreen` from `./domains/health/HealthScreen`; `GoalsScreen` from `./domains/goals/GoalsScreen`
- Produces: `/health` and `/goals` routes, each rendering the respective screen with `uid`

Read the CURRENT `src/App.tsx` before making changes — it currently has routes for `/`, `/workout`, `/learning`, `/chores`, `/finances`, `/meals`, plus a catch-all redirect to `/`. This task adds two more routes without touching any existing route.

- [ ] **Step 1: Write the failing test**

Read the CURRENT `src/App.test.tsx` first — it mocks each domain screen component and asserts a route renders the right mocked screen with the right `uid`, resetting `window.history` state in a `beforeEach`. Add two more screen mocks alongside the existing ones (do not remove any):

```tsx
vi.mock('./domains/health/HealthScreen', () => ({
  HealthScreen: ({ uid }: { uid: string }) => <div>Health for {uid}</div>,
}));
vi.mock('./domains/goals/GoalsScreen', () => ({
  GoalsScreen: ({ uid }: { uid: string }) => <div>Goals for {uid}</div>,
}));
```

Add two new tests to the existing `describe('App', ...)` block (matching the existing `/finances`/`/meals` route tests' style):

```tsx
it('renders HealthScreen at /health', async () => {
  mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
  window.history.pushState({}, '', '/health');
  render(<App />);
  expect(await screen.findByText('Health for user1')).toBeInTheDocument();
});

it('renders GoalsScreen at /goals', async () => {
  mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
  window.history.pushState({}, '', '/goals');
  render(<App />);
  expect(await screen.findByText('Goals for user1')).toBeInTheDocument();
});
```

(This assumes `mockUseAuth`, `screen`, `render`, and `App` are already imported/defined in the file from the current test setup — reuse them, don't reimport. Match whatever the existing `/finances`/`/meals` tests use for signing in a fake user; adjust `mockUseAuth.mockReturnValue` to whatever the existing tests' pattern actually is if it differs from this sketch.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `screen.findByText('Health for user1')` times out (route not wired yet)

- [ ] **Step 3: Implement the routes**

Extend the import block at the top of `src/App.tsx` (add these lines, keep the existing ones):

```ts
import { HealthScreen } from './domains/health/HealthScreen';
import { GoalsScreen } from './domains/goals/GoalsScreen';
```

Add two more `<Route>` entries inside `<Routes>`, after the existing `/meals` route and before the catch-all `*` route:

```tsx
        <Route path="/health" element={<HealthScreen uid={uid} />} />
        <Route path="/goals" element={<GoalsScreen uid={uid} />} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (all existing tests + 2 new)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire /health and /goals routes into the app shell"
```

---

### Task 13: Manual smoke test against a live Firebase project

**Files:** none (verification-only task)

**Interfaces:** none — this task exercises the Health and Goals domains built in Tasks 1-12 against a real Firebase project (the same one used for Phase 1/2's smoke tests).

- [ ] **Step 1: Run the app locally**

```bash
npm run dev
```

Reuse the `.env` file already configured for Phase 1/2's smoke tests (same Firebase project). No new Firebase console setup is required.

- [ ] **Step 2: Manually verify the golden path in a browser**

Sign in with the existing account, then confirm:

1. The Dashboard now shows 7 chips: Workout, Learning, Chores, Finances, Meals, Health, Goals.
2. Click the Health chip → navigates to `/health`. Enter a bedtime and wake time, save. Confirm the computed duration appears (e.g. "8h slept").
3. Log a weight entry. Confirm it appears in the list. Log a second weight entry a different value; confirm a trend delta appears (e.g. "-0.5kg since last entry").
4. Go back to `/` — confirm the Health chip shows the sleep duration.
5. Click the Goals chip → navigates to `/goals`. Add a goal with a title, target date, and comma-separated milestones. Confirm it appears with a 0% progress bar.
6. Check off one milestone. Confirm the progress bar updates and persists after a refresh.
7. If today is a Sunday, confirm the "Weekly review due" badge appears and the Goals dashboard chip shows "Review due"; fill in and save the weekly review; confirm the badge disappears and the chip switches to showing the active-goals count. If today is not a Sunday, skip this step's live verification and instead confirm via the automated test suite (already covers this via `isWeeklyReviewDue`/`computeWeeklyReviewDueItem` unit tests) — note in your result which path you took.
8. Refresh the page — confirm all Health/Goals data persisted (Firestore-backed).

- [ ] **Step 3: Record the result**

If any step in Step 2 fails, treat it as a bug to fix (write a regression test first, following the same TDD pattern as the rest of this plan) before considering Phase 3 complete — do not proceed with a broken golden path, matching how Phase 1 and Phase 2's smoke tests each caught and fixed real bugs before those phases were called done.
