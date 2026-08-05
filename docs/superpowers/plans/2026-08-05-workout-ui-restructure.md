# Workout Module UI Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workout log's free-text exercise/detail entry with a structured session model — a workout module name (e.g. "Chest Workout") containing one or more exercises, each with its own list of sets (reps + weight), matching standard fitness-app UX.

**Architecture:** Add a new `WorkoutSession` type alongside the existing `LegacyWorkoutLogEntry` type (union type `WorkoutLogEntry`), so old Firestore docs keep rendering in their original format while new entries are written and displayed in the structured format. No migration, no data loss.

**Tech Stack:** React 18 + TypeScript (Vite), Firebase Firestore, Vitest + Testing Library.

## Global Constraints

- Do not migrate, edit, or delete existing `workoutLog` Firestore documents — they keep their `{exercise, detail}` shape and render via the legacy path indefinitely.
- Do not add editing/deleting of previously saved sessions, exercise autocomplete, rest timers, or charts — out of scope per the design doc.
- Weight is stored in kilograms (`weightKg`), consistent with the existing `WeightEntry.weightKg` field in the health domain.
- Client-side ids for exercises use `crypto.randomUUID()`, matching the existing pattern in `GoalsScreen.tsx` and `ChoresScreen.tsx`.

---

### Task 1: Data model — `WorkoutSession` type and legacy type guard

**Files:**
- Modify: `src/domains/shared/types.ts`
- Create: `src/domains/shared/types.test.ts`

**Interfaces:**
- Produces: `WorkoutSet { reps: number; weightKg: number }`, `WorkoutExercise { id: string; name: string; sets: WorkoutSet[] }`, `WorkoutSession { id: string; date: string; moduleName: string; exercises: WorkoutExercise[] }`, `LegacyWorkoutLogEntry { id: string; date: string; exercise: string; detail: string; notes?: string }`, `WorkoutLogEntry = WorkoutSession | LegacyWorkoutLogEntry`, `isLegacyWorkoutEntry(entry: WorkoutLogEntry): entry is LegacyWorkoutLogEntry` — all consumed by Task 2 (`workoutApi.ts`) and Task 3 (`WorkoutScreen.tsx`).

- [ ] **Step 1: Write the failing test for the type guard**

Create `src/domains/shared/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isLegacyWorkoutEntry, WorkoutLogEntry } from './types';

describe('isLegacyWorkoutEntry', () => {
  it('returns true for a legacy exercise/detail entry', () => {
    const entry: WorkoutLogEntry = { id: '1', date: '2026-08-05', exercise: 'Squats', detail: '3x10' };
    expect(isLegacyWorkoutEntry(entry)).toBe(true);
  });

  it('returns false for a structured session entry', () => {
    const entry: WorkoutLogEntry = {
      id: '2',
      date: '2026-08-05',
      moduleName: 'Chest Workout',
      exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
    };
    expect(isLegacyWorkoutEntry(entry)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/shared/types.test.ts`
Expected: FAIL — `WorkoutSession`, `LegacyWorkoutLogEntry`, and `isLegacyWorkoutEntry` don't exist yet, so this fails to compile/import.

- [ ] **Step 3: Replace the existing `WorkoutLogEntry` type with the new union and guard**

In `src/domains/shared/types.ts`, replace:

```typescript
export interface WorkoutLogEntry {
  id: string;
  date: string;
  exercise: string;
  detail: string;
  notes?: string;
}
```

with:

```typescript
export interface WorkoutSet {
  reps: number;
  weightKg: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  moduleName: string;
  exercises: WorkoutExercise[];
}

export interface LegacyWorkoutLogEntry {
  id: string;
  date: string;
  exercise: string;
  detail: string;
  notes?: string;
}

export type WorkoutLogEntry = WorkoutSession | LegacyWorkoutLogEntry;

export function isLegacyWorkoutEntry(entry: WorkoutLogEntry): entry is LegacyWorkoutLogEntry {
  return 'exercise' in entry;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/shared/types.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite to see what else needs updating**

Run: `npx vitest run`
Expected: FAIL in `src/domains/workout/workoutApi.test.ts` and `src/domains/workout/WorkoutScreen.test.tsx` (both use the old `{exercise, detail}` shape via `addWorkoutLogEntry`, which Task 2 will replace) — no other suites should fail. If any other suite fails, stop and investigate before continuing; it means something else depends on the old shape.

- [ ] **Step 6: Commit**

```bash
git add src/domains/shared/types.ts src/domains/shared/types.test.ts
git commit -m "feat: add structured WorkoutSession type alongside legacy workout entry"
```

---

### Task 2: `workoutApi.ts` — write structured sessions, read the union type

**Files:**
- Modify: `src/domains/workout/workoutApi.ts`
- Modify: `src/domains/workout/workoutApi.test.ts`

**Interfaces:**
- Consumes: `WorkoutSession`, `WorkoutLogEntry` from Task 1.
- Produces: `addWorkoutSession(uid: string, session: Omit<WorkoutSession, 'id'>): Promise<string>`, consumed by Task 3. Removes `addWorkoutLogEntry` (no longer used — nothing writes the legacy shape going forward).
- `listWorkoutLogEntries(uid: string): Promise<WorkoutLogEntry[]>` keeps its exact signature; only its return type widens.

- [ ] **Step 1: Write the failing tests**

Replace `src/domains/workout/workoutApi.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
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

import { addWorkoutSession, listWorkoutLogEntries } from './workoutApi';

describe('workoutApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addWorkoutSession writes the session and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'session1' });
    const session = {
      date: '2026-08-05',
      moduleName: 'Chest Workout',
      exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
    };
    const id = await addWorkoutSession('user1', session);
    expect(id).toBe('session1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('listWorkoutLogEntries maps a structured session doc to a WorkoutSession object', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'session1',
          data: () => ({
            date: '2026-08-05',
            moduleName: 'Chest Workout',
            exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
          }),
        },
      ],
    });
    const result = await listWorkoutLogEntries('user1');
    expect(result).toEqual([
      {
        id: 'session1',
        date: '2026-08-05',
        moduleName: 'Chest Workout',
        exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ reps: 12, weightKg: 40 }] }],
      },
    ]);
  });

  it('listWorkoutLogEntries still maps a legacy exercise/detail doc unchanged', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'entry1', data: () => ({ date: '2026-07-20', exercise: 'Squats', detail: '3x10' }) }],
    });
    const result = await listWorkoutLogEntries('user1');
    expect(result).toEqual([{ id: 'entry1', date: '2026-07-20', exercise: 'Squats', detail: '3x10' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domains/workout/workoutApi.test.ts`
Expected: FAIL — `addWorkoutSession` doesn't exist (`addWorkoutLogEntry` does instead).

- [ ] **Step 3: Implement the API change**

Replace `src/domains/workout/workoutApi.ts` with:

```typescript
import { collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { WorkoutLogEntry, WorkoutSession } from '../shared/types';

export async function addWorkoutSession(
  uid: string,
  session: Omit<WorkoutSession, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'workoutLog'), session);
  return ref.id;
}

export async function listWorkoutLogEntries(uid: string): Promise<WorkoutLogEntry[]> {
  const q = query(collection(db, 'users', uid, 'workoutLog'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkoutLogEntry, 'id'>) })) as WorkoutLogEntry[];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domains/workout/workoutApi.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/workout/workoutApi.ts src/domains/workout/workoutApi.test.ts
git commit -m "feat: write structured workout sessions, keep reading legacy entries"
```

---

### Task 3: `WorkoutScreen.tsx` — structured session builder and grouped log rendering

**Files:**
- Modify: `src/domains/workout/WorkoutScreen.tsx`
- Modify: `src/domains/workout/WorkoutScreen.test.tsx`
- Modify: `src/tutorials/tutorialContent.ts`

**Interfaces:**
- Consumes: `addWorkoutSession`, `listWorkoutLogEntries` (Task 2); `WorkoutLogEntry`, `WorkoutSession`, `WorkoutExercise`, `WorkoutSet`, `isLegacyWorkoutEntry` (Task 1); `todayId()` from `src/domains/shared/dateUtils.ts` (unchanged, already imported today).

- [ ] **Step 1: Write the failing tests**

Replace `src/domains/workout/WorkoutScreen.test.tsx` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetCompletion = vi.fn();
const mockSetWorkoutDone = vi.fn().mockResolvedValue(undefined);
const mockListEntries = vi.fn();
const mockAddSession = vi.fn().mockResolvedValue('session1');

vi.mock('../shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  setWorkoutDone: (...args: [string, boolean]) => mockSetWorkoutDone(...args),
}));
vi.mock('./workoutApi', () => ({
  listWorkoutLogEntries: (...args: [string]) => mockListEntries(...args),
  addWorkoutSession: (...args: [string, unknown]) => mockAddSession(...args),
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
    mockAddSession.mockClear().mockResolvedValue('session1');
  });

  it('punches in for today', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Punch In' })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Punch In' }));

    expect(mockSetWorkoutDone).toHaveBeenCalledWith('user1', true);
  });

  it('builds and saves a structured workout session', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Workout name (e.g. Chest Workout)'), 'Chest Workout');
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.type(screen.getByPlaceholderText('Reps'), '12');
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '40');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getAllByPlaceholderText('Reps')[1], '10');
    await user.type(screen.getAllByPlaceholderText('Weight (kg)')[1], '45');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(mockAddSession).toHaveBeenCalledWith('user1', {
      date: '2026-08-05',
      moduleName: 'Chest Workout',
      exercises: [
        {
          id: expect.any(String),
          name: 'Bench Press',
          sets: [
            { reps: 12, weightKg: 40 },
            { reps: 10, weightKg: 45 },
          ],
        },
      ],
    });

    expect(await screen.findByText('Chest Workout')).toBeInTheDocument();
    expect(screen.getByText('Set 1 – 12 reps – 40 kg')).toBeInTheDocument();
    expect(screen.getByText('Set 2 – 10 reps – 45 kg')).toBeInTheDocument();
  });

  it('adds a second exercise block when Add exercise is clicked', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    expect(screen.getAllByPlaceholderText('Exercise name')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getAllByPlaceholderText('Exercise name')).toHaveLength(2);
  });

  it('shows a validation error and does not save when the workout name is missing', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.type(screen.getByPlaceholderText('Reps'), '12');
    await user.type(screen.getByPlaceholderText('Weight (kg)'), '40');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(await screen.findByText(/Enter a workout name/)).toBeInTheDocument();
    expect(mockAddSession).not.toHaveBeenCalled();
  });

  it('shows a validation error when an exercise has no valid sets', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListEntries).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Workout name (e.g. Chest Workout)'), 'Chest Workout');
    await user.type(screen.getByPlaceholderText('Exercise name'), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(await screen.findByText(/at least one set with reps/)).toBeInTheDocument();
    expect(mockAddSession).not.toHaveBeenCalled();
  });

  it('renders a legacy entry using the old date — exercise (detail) format', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([
      { id: 'legacy1', date: '2026-07-20', exercise: 'Squats', detail: '3x10' },
    ]);

    renderScreen();

    expect(await screen.findByText(/Squats \(3x10\)/)).toBeInTheDocument();
  });

  it('renders a structured session entry grouped by exercise and set', async () => {
    mockGetCompletion.mockResolvedValue({ date: '2026-08-05', workout: false, learning: false, chores: {} });
    mockListEntries.mockResolvedValue([
      {
        id: 'session1',
        date: '2026-08-04',
        moduleName: 'Leg Day',
        exercises: [{ id: 'e1', name: 'Squats', sets: [{ reps: 8, weightKg: 60 }] }],
      },
    ]);

    renderScreen();

    expect(await screen.findByText('Leg Day')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText('Set 1 – 8 reps – 60 kg')).toBeInTheDocument();
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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domains/workout/WorkoutScreen.test.tsx`
Expected: FAIL — the current screen has no "Workout name", "Add set", "Add exercise", or "Save workout" controls, and doesn't group by module/sets.

- [ ] **Step 3: Implement the new `WorkoutScreen`**

Replace `src/domains/workout/WorkoutScreen.tsx` with:

```typescript
import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setWorkoutDone } from '../shared/completionsApi';
import { listWorkoutLogEntries, addWorkoutSession } from './workoutApi';
import { WorkoutLogEntry, WorkoutSession, DailyCompletion, isLegacyWorkoutEntry } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

interface DraftSet {
  reps: string;
  weightKg: string;
}

interface DraftExercise {
  id: string;
  name: string;
  sets: DraftSet[];
}

function emptyExercise(): DraftExercise {
  return { id: crypto.randomUUID(), name: '', sets: [{ reps: '', weightKg: '' }] };
}

export function WorkoutScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [moduleName, setModuleName] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const [formError, setFormError] = useState<string | null>(null);
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

  function updateExerciseName(exerciseId: string, name: string) {
    setDraftExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, name } : ex)));
  }

  function updateSet(exerciseId: string, setIndex: number, field: keyof DraftSet, value: string) {
    setDraftExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, [field]: value } : s)) }
          : ex
      )
    );
  }

  function addSet(exerciseId: string) {
    setDraftExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, sets: [...ex.sets, { reps: '', weightKg: '' }] } : ex))
    );
  }

  function removeSet(exerciseId: string, setIndex: number) {
    setDraftExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) } : ex))
    );
  }

  function addExercise() {
    setDraftExercises((prev) => [...prev, emptyExercise()]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!moduleName.trim()) {
      setFormError('Enter a workout name.');
      return;
    }

    const exercises: WorkoutSession['exercises'] = [];
    for (const draft of draftExercises) {
      if (!draft.name.trim()) {
        setFormError('Every exercise needs a name.');
        return;
      }
      const sets = draft.sets
        .filter((s) => s.reps.trim() !== '')
        .map((s) => ({ reps: Number(s.reps), weightKg: Number(s.weightKg) || 0 }));
      if (sets.length === 0 || sets.some((s) => s.reps <= 0)) {
        setFormError('Every exercise needs at least one set with reps.');
        return;
      }
      exercises.push({ id: draft.id, name: draft.name.trim(), sets });
    }

    const session: Omit<WorkoutSession, 'id'> = { date: todayId(), moduleName: moduleName.trim(), exercises };
    const id = await addWorkoutSession(uid, session);
    setEntries((prev) => [{ id, ...session }, ...prev]);
    setModuleName('');
    setDraftExercises([emptyExercise()]);
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  return (
    <PageCard>
      <ScreenHeader label="Workout" />
      <div id="workout-punchin">
        <PunchInButton done={completion?.workout ?? false} onToggle={handlePunchIn} />
      </div>
      <form id="workout-form" onSubmit={handleSave} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Workout name (e.g. Chest Workout)"
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
          className={fieldClass}
        />
        {draftExercises.map((exercise) => (
          <div key={exercise.id} className="flex flex-col gap-2 border border-line rounded-lg p-3">
            <input
              type="text"
              placeholder="Exercise name"
              value={exercise.name}
              onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
              className={fieldClass}
            />
            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted w-12">Set {setIndex + 1}</span>
                <input
                  type="number"
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(e) => updateSet(exercise.id, setIndex, 'reps', e.target.value)}
                  className={fieldClass}
                />
                <input
                  type="number"
                  placeholder="Weight (kg)"
                  value={set.weightKg}
                  onChange={(e) => updateSet(exercise.id, setIndex, 'weightKg', e.target.value)}
                  className={fieldClass}
                />
                {exercise.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(exercise.id, setIndex)}
                    className="text-xs text-muted"
                  >
                    Remove set
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addSet(exercise.id)} className="text-sm text-primary self-start">
              Add set
            </button>
          </div>
        ))}
        <button type="button" onClick={addExercise} className="text-sm text-primary self-start">
          Add exercise
        </button>
        <button type="submit" className={buttonClass}>
          Save workout
        </button>
        {formError && <p className="text-sm text-[#B3261E]">{formError}</p>}
      </form>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) =>
          isLegacyWorkoutEntry(entry) ? (
            <li key={entry.id} className="text-sm border-b border-line last:border-b-0 pb-1.5">
              <span className="font-mono text-xs text-muted">{entry.date}</span> — {entry.exercise} (
              {entry.detail})
            </li>
          ) : (
            <li key={entry.id} className="flex flex-col gap-1.5 border-b border-line last:border-b-0 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-semibold">{entry.moduleName}</span>
                <span className="font-mono text-xs text-muted">{entry.date}</span>
              </div>
              {entry.exercises.map((exercise) => (
                <div key={exercise.id} className="flex flex-col gap-0.5 pl-1">
                  <span className="text-sm font-medium">{exercise.name}</span>
                  {exercise.sets.map((set, i) => (
                    <span key={i} className="text-sm text-muted">
                      Set {i + 1} – {set.reps} reps – {set.weightKg} kg
                    </span>
                  ))}
                </div>
              ))}
            </li>
          )
        )}
      </ul>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Workout" steps={tutorialContent.workout} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domains/workout/WorkoutScreen.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Update the tutorial copy to match the new form**

In `src/tutorials/tutorialContent.ts`, find the `workout` tutorial steps and replace the "Log an exercise" step body. Change:

```typescript
    {
      title: 'Log an exercise',
      body: 'Add an exercise and detail (e.g. "3x10" or "30 min") to keep a history.',
      targetId: 'workout-form',
    },
```

to:

```typescript
    {
      title: 'Log a workout',
      body: 'Name your workout, add exercises, and log each set\'s reps and weight to keep a history.',
      targetId: 'workout-form',
    },
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (no regressions in any suite)

- [ ] **Step 7: Run the TypeScript build to catch type errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/domains/workout/WorkoutScreen.tsx src/domains/workout/WorkoutScreen.test.tsx src/tutorials/tutorialContent.ts
git commit -m "feat: restructure workout screen around named sessions with sets/reps/weight"
```

---

## Manual verification (not automated)

1. Run `npm run dev`, open the Workout screen, and build a session with two exercises (one with two sets, one with one set); confirm "Save workout" clears the form and the new session appears at the top of the log in the grouped format.
2. If any pre-existing legacy log entries exist in Firestore for your account, confirm they still render in the old `date — exercise (detail)` format below the new structured ones.
3. Try saving with an empty workout name, and with an exercise that has no reps entered, and confirm the correct validation message appears in each case without a Firestore write.
