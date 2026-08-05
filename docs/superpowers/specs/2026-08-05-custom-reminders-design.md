# Custom reminders — design

## Context

Testing feedback asked for a "Custom Reminders" feature: user-created reminders for personal habits (reading, studying, drinking water, medication, any custom activity), each firing a notification at a scheduled time.

This is a personal single-user app. The existing notification infrastructure (background push worker with high-priority FCM, foreground `setTimeout` scheduler) already handles four fixed built-in reminders (workout, dinner, learning, weekly review); this feature generalizes that to an arbitrary, user-managed list, and — per explicit decision below — integrates with the dashboard the same way Chores does.

Decisions made during brainstorming:
- **Placement:** a new domain screen (`/reminders`, sidebar entry), not a Settings sub-section — matches the existing one-screen-per-domain pattern (Chores, Goals, etc.).
- **Recurrence:** each reminder is daily or on specific weekdays (same model as `ChoreConfig`), not just daily-only.
- **Delivery:** both the background push worker and the foreground scheduler get made dynamic, not push-only — matching how the existing four built-in reminders already work on both paths.
- **Dashboard integration:** custom reminders participate in "Due now" and day health %, the same way Chores do. They do **not** affect the streak counter (which today is workout+learning only; chores don't affect it either).
- **Deletion:** the Reminders screen gets a working Remove button, even though the existing Chores screen doesn't expose one in its UI (its API supports delete; the UI just never wired it) — reminders are more likely to need retiring (e.g., "stop the medication reminder").

## Data model

`src/domains/shared/types.ts`:

```typescript
export interface CustomReminder {
  id: string;
  label: string;
  time: string; // "HH:MM", interpreted in the reminder-config timezone, same as workoutTime etc.
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[]; // 0 (Sun) .. 6 (Sat); present only when cadence === 'weekly'
}
```

- `DailyCompletion` gains `reminders: Record<string, boolean>`, parallel to the existing `chores: Record<string, boolean>`.
- `DomainKey` gains `'reminders'`, so `DueItem.domain` can reference it.
- `TutorialScreenKey` (in `src/tutorials/types.ts`) gains `'reminders'`.

## CRUD API — `src/domains/reminders/remindersApi.ts` (new)

Mirrors `src/domains/chores/choresApi.ts` exactly, at `users/{uid}/customReminders/{id}`:

```typescript
export async function listCustomReminders(uid: string): Promise<CustomReminder[]>;
export async function saveCustomReminder(uid: string, reminder: CustomReminder): Promise<void>;
export async function deleteCustomReminder(uid: string, id: string): Promise<void>;
export function isCustomReminderDueToday(reminder: CustomReminder, dow: number): boolean;
```

`isCustomReminderDueToday` has the same body as `isChoreDueToday`: `cadence === 'daily'` → always true; otherwise `weeklyDays?.includes(dow) ?? false`.

## Completion tracking — `src/domains/shared/completionsApi.ts`

- `getCompletion` defaults `reminders` to `{}` alongside the existing `chores` default.
- New `setReminderDone(uid, reminderId, done, date = todayId())`, same shape as `setChoreDone`:
  ```typescript
  await setDoc(completionDocRef(uid, date), { date, reminders: { [reminderId]: done } }, { merge: true });
  ```

## `RemindersScreen.tsx` (new domain screen)

Structurally mirrors `ChoresScreen.tsx`:
- Lists every saved reminder: checkbox (checked = `completion.reminders[id]`, disabled unless due today), label, time, cadence summary ("Daily" or abbreviated weekday list e.g. "Mon, Wed, Fri"), and a "Remove" button that calls `deleteCustomReminder` and removes it from local state.
- Add form: label text input, `<input type="time">`, a cadence `<select>` (Daily / Specific weekdays). When "Specific weekdays" is selected, seven weekday toggle checkboxes appear (Sun–Sat) to build `weeklyDays`.
- Checking a reminder off calls `setReminderDone(uid, id, checked)` and updates local completion state, exactly like `ChoresScreen.handleToggle`.

## Dashboard integration

`src/dashboard/dashboardLogic.ts`:

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

- `computeDayHealth` signature extends to also take `dueTodayReminderIds: string[]`, folding them into `totalTasks`/`doneTasks` the same way `dueTodayChoreIds` already works: `totalTasks = 2 + dueTodayChoreIds.length + dueTodayReminderIds.length`, `doneTasks` adds `dueTodayReminderIds.filter((id) => completion.reminders[id]).length`.
- `computeDayHealthHistory` takes an additional `reminders: CustomReminder[]` param and, per history day, computes `dueReminderIds` from the *current* reminder list against that day's weekday — the same retroactive-config simplification already used for chores' `computeDayHealthHistory`.

`src/dashboard/useDashboardData.ts`:
- Fetches `listCustomReminders(uid)` alongside the existing `Promise.all([...])` calls.
- `dueItems` gains `...computeReminderDueItems(reminders, completion, dow)`.
- `dayHealth` and `healthHistory` calls pass the new reminders arguments.
- `DashboardData` interface gains `reminders: CustomReminder[]` and `dueTodayReminderIds: string[]`.

`DueNowStrip.tsx` needs no changes — it already renders any `DueItem[]` generically.

## Notification delivery

**Background worker** (`workers/reminders/src/`):
- `reminders.ts` gains a generalized check function:
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
  (`shouldFireDaily`/`shouldFireWeekly` are left as-is — nothing currently depends on merging them, and touching working, tested code for no functional gain isn't worth the risk.)
- `index.ts`, in `runReminderCheckForUser`, after the existing fixed-reminder checks: lists `${base}/customReminders`, and for each reminder fetches `${base}/reminderState/{reminder.id}` (UUID ids can't collide with the fixed keys `workout`/`dinner`/`learning`/`weeklyReview`/`billDue`/`choreDue`), calls `shouldFireCustomReminder`, and on fire pushes a job with `title: 'Reminder'`, `body: reminder.label`. Uses the same `lastSentDate` patch-on-send/patch-on-no-op bookkeeping as the existing bill/chore checks.

**Foreground scheduler** (`src/notifications/useLocalReminderScheduler.ts`):
- After scheduling the existing fixed `LOCAL_REMINDERS`, also calls `listCustomReminders(uid)`, filters to today's due reminders (`isCustomReminderDueToday`), and schedules a `setTimeout` per reminder using the reminder's own `id` in the `shownKey` (instead of a fixed key string), with `title: 'Reminder'` / `body: reminder.label`, reusing the existing `todayFireTime` helper.

## Wiring

- `src/components/Sidebar.tsx`: new nav entry `{ path: '/reminders', label: 'Reminders', color: '#<new-color>' }`.
- `src/App.tsx`: new route `<Route path="/reminders" element={<RemindersScreen uid={uid} />} />`.
- `src/tutorials/types.ts`: add `'reminders'` to `TutorialScreenKey` and `TUTORIAL_SCREEN_KEYS`.
- `src/tutorials/tutorialContent.ts`: add a `reminders` tutorial entry (add a reminder, check one off).

## Testing

- `src/domains/reminders/remindersApi.test.ts`: CRUD calls hit the right Firestore paths; `isCustomReminderDueToday` daily/weekly cases (mirrors `choresApi.test.ts`).
- `src/domains/reminders/RemindersScreen.test.tsx`: add a daily reminder, add a weekly reminder (weekday picker), check one off, remove one, due-today disabling.
- `src/domains/shared/completionsApi.test.ts`: `setReminderDone` writes the right merge shape; `getCompletion` defaults `reminders` to `{}`.
- `src/dashboard/dashboardLogic.test.ts`: `computeReminderDueItems`, `computeDayHealth` with reminders folded in, `computeDayHealthHistory` with reminders.
- `src/dashboard/useDashboardData.test.ts`: reminders fetched and wired into `dueItems`/`dayHealth`.
- `workers/reminders/src/reminders.test.ts`: `shouldFireCustomReminder` daily/weekly/window/already-sent cases.
- `workers/reminders/src/index.test.ts`: a due custom reminder triggers a push and sets `lastSentDate`; a not-due one doesn't; multiple custom reminders per user.
- `src/notifications/useLocalReminderScheduler.test.ts`: schedules a timeout for a due-today custom reminder; skips one not due today.

## Out of scope

- Editing an existing reminder's time/cadence/label (today's Chores screen has no edit either — only add/toggle, plus the new remove here). Users can remove and re-add to change one.
- One-time (non-recurring) reminders — daily/weekly-days only, per the recurrence decision.
- Any snooze, re-notify, or missed-reminder catch-up behavior.
