# Weekday-recurring plans + streak points — design

## Context

The user asked for workout exercises (and other pages) to "repeat based on weekdays," matching the recurrence model Chores and Reminders already use (`cadence: 'daily' | 'weekly'` + `weeklyDays?: number[]`, checked against `dayOfWeek(todayId())`).

Investigation found Workout, Learning, Health, and Meals currently have **no** recurrence concept — each is just a dated log entry (`WorkoutSession`, `LearningLogEntry`, `SleepLog`/`WeightEntry`, `MealLog`). Adding weekday repeat to them means introducing a new "planned item" concept per domain, separate from the existing log/history.

Decisions made during brainstorming:
- **Workout plan shape:** a named routine (e.g. "Push Day") containing multiple exercises, not per-exercise weekly days.
- **Pages in scope for recurring plans:** Workout, Learning, Health, Meals. Goals (fixed weekly-review cadence) and Finances (day-of-month billing) are structurally different recurrence shapes and are left untouched — forcing them into `weeklyDays` would be lossy for no benefit.
- **Dashboard integration:** new plans' due-today items fold into the existing day-health % and due-items list, the same way Chores/Reminders do.
- **Completion trigger:** auto-derived, not a manual checkbox — logging *any* entry on a page that day marks *all* of that page's due-today plans complete for that day. No per-plan name-matching.
- **Streak + points, expanded scope:** the user additionally asked for streak points on each task, and confirmed this should cover *all* recurring items in the app — Chores and Reminders (which already exist) as well as the 4 new plan types. Each item gets an all-time point total (+1 per completed due day) and a current streak (consecutive completed due days), computed via **stored running counters** updated at completion time (not recomputed from history), so totals don't degrade as history grows and reads stay cheap.

## Data model (`src/domains/shared/types.ts`)

New recurring-plan types, following the existing `ChoreConfig` shape:

```typescript
export interface WorkoutRoutine {
  id: string;
  name: string; // e.g. "Push Day"
  exercises: { id: string; name: string }[];
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[]; // 0 (Sun) .. 6 (Sat)
  points: number;
  currentStreak: number;
  lastCompletedDate?: string; // 'YYYY-MM-DD'
}

export interface LearningPlan {
  id: string;
  topic: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points: number;
  currentStreak: number;
  lastCompletedDate?: string;
}

export interface HealthPlan {
  id: string;
  label: string; // e.g. "Weigh-in"
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points: number;
  currentStreak: number;
  lastCompletedDate?: string;
}

export interface MealPlan {
  id: string;
  name: string; // e.g. "Grilled chicken"
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
  points: number;
  currentStreak: number;
  lastCompletedDate?: string;
}
```

`ChoreConfig` and `CustomReminder` each gain the same three fields: `points: number`, `currentStreak: number`, `lastCompletedDate?: string`.

## Shared streak logic — `src/domains/shared/streakLogic.ts` (new)

One pure function, used by every domain when an item is completed for a given date:

```typescript
interface StreakFields {
  points: number;
  currentStreak: number;
  lastCompletedDate?: string;
}

export function applyCompletion(
  item: StreakFields & { cadence: 'daily' | 'weekly'; weeklyDays?: number[] },
  completedDate: string, // 'YYYY-MM-DD'
): StreakFields {
  const prevDue = previousDueDateBefore(completedDate, item.cadence, item.weeklyDays);
  const continues = item.lastCompletedDate === prevDue;
  return {
    points: item.points + 1,
    currentStreak: continues ? item.currentStreak + 1 : 1,
    lastCompletedDate: completedDate,
  };
}
```

`previousDueDateBefore(date, cadence, weeklyDays)` walks backwards day-by-day from `date - 1` (bounded, e.g. max 7 days back for weekly cadence since some weekday must match within a week) returning the first date matching the cadence, or `undefined` if none (shouldn't happen for valid `weeklyDays`).

Idempotency: callers must only invoke `applyCompletion` once per item per date — guarded by checking `item.lastCompletedDate !== completedDate` before calling (prevents double-counting points from e.g. re-logging the same day, or toggling a chore off and back on).

Un-completing (unchecking a chore) does **not** call any reverse of `applyCompletion` — it only flips today's `DailyCompletion` flag back to false. Points/streak already awarded are not rewound. This matches the existing simplicity of `DailyCompletion` (a same-day log, not an editable ledger) and avoids needing a full undo/replay model.

## Persistence & due-today logic

New Firestore collections, mirroring `choresApi.ts`, each at `users/{uid}/<collection>`:
- `workoutRoutines`
- `learningPlans`
- `healthPlans`
- `mealPlans`

Each gets an API module (`workoutRoutinesApi.ts`, `learningPlansApi.ts`, `healthPlansApi.ts`, `mealPlansApi.ts`) with:
```typescript
export async function listX(uid: string): Promise<X[]>;
export async function saveX(uid: string, item: X): Promise<void>;
export async function deleteX(uid: string, id: string): Promise<void>;
export function isXDueToday(item: X, dow: number): boolean; // same body as isChoreDueToday
```

New items are created with `points: 0, currentStreak: 0, lastCompletedDate: undefined`.

## Completion wiring

**Chores/Reminders** (`completionsApi.ts`): `setChoreDone`/`setReminderDone`, when `done === true`, additionally load the chore/reminder, call `applyCompletion(chore, date)` if `chore.lastCompletedDate !== date`, and `saveChore`/`saveCustomReminder` the updated fields alongside the existing `DailyCompletion` write. When `done === false`, only the `DailyCompletion` flag is written — no streak change, per the decision above.

**New plans:** after a domain's log-write function succeeds (`addWorkoutSession`, the learning log entry save, `addSleepLog`/`addWeightEntry`, `addMealLog`), that same function also:
1. Lists the domain's plans, filters to those due today (`isXDueToday(item, dow)`).
2. For each due plan where `lastCompletedDate !== today`, calls `applyCompletion(plan, today)` and persists it.

This keeps completion detection local to each domain's existing write path — no new cross-domain listener or batch job.

## UI

Each of the 4 screens (`WorkoutScreen.tsx`, `LearningScreen.tsx`, `HealthScreen.tsx`, `MealsScreen.tsx`) gains a "Routines/Plans" section above the existing log form:
- List of saved plans: name/topic/label, cadence summary ("Daily" or abbreviated weekday list, e.g. "Mon, Wed, Fri"), a due-today badge, `🔥 currentStreak · points pts`, and a Remove button.
- Add form: name/topic/label input (+ exercise list sub-form for Workout: add/remove `{ name }` rows; + a meal-type `<select>` for Meals), and a weekday picker.
- **`WeekdayPicker`** — new shared component (`src/domains/shared/WeekdayPicker.tsx`), extracted since no reusable one currently exists (Reminders inlines its own checkbox row; Chores has none). Props: `value: number[]`, `onChange: (days: number[]) => void`. Used by the 4 new forms. `RemindersScreen.tsx` is *not* refactored to use it in this pass — out of scope, avoids touching a just-shipped, tested screen for a cosmetic win.

Existing Chores/Reminders item rows also get the `🔥 currentStreak · points pts` badge added next to each item.

## Dashboard integration

`src/dashboard/dashboardLogic.ts`:
- Four new functions mirroring `computeReminderDueItems`: `computeWorkoutDueItems`, `computeLearningDueItems`, `computeHealthDueItems`, `computeMealDueItems` — each takes `(plans, hasLoggedToday: boolean, dow)` and returns `DueItem[]` for plans due today where `!hasLoggedToday`. `hasLoggedToday` is computed by the caller as `logs.some(e => e.date === todayId())` for that domain's log list.
- `computeDayHealth`'s signature currently takes `dueTodayChoreIds` and `dueTodayReminderIds` as separate positional array params, each checked against `DailyCompletion`'s per-item maps for done-ness. The 4 new plan domains don't fit that shape directly: completion there is page-level (one `hasLoggedToday` boolean shared by every due plan on that page that day), not per-item. Rather than bolt on 4 more per-item-map params, `computeDayHealth` keeps its existing `dueTodayChoreIds`/`dueTodayReminderIds` params unchanged, and gains one new param for the new domains:
  ```typescript
  export function computeDayHealth(
    completion: DailyCompletion,
    dueTodayChoreIds: string[],
    dueTodayReminderIds: string[],
    dueTodayPlanDomains: { domain: string; ids: string[]; done: boolean }[] = [],
  ): number
  ```
  `totalTasks` adds `ids.length` per domain in `dueTodayPlanDomains`; `doneTasks` adds `ids.length` for each domain where `done` is `true`, `0` otherwise — since within one domain, a given day's due plans are either all completed (page was logged) or all not (page wasn't).
- `useDashboardData.ts`: fetches the 4 new plan lists and log lists alongside existing `Promise.all([...])` calls, computes `hasLoggedToday` per domain, builds `dueTodayPlanDomains`, and passes it into `computeDayHealth` and folds the four `computeXDueItems(...)` results into `dueItems`.

Total points across all items is **not** surfaced on the dashboard in this pass — out of scope (see below).

## Testing

- `streakLogic.test.ts`: `applyCompletion` — first-ever completion, continuing streak (daily), continuing streak (weekly, correct prior weekday), broken streak (gap), idempotency guard behavior at call sites.
- `workoutRoutinesApi.test.ts` / `learningPlansApi.test.ts` / `healthPlansApi.test.ts` / `mealPlansApi.test.ts`: CRUD paths, `isXDueToday` daily/weekly cases (mirrors `choresApi.test.ts`).
- `WeekdayPicker.test.tsx`: toggling days updates `value` correctly.
- Screen tests for the 4 domains: add a plan (with weekday picker, and exercise sub-rows for Workout), due-today badge rendering, streak/points badge rendering, remove a plan, logging an entry marks due plans complete and awards points/streak.
- `completionsApi.test.ts`: `setChoreDone`/`setReminderDone` update `points`/`currentStreak`/`lastCompletedDate` on completion, don't change them on un-completion.
- `dashboardLogic.test.ts`: the 4 new `computeXDueItems` functions; `computeDayHealth` with `dueTodayPlanDomains` folded in.
- `useDashboardData.test.ts`: new plan/log fetches wired into `dueItems`/`dayHealth`.

## Out of scope

- Editing an existing plan's name/days/exercises (add + remove only, consistent with Chores).
- Per-plan name-matching for completion (any log entry on the page completes all due plans that day, per the decision above).
- Retroactively awarding points/streaks for past history — counters start at 0 for existing Chores/Reminders and new plans; no backfill from `listRecentCompletions` history.
- A total-points dashboard tile or any leaderboard/achievement layer beyond the per-item badge.
- Unifying Goals' weekly-review cadence or Finances' day-of-month billing into this model.
- Extracting `WeekdayPicker` into `RemindersScreen.tsx`'s existing inline implementation.
