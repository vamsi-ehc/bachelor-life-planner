# Workout module UI restructure — design

## Context

Testing feedback: the workout log currently stores a free-text `exercise` + `detail` string per entry (e.g. "Squats" / "3x10"), rendered as a flat list. Feedback asked for a structure that matches standard fitness apps: a workout module name as a heading, with exercises underneath showing sets, reps, and weight per set, e.g.:

```
Chest Workout

Bench Press
Set 1 - 12 reps - 40 kg
Set 2 - 10 reps - 45 kg
Set 3 - 8 reps - 50 kg
```

This is a personal single-user app (real Firestore data, no other users). Existing log entries stay as-is — no migration script, no data loss — and continue to render in their old format alongside new structured entries.

## Data model

`src/domains/shared/types.ts` — add new types, keep the old one for backward-compatible reads:

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
```

A type guard distinguishes the two shapes at render/use time:

```typescript
export function isLegacyWorkoutEntry(entry: WorkoutLogEntry): entry is LegacyWorkoutLogEntry {
  return 'exercise' in entry;
}
```

The module name is a per-session free-text label (not a fixed exercise category) — a user names each session when logging it (e.g. "Chest Workout", "Leg Day"), and it can contain any exercises.

## API (`src/domains/workout/workoutApi.ts`)

- `listWorkoutLogEntries(uid): Promise<WorkoutLogEntry[]>` — unchanged signature and Firestore query; return type widens to the union since old and new docs coexist in the same collection.
- New `addWorkoutSession(uid, session: Omit<WorkoutSession, 'id'>): Promise<string>` replaces `addWorkoutLogEntry` as the write path. One Firestore doc per session; `exercises` (with nested `sets`) stored as a nested array on that doc — no separate sub-collections needed at this scale.
- `addWorkoutLogEntry` (the old free-text writer) is removed — nothing in the app writes the legacy shape going forward, per the "leave old entries alone, don't migrate" decision.

## `WorkoutScreen.tsx`

**Entry form** replaces the current single exercise+detail row with a session builder:
1. Module name text input (e.g. "Chest Workout").
2. One or more exercise blocks. Each has a name field and a list of set rows (reps number input + weight-kg number input, with a remove-set control). "Add set" appends another set row within that exercise.
3. "Add exercise" appends another exercise block (starting with one empty set row).
4. "Save workout" validates: module name non-empty, every exercise has a non-empty name and at least one set with reps > 0. On success, calls `addWorkoutSession`, prepends the new session to the displayed log, and resets the form to one empty exercise/one empty set.

**Log list rendering** — branches per entry via `isLegacyWorkoutEntry`:
- `WorkoutSession`: module name as a heading, then for each exercise its name followed by one line per set (`Set {n} – {reps} reps – {weightKg} kg`).
- `LegacyWorkoutLogEntry`: unchanged current rendering (`date — exercise (detail)`).

The punch-in button and tutorial storyboard are unaffected; the tutorial copy for `workout-form` (`src/tutorials/tutorialContent.ts`) needs a one-line update since it currently says "Add an exercise and detail... to keep a history," which no longer matches the new form.

## Testing

- `src/domains/workout/workoutApi.test.ts`: `addWorkoutSession` writes the nested session shape; `listWorkoutLogEntries` returns a mix of legacy and session docs unchanged.
- `src/domains/shared/types.ts` guard: unit test for `isLegacyWorkoutEntry` on both shapes (co-located with an existing shared test file, or a new `types.test.ts` if none exists).
- `src/domains/workout/WorkoutScreen.test.tsx`: building a session (module name, exercise, multiple sets) and saving calls `addWorkoutSession` with the right shape; validation blocks save when module name or an exercise name/sets are missing; a legacy entry in the list still renders in the old format; a session entry renders grouped by exercise and set.

## Out of scope

- Any migration or bulk-edit of existing legacy entries.
- Exercise name autocomplete/library, rest timers, PR tracking, or charts — pure structural/display change only.
- Editing or deleting a previously saved session (today's screen has no edit/delete for log entries either — out of scope to add here).
