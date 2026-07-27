# Back navigation, breadcrumbs, and first-time tutorials

## Problem

The app has no way to navigate back from a domain screen except the "Settings" or "Sign out" buttons in the global header (there's no way back to the Dashboard from a domain screen at all). New users also land on each screen with no explanation of what it does or how to use its features.

## Scope

- 7 domain screens (Workout, Learning, Chores, Finances, Meals, Health, Goals) + Settings get a back arrow and breadcrumb.
- Dashboard gets neither (it's the root of the app).
- All 9 screens (the 8 above + Dashboard) get a first-time tutorial storyboard.
- Settings gets a "Replay all tutorials" button.

## 1. Data model

New Firestore doc `users/{uid}/config/tutorials`, mirroring the existing `users/{uid}/config/reminders` pattern (see `src/domains/settings/reminderConfigApi.ts`):

```ts
type TutorialFlags = Record<TutorialScreenKey, boolean>; // true = seen

type TutorialScreenKey =
  | 'dashboard' | 'workout' | 'learning' | 'chores'
  | 'finances' | 'meals' | 'health' | 'goals' | 'settings';
```

New `src/tutorials/tutorialFlagsApi.ts`:
- `getTutorialFlags(uid): Promise<TutorialFlags>` — reads the doc, defaults every key to `false` if the doc or a key is missing.
- `markTutorialSeen(uid, key): Promise<void>` — merge-sets `{ [key]: true }`.
- `resetAllTutorialFlags(uid): Promise<void>` — merge-sets every key to `false`.

## 2. Back arrow + breadcrumb

New `src/components/ScreenHeader.tsx`:

```tsx
<ScreenHeader label="Workout" />
```

- Uses `useNavigate()` from `react-router-dom` internally (same hook already used in `App.tsx`), so no prop drilling is needed through `App.tsx`.
- Renders a back arrow button (`navigate('/')`) and a breadcrumb `Home / {label}`, where "Home" is also a clickable link to `/`.
- Replaces the existing bare `<h1>{label}</h1>` at the top of each of the 7 domain screens and `SettingsScreen` — the `label` prop supplies the `<h1>` text so there's one visible heading, not two.
- Not added to `Dashboard.tsx`.

## 3. Tutorial storyboards

**Content** — `src/tutorials/tutorialContent.ts`: a `Record<TutorialScreenKey, TutorialStep[]>` where `TutorialStep = { title: string; body: string }`. Steps are written from each screen's actual features:

- **Dashboard**: activity rings & day health %, streak, trend chart, consistency heatmap, tapping a domain row to open it, "Due now" strip.
- **Workout**: tap Punch In to mark today's workout done; log an exercise + detail (e.g. "3x10" or "30 min") to keep history.
- **Learning**: tap Punch In to mark today's learning done; add a note on what you studied.
- **Chores**: check off chores due today; add a new recurring chore.
- **Finances**: log a transaction (amount, category, income/expense); set a monthly budget per category and watch the bar fill; add a bill with its due day to get a "Due today" flag.
- **Meals**: check off grocery items as you buy them; add new items to the list; log what you ate today.
- **Health**: save tonight's bedtime/wake time to track sleep duration; log your weight to see the change since last entry.
- **Goals**: add a goal with a target date and comma-separated milestones; check off milestones as you complete them; fill out the weekly review (what went well / badly / focus next) when it's due.
- **Settings**: set reminder times for workout/dinner/learning/weekly review; replay tutorials from here any time.

**Hook** — `src/tutorials/useTutorial.ts`:

```ts
function useTutorial(uid: string, screenKey: TutorialScreenKey): { isOpen: boolean; dismiss: () => void }
```

On mount, calls `getTutorialFlags(uid)`; if the flag for `screenKey` is `false`, sets `isOpen = true`. `dismiss()` calls `markTutorialSeen(uid, screenKey)` and sets `isOpen = false`.

**Component** — `src/tutorials/TutorialStoryboard.tsx`:

```tsx
<TutorialStoryboard title="Workout" steps={tutorialContent.workout} onDismiss={tutorial.dismiss} />
```

A centered modal: step counter + dots, title, body text, Back/Next buttons, a Skip button (dismisses immediately), and on the last step, Next becomes "Got it" (dismisses).

**Wiring**: each of the 9 screens adds:
```tsx
const tutorial = useTutorial(uid, 'workout');
// ...
{tutorial.isOpen && (
  <TutorialStoryboard title="Workout" steps={tutorialContent.workout} onDismiss={tutorial.dismiss} />
)}
```

## 4. Settings — replay all

`SettingsScreen` gets a new section with a single "Replay all tutorials" button that calls `resetAllTutorialFlags(uid)` and shows a confirmation message: "Tutorials will show again next time you visit each screen." (Per the chosen option, tutorials reappear on next visit to each screen rather than opening immediately.)

## 5. Testing

- `tutorialFlagsApi.test.ts` — mocked Firestore, same style as `useAuth.test.ts`: default flags, marking one seen, resetting all.
- `useTutorial.test.ts` (or folded into a component test) — opens when flag is unseen, stays closed when seen, calls `markTutorialSeen` on dismiss.
- `ScreenHeader.test.tsx` — back arrow and "Home" breadcrumb both navigate to `/`.
- `TutorialStoryboard.test.tsx` — step advancement, Skip, and final-step dismiss all call `onDismiss` appropriately.
- Existing screen tests (`Dashboard.test.tsx`, etc.) updated where they assert on the removed bare `<h1>` or need the new tutorial/header wiring mocked.

## Non-goals

- No coach-mark/tooltip-anchored tutorial style (modal carousel only, per decision).
- No per-tutorial replay buttons in Settings (single "replay all" button, per decision).
- No breadcrumb/tutorial changes to the global header (Settings/Sign out buttons in `App.tsx` are untouched).
