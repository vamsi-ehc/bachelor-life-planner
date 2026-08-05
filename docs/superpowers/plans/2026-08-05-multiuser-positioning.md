# Multiuser Positioning & Account Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe Punch In from "single-user personal app" to "many isolated private accounts," and ship the account-lifecycle features that framing requires: visible signed-in email, self-service per-domain CSV export, a discoverable account-deletion request, and a reminders Worker that stays healthy as the user count grows past a handful.

**Architecture:** No new backend services. Docs/marketing copy get reworded. The Settings screen gains an "Account" section that reads already-authenticated state and calls existing (plus a few new) Firestore read functions, piping results through a small client-side CSV serializer — everything runs in the browser, no new endpoints. The reminders Worker's existing per-user loop is restructured into bounded-concurrency batches instead of one sequential loop, with no change to per-user logic.

**Tech Stack:** React + TypeScript, Firebase Firestore + Auth (client SDK), Cloudflare Worker (`workers/reminders`), Vitest.

## Global Constraints

- No new npm dependencies in either the frontend or `workers/reminders` — CSV serialization and batching are implemented with plain JS/TS, no libraries.
- No social/comparison features, no shared/household data — every change here keeps each account's data fully isolated (per the approved design spec's explicit scope).
- **Prerequisite:** run `docs/superpowers/plans/2026-08-05-finances-credit-debit-ledger.md` before this plan. Task 5 of this plan edits `src/domains/finances/transactionsApi.ts` on top of that plan's `decodeTransaction`/debit-credit refactor — if run out of order, Task 5's code below won't match the file's actual contents.
- Run `npx vitest run <file>` after each task's implementation step; run the full suite (`npm test`) before the final commit of the plan. For `workers/reminders`, tests run from that directory: `cd workers/reminders && npx vitest run <file>`.

---

### Task 1: Reframe docs and legal copy as multiuser

**Files:**
- Modify: `docs/superpowers/specs/2026-07-20-punch-in-complete-app-design.md:9`
- Modify: `docs/superpowers/specs/2026-07-20-punch-in-complete-app-design.md:111`
- Modify: `docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md:22`
- Modify: `src/marketing/TermsOfService.tsx:14`
- Modify: `vite.config.ts` (PWA manifest `description` field)

**Interfaces:** None — pure text changes, no code consumed or produced.

- [ ] **Step 1: Update the complete-app-design doc**

In `docs/superpowers/specs/2026-07-20-punch-in-complete-app-design.md:9`, replace:

```
**Punch In** is a single-user life planner (with email login for cross-device access) covering 7 domains: Workout, Learning, Chores, Finances, Meals & Groceries, Sleep & Health, Goals & Journaling.
```

with:

```
**Punch In** is a life planner covering 7 domains: Workout, Learning, Chores, Finances, Meals & Groceries, Sleep & Health, Goals & Journaling. Any Google account can sign in and gets a fully isolated, private planner instance — no shared or social data between accounts.
```

At line 111, replace:

```
Firebase Auth, email/password (or magic link — decided at build time). One user account; all 7 domains' data scoped under that `uid`; accessible from any device signed in.
```

with:

```
Firebase Auth, Google Sign-In. Any signed-in Google account gets its own account; all 7 domains' data scoped under that account's `uid`; accessible from any device signed in with that account. Firestore security rules ensure no account can read or write another account's data.
```

- [ ] **Step 2: Update the Google Sign-In / Worker design doc**

In `docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md:22`, replace:

```
**Not in scope:** migrating data from the old email/password UID to whatever new UID Google sign-in creates. This is a single-user personal app; the user will re-do Settings + notification permission grant once, under the new account, same as after the last UID change.
```

with:

```
**Not in scope:** migrating data from the old email/password UID to whatever new UID Google sign-in creates. The developer's own account (this doc's author) will re-do Settings + notification permission grant once, under the new account, same as after the last UID change.
```

- [ ] **Step 3: Reword the Terms of Service**

In `src/marketing/TermsOfService.tsx:14`, replace:

```typescript
          Punch In is a personal life-tracking app covering workouts, learning, chores, finances, meals,
          health, and goals. It is provided by an individual developer, not a registered company.
```

with:

```typescript
          Punch In is a life-tracking app for individual users, covering workouts, learning, chores,
          finances, meals, health, and goals. It is operated by an individual developer, not a registered
          company.
```

- [ ] **Step 4: Reword the PWA manifest description**

In `vite.config.ts`, inside the `VitePWA({ manifest: { ... } })` block, replace:

```typescript
        description:
          'A single-user life planner covering workouts, learning, chores, finances, meals, health, and goals.',
```

with:

```typescript
        description:
          'A life planner covering workouts, learning, chores, finances, meals, health, and goals.',
```

- [ ] **Step 5: Verify the existing ToS test still passes**

Run: `npx vitest run src/marketing/TermsOfService.test.tsx`
Expected: PASS — the test only checks for generic section headings and the contact email via regex, not the exact "personal"/"single-user" wording, so no test file changes are needed.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-punch-in-complete-app-design.md docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md src/marketing/TermsOfService.tsx vite.config.ts
git commit -m "docs: reframe Punch In as multiuser (isolated accounts) instead of single-user"
```

---

### Task 2: Rewrite the homepage's public/social narrative

**Files:**
- Modify: `src/marketing/Home.tsx`

**Interfaces:** None — this is a self-contained presentational component; no other file imports its internals (`SQUAD`, `PUBLIC_DOMAINS`, etc. are module-private).

- [ ] **Step 1: Run the existing Home test to confirm the baseline passes**

Run: `npx vitest run src/marketing/Home.test.tsx`
Expected: PASS (current baseline, before edits).

- [ ] **Step 2: Rewrite `Home.tsx`**

Replace the full contents of `src/marketing/Home.tsx`:

```typescript
// src/marketing/Home.tsx
import { motion, MotionConfig, Variants } from 'motion/react';
import { Login } from '../auth/Login';
import { ActivityRings, RingSegment } from '../components/ActivityRings';
import { PunchStrip, buildPunchDays } from '../components/PunchStrip';
import { TrendChart } from '../dashboard/TrendChart';
import { ConsistencyHeatmap } from '../dashboard/ConsistencyHeatmap';
import { DayHealthPoint } from '../dashboard/dashboardLogic';
import { Footer } from './Footer';

const DEMO_RINGS: RingSegment[] = [
  { key: 'workout', color: '#C4502D', fraction: 1 },
  { key: 'learning', color: '#2E6E9E', fraction: 1 },
  { key: 'chores', color: '#A8842A', fraction: 0.66 },
  { key: 'finances', color: '#2E7A54', fraction: 0 },
  { key: 'meals', color: '#B4527E', fraction: 1 },
  { key: 'health', color: '#2E8E88', fraction: 0 },
  { key: 'goals', color: '#6C5DA0', fraction: 0.5 },
];

const DEMO_TREND = [48, 52, 55, 50, 61, 58, 64, 60, 67, 63, 70, 66, 74, 71];
const DEMO_PUNCH_DAYS = buildPunchDays(6, 14);

const DEMO_HEATMAP_VALUES = [
  0, 0, 40, 80, 40, 0, 100, 0, 40, 80, 80, 100, 40, 0, 40, 80, 100, 80, 40, 0, 80, 80, 100, 80, 40, 0, 40, 100, 100,
  80, 40, 80, 100, 80, 40, 80, 40, 0, 100, 80, 100, 80, 40, 0, 80, 40, 80, 100, 80, 40, 80, 100, 100, 80, 100, 80,
  100, 80, 100, 100, 80, 100, 100, 80, 100, 100, 100, 80, 100, 100,
];

function buildDemoHistory(): DayHealthPoint[] {
  const today = new Date();
  return DEMO_HEATMAP_VALUES.map((value, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (DEMO_HEATMAP_VALUES.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), value };
  });
}

const DEMO_HISTORY = buildDemoHistory();

const DOMAINS = [
  { name: 'Workout', color: '#C4502D' },
  { name: 'Learning', color: '#2E6E9E' },
  { name: 'Chores', color: '#A8842A' },
  { name: 'Finances', color: '#2E7A54' },
  { name: 'Meals', color: '#B4527E' },
  { name: 'Health', color: '#2E8E88' },
  { name: 'Goals', color: '#6C5DA0' },
];

const STEPS = [
  { title: 'Sign in with Google', body: 'One account, no new password to remember.' },
  { title: 'Pick your domains', body: 'Turn on the parts of your day you actually want tracked.' },
  { title: 'Watch the strip fill in', body: 'Streaks, trend, and heatmap build up one day at a time.' },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-4 sm:px-6 xl:px-10 py-5 border-b border-line motion-safe:animate-rise-in">
          <div className="font-display font-bold text-lg tracking-tight">
            Punch<span className="text-primary">·</span>In
          </div>
          <div className="font-mono text-[11px] text-muted uppercase tracking-wide hidden sm:block">
            Life planner
          </div>
        </header>

        {/* Hero: asymmetric split */}
        <section className="grid md:grid-cols-2 gap-10 xl:gap-16 px-4 sm:px-6 xl:px-10 pt-10 xl:pt-16 pb-8 items-center">
          <div className="max-w-xl">
            <h1
              className="font-display font-bold text-3xl sm:text-4xl leading-tight motion-safe:animate-rise-in"
              style={{ animationDelay: '0.1s' }}
            >
              Punch in daily. Let your streak do the talking.
            </h1>
            <p
              className="mt-4 text-sm xl:text-base text-muted leading-relaxed motion-safe:animate-rise-in"
              style={{ animationDelay: '0.2s' }}
            >
              Track workouts, learning, chores, finances, meals, health, and goals in one place. Your data
              stays private to your own account, always.
            </p>

            <div className="mt-8">
              <div className="font-mono text-[10.5px] tracking-widest uppercase text-muted">Day 7 of 14</div>
              <PunchStrip days={DEMO_PUNCH_DAYS} className="mt-3" />
            </div>

            <motion.div className="mt-6 inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Login />
            </motion.div>
          </div>

          <div className="relative flex justify-center motion-safe:animate-rise-in" style={{ animationDelay: '0.3s' }}>
            <div className="motion-safe:animate-float">
              <ActivityRings segments={DEMO_RINGS} className="w-[190px] h-[190px] xl:w-[240px] xl:h-[240px]" />
            </div>
            <div
              className="absolute -top-2 right-2 xl:right-8 flex items-center gap-1.5 bg-card border border-line rounded-full px-3 py-1.5 shadow-sm motion-safe:animate-pop-in"
              style={{ animationDelay: '0.9s' }}
            >
              <span className="text-sm">🔥</span>
              <span className="font-mono text-xs font-semibold">6-day streak</span>
            </div>
          </div>
        </section>

        {/* Why: editorial manifesto, offset, no card */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
        >
          <div className="max-w-2xl lg:ml-[10%]">
            <h2 className="font-display font-semibold text-2xl sm:text-3xl leading-snug">
              You've quit habit trackers before. Most ask for more than they give back.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
              A tracker that takes five minutes to log and shows nothing back gets abandoned fast. The ones
              that stick give you something to look at — a streak, a trend, a full week you can actually see.
            </p>
            <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
              Punch In is built around that. Track seven parts of your life in one place, punch in once a
              day, and watch the rings, trend, and heatmap fill in.
            </p>
          </div>
        </motion.section>

        {/* Domains: bento, single list */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <h2 className="font-display font-semibold text-xl sm:text-2xl max-w-2xl">
            Seven domains, one dashboard.
          </h2>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Workout, Learning, Chores, Finances, Meals, Health, Goals — each gets its own screen, all of it
            private to your account.
          </p>

          <div className="mt-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <motion.div variants={fadeUp} className="rounded-2xl p-5 sm:p-6 bg-card border border-line">
              <span className="font-mono text-[10.5px] tracking-widest uppercase text-muted">
                Always private, always yours
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {DOMAINS.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 px-3 py-2 rounded-full bg-paper">
                    <span className="w-2 h-2 rounded-full flex-none" style={{ background: d.color }} />
                    <span className="text-sm font-medium">{d.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="rounded-2xl p-6 sm:p-8 bg-ink text-paper flex flex-col items-center justify-center text-center"
            >
              <ActivityRings segments={DEMO_RINGS} className="w-[150px] h-[150px] xl:w-[190px] xl:h-[190px]" />
              <h3 className="mt-5 font-display font-semibold text-base">Today, at a glance</h3>
              <p className="mt-1 text-sm text-paper/70 leading-relaxed max-w-xs">
                Seven domains, one ring each. Fill them in and the rest of the day feels lighter.
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* Proof: split, tinted panels, no card border */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <div className="grid lg:grid-cols-2 gap-4">
            <motion.div variants={fadeUp} className="rounded-2xl p-6 sm:p-8 bg-primary-dim">
              <h3 className="font-display font-semibold text-base sm:text-lg">The trend doesn't lie</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Fourteen days of your day-health score, so a good stretch is something you can actually see.
              </p>
              <div className="mt-4">
                <TrendChart values={DEMO_TREND} />
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl p-6 sm:p-8 bg-[#E9F4F1]">
              <h3 className="font-display font-semibold text-base sm:text-lg">Consistency you can point to</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Ten weeks of punches, mapped out like a punch card.
              </p>
              <div className="mt-4 overflow-x-auto">
                <ConsistencyHeatmap points={DEMO_HISTORY} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* How it works: horizontal scroll-snap */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <h2 className="font-display font-semibold text-xl sm:text-2xl">
            Four minutes to your first punch, no sixth tracker required
          </h2>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:overflow-visible">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                className="snap-start shrink-0 w-64 lg:w-auto rounded-2xl border border-line bg-card p-5"
              >
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <h3 className="mt-2 font-display font-semibold text-sm">{step.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Trust: calm, full-width statement */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-14 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
        >
          <h2 className="font-display font-semibold text-xl sm:text-2xl max-w-2xl">
            Your data stays yours. No exceptions.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed max-w-2xl">
            Your data lives under your own account, and Firestore security rules keep every other account
            out — no one else can read or write your entries. Sign-in uses Google OAuth, so we never see
            your password, and we don't sell your data.{' '}
            <a href="/privacy" className="text-primary underline">
              Read the full Privacy Policy
            </a>
            .
          </p>
        </motion.section>

        <Footer />
      </div>
    </MotionConfig>
  );
}
```

- [ ] **Step 3: Run the test to verify it still passes**

Run: `npx vitest run src/marketing/Home.test.tsx`
Expected: PASS — the h1 text, all 7 domain names, "four minutes to your first punch", "sign in with google", the `/privacy` link, and the mocked `Login` component are all still present; none of the removed sections were covered by assertions.

- [ ] **Step 4: Commit**

```bash
git add src/marketing/Home.tsx
git commit -m "content: rewrite homepage around private tracking, remove unbuilt social/leaderboard narrative"
```

---

### Task 3: Shared CSV export utility

**Files:**
- Create: `src/domains/shared/exportCsv.ts`
- Test: `src/domains/shared/exportCsv.test.ts`

**Interfaces:**
- Produces: `toCsv(rows: Record<string, unknown>[]): string` and `downloadCsv(filename: string, rows: Record<string, unknown>[]): void` — consumed by Task 6 (`SettingsScreen.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/domains/shared/exportCsv.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { toCsv, downloadCsv } from './exportCsv';

describe('toCsv', () => {
  it('returns an empty string for an empty list', () => {
    expect(toCsv([])).toBe('');
  });

  it('builds a header row from the union of all row keys', () => {
    const csv = toCsv([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('a,b,c');
    expect(lines[1]).toBe('1,2,');
    expect(lines[2]).toBe('3,,4');
  });

  it('escapes values containing commas, quotes, or newlines', () => {
    const csv = toCsv([{ note: 'a, "quoted", value\nwith newline' }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('note');
    expect(lines[1]).toBe('"a, ""quoted"", value\nwith newline"');
  });

  it('renders undefined and null values as an empty cell', () => {
    const csv = toCsv([{ a: undefined, b: null }]);
    expect(csv).toBe('a,b\n,');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an object URL, triggers a click, and revokes the URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('test.csv', [{ a: 1 }]);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/shared/exportCsv.test.ts`
Expected: FAIL — `./exportCsv` does not exist yet.

- [ ] **Step 3: Implement `exportCsv.ts`**

Create `src/domains/shared/exportCsv.ts`:

```typescript
function escapeCell(value: unknown): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  return lines.join('\n');
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/shared/exportCsv.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/shared/exportCsv.ts src/domains/shared/exportCsv.test.ts
git commit -m "feat: add shared toCsv/downloadCsv export utility"
```

---

### Task 4: Per-domain export row mappers

**Files:**
- Create: `src/domains/shared/exportRows.ts`
- Test: `src/domains/shared/exportRows.test.ts`

**Interfaces:**
- Consumes: `WorkoutLogEntry`, `LearningLogEntry`, `Transaction`, `MealLog`, `SleepLog`, `WeightEntry`, `Goal`, `isLegacyWorkoutEntry` from `../shared/types`.
- Produces: `workoutLogToRows`, `learningLogToRows`, `transactionsToRows`, `mealLogsToRows`, `sleepLogsToRows`, `weightEntriesToRows`, `goalsToRows` — each `(data) => Record<string, unknown>[]`, consumed by Task 6 (`SettingsScreen.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/domains/shared/exportRows.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  workoutLogToRows,
  learningLogToRows,
  transactionsToRows,
  mealLogsToRows,
  sleepLogsToRows,
  weightEntriesToRows,
  goalsToRows,
} from './exportRows';
import { WorkoutLogEntry, Transaction, MealLog, SleepLog, WeightEntry, Goal } from './types';

describe('workoutLogToRows', () => {
  it('flattens a legacy log entry', () => {
    const entries: WorkoutLogEntry[] = [
      { id: 'w1', date: '2026-07-20', exercise: 'Squat', detail: '3x5 @ 80kg', notes: 'Felt good' },
    ];
    expect(workoutLogToRows(entries)).toEqual([
      { date: '2026-07-20', exercise: 'Squat', detail: '3x5 @ 80kg', notes: 'Felt good' },
    ]);
  });

  it('flattens a structured workout session, serializing exercises as JSON', () => {
    const entries: WorkoutLogEntry[] = [
      {
        id: 'w2',
        date: '2026-07-21',
        moduleName: 'Push day',
        exercises: [{ id: 'e1', name: 'Bench', sets: [{ reps: 5, weightKg: 60 }] }],
      },
    ];
    const rows = workoutLogToRows(entries);
    expect(rows).toEqual([
      {
        date: '2026-07-21',
        moduleName: 'Push day',
        exercises: JSON.stringify([{ id: 'e1', name: 'Bench', sets: [{ reps: 5, weightKg: 60 }] }]),
      },
    ]);
  });
});

describe('learningLogToRows', () => {
  it('maps date and note', () => {
    expect(learningLogToRows([{ id: 'l1', date: '2026-07-20', note: 'Read chapter 3' }])).toEqual([
      { date: '2026-07-20', note: 'Read chapter 3' },
    ]);
  });
});

describe('transactionsToRows', () => {
  it('maps date, type, amount, category, and note', () => {
    const transactions: Transaction[] = [
      { id: 't1', date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'debit', note: 'Weekly shop' },
    ];
    expect(transactionsToRows(transactions)).toEqual([
      { date: '2026-07-20', type: 'debit', amount: 42.5, category: 'Groceries', note: 'Weekly shop' },
    ]);
  });

  it('defaults a missing note to an empty string', () => {
    const transactions: Transaction[] = [
      { id: 't1', date: '2026-07-20', amount: 10, category: 'Misc', type: 'credit' },
    ];
    expect(transactionsToRows(transactions)).toEqual([
      { date: '2026-07-20', type: 'credit', amount: 10, category: 'Misc', note: '' },
    ]);
  });
});

describe('mealLogsToRows', () => {
  it('emits one row per logged entry, keyed by date', () => {
    const logs: MealLog[] = [
      { date: '2026-07-20', entries: ['Oatmeal', 'Salad'] },
      { date: '2026-07-21', entries: ['Toast'] },
    ];
    expect(mealLogsToRows(logs)).toEqual([
      { date: '2026-07-20', entry: 'Oatmeal' },
      { date: '2026-07-20', entry: 'Salad' },
      { date: '2026-07-21', entry: 'Toast' },
    ]);
  });

  it('produces no rows for a day with no entries', () => {
    const logs: MealLog[] = [{ date: '2026-07-20', entries: [] }];
    expect(mealLogsToRows(logs)).toEqual([]);
  });
});

describe('sleepLogsToRows', () => {
  it('maps date, bedtime, and wakeTime', () => {
    const logs: SleepLog[] = [{ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' }];
    expect(sleepLogsToRows(logs)).toEqual([{ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' }]);
  });
});

describe('weightEntriesToRows', () => {
  it('maps date and weightKg', () => {
    const entries: WeightEntry[] = [{ id: 'w1', date: '2026-07-20', weightKg: 78.5 }];
    expect(weightEntriesToRows(entries)).toEqual([{ date: '2026-07-20', weightKg: 78.5 }]);
  });
});

describe('goalsToRows', () => {
  it('joins milestones into a single readable string', () => {
    const goals: Goal[] = [
      {
        id: 'g1',
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: [
          { id: 'm1', label: 'Run 5k', done: true },
          { id: 'm2', label: 'Run 8k', done: false },
        ],
      },
    ];
    expect(goalsToRows(goals)).toEqual([
      {
        title: 'Run a 10k',
        targetDate: '2026-12-01',
        status: 'active',
        milestones: 'Run 5k [done]; Run 8k [open]',
      },
    ]);
  });

  it('renders an empty string for a goal with no milestones', () => {
    const goals: Goal[] = [
      { id: 'g1', title: 'Read 12 books', targetDate: '2026-12-31', status: 'active', milestones: [] },
    ];
    expect(goalsToRows(goals)).toEqual([
      { title: 'Read 12 books', targetDate: '2026-12-31', status: 'active', milestones: '' },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/shared/exportRows.test.ts`
Expected: FAIL — `./exportRows` does not exist yet.

- [ ] **Step 3: Implement `exportRows.ts`**

Create `src/domains/shared/exportRows.ts`:

```typescript
import {
  WorkoutLogEntry,
  LearningLogEntry,
  Transaction,
  MealLog,
  SleepLog,
  WeightEntry,
  Goal,
  isLegacyWorkoutEntry,
} from './types';

export function workoutLogToRows(entries: WorkoutLogEntry[]): Record<string, unknown>[] {
  return entries.map((entry) =>
    isLegacyWorkoutEntry(entry)
      ? { date: entry.date, exercise: entry.exercise, detail: entry.detail, notes: entry.notes ?? '' }
      : { date: entry.date, moduleName: entry.moduleName, exercises: JSON.stringify(entry.exercises) }
  );
}

export function learningLogToRows(entries: LearningLogEntry[]): Record<string, unknown>[] {
  return entries.map((entry) => ({ date: entry.date, note: entry.note }));
}

export function transactionsToRows(transactions: Transaction[]): Record<string, unknown>[] {
  return transactions.map((t) => ({
    date: t.date,
    type: t.type,
    amount: t.amount,
    category: t.category,
    note: t.note ?? '',
  }));
}

export function mealLogsToRows(logs: MealLog[]): Record<string, unknown>[] {
  return logs.flatMap((log) => log.entries.map((entry) => ({ date: log.date, entry })));
}

export function sleepLogsToRows(logs: SleepLog[]): Record<string, unknown>[] {
  return logs.map((log) => ({ date: log.date, bedtime: log.bedtime, wakeTime: log.wakeTime }));
}

export function weightEntriesToRows(entries: WeightEntry[]): Record<string, unknown>[] {
  return entries.map((entry) => ({ date: entry.date, weightKg: entry.weightKg }));
}

export function goalsToRows(goals: Goal[]): Record<string, unknown>[] {
  return goals.map((goal) => ({
    title: goal.title,
    targetDate: goal.targetDate,
    status: goal.status,
    milestones: goal.milestones.map((m) => `${m.label} [${m.done ? 'done' : 'open'}]`).join('; '),
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/shared/exportRows.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/shared/exportRows.ts src/domains/shared/exportRows.test.ts
git commit -m "feat: add per-domain CSV row mappers for data export"
```

---

### Task 5: Add missing "list all history" query functions

**Files:**
- Modify: `src/domains/finances/transactionsApi.ts`
- Test: `src/domains/finances/transactionsApi.test.ts`
- Modify: `src/domains/meals/mealLogApi.ts`
- Test: `src/domains/meals/mealLogApi.test.ts`
- Modify: `src/domains/health/sleepApi.ts`
- Test: `src/domains/health/sleepApi.test.ts`

**Interfaces:**
- Produces: `listAllTransactions(uid: string): Promise<Transaction[]>`, `listAllMealLogs(uid: string): Promise<MealLog[]>`, `listAllSleepLogs(uid: string): Promise<SleepLog[]>` — all three consumed by Task 6 (`SettingsScreen.tsx`).
- Consumes: this task assumes `src/domains/finances/transactionsApi.ts` is already in the post-rename state left by `docs/superpowers/plans/2026-08-05-finances-credit-debit-ledger.md` (a `decodeTransaction` helper, `Transaction.type: 'debit' | 'credit'`). See this plan's Global Constraints.

- [ ] **Step 1: Write the failing tests**

Add to the end of `src/domains/finances/transactionsApi.test.ts` (inside the existing `describe('transactionsApi', ...)` block, alongside the other `it(...)` calls — import `listAllTransactions` in the existing `import { addTransaction, listTransactionsForMonth } from './transactionsApi';` line, changing it to `import { addTransaction, listTransactionsForMonth, listAllTransactions } from './transactionsApi';`):

```typescript
  it('listAllTransactions maps docs to Transaction objects with no date filter', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'tx1', data: () => ({ date: '2026-01-05', amount: 10, category: 'Old', type: 'debit' }) },
        { id: 'tx2', data: () => ({ date: '2026-07-20', amount: 500, category: 'Salary', type: 'credit' }) },
      ],
    });
    const result = await listAllTransactions('user1');
    expect(result).toEqual([
      { id: 'tx1', date: '2026-01-05', amount: 10, category: 'Old', type: 'debit' },
      { id: 'tx2', date: '2026-07-20', amount: 500, category: 'Salary', type: 'credit' },
    ]);
    expect(mockWhere).not.toHaveBeenCalled();
  });
```

Add to the end of `src/domains/meals/mealLogApi.test.ts` (inside `describe('mealLogApi', ...)`, changing the import line to `import { getMealLog, addMealEntry, listAllMealLogs } from './mealLogApi';`, and adding `collection`, `query`, `orderBy`, `getDocs` to the mocked `firebase/firestore` module at the top of the file):

```typescript
  it('listAllMealLogs maps every dated doc to a MealLog', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: '2026-07-21', data: () => ({ date: '2026-07-21', entries: ['Toast'] }) },
        { id: '2026-07-20', data: () => ({ date: '2026-07-20', entries: ['Oatmeal', 'Salad'] }) },
      ],
    });
    const result = await listAllMealLogs('user1');
    expect(result).toEqual([
      { date: '2026-07-21', entries: ['Toast'] },
      { date: '2026-07-20', entries: ['Oatmeal', 'Salad'] },
    ]);
  });
```

Add to the end of `src/domains/health/sleepApi.test.ts` (inside `describe('getSleepLog', ...)` or as a new top-level `describe('listAllSleepLogs', ...)` block, changing the import line to `import { getSleepLog, saveSleepLog, listAllSleepLogs } from './sleepApi';`, and adding `collection`, `query`, `orderBy`, `getDocs` to the mocked `firebase/firestore` module at the top of the file):

```typescript
describe('listAllSleepLogs', () => {
  it('maps every dated doc to a SleepLog', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: '2026-07-20', data: () => ({ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' }) }],
    });
    const result = await listAllSleepLogs('user1');
    expect(result).toEqual([{ date: '2026-07-20', bedtime: '23:00', wakeTime: '07:00' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domains/finances/transactionsApi.test.ts src/domains/meals/mealLogApi.test.ts src/domains/health/sleepApi.test.ts`
Expected: FAIL — `listAllTransactions`, `listAllMealLogs`, and `listAllSleepLogs` are not exported yet.

- [ ] **Step 3: Add `listAllTransactions`**

In `src/domains/finances/transactionsApi.ts`, add this function after `listTransactionsForMonth`:

```typescript
export async function listAllTransactions(uid: string): Promise<Transaction[]> {
  const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => decodeTransaction(d.id, d.data() as Partial<Omit<Transaction, 'id'>>));
}
```

- [ ] **Step 4: Add `listAllMealLogs`**

Replace the full contents of `src/domains/meals/mealLogApi.ts`:

```typescript
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MealLog } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function mealLogDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'mealLog', date);
}

export async function getMealLog(uid: string, date: string = todayId()): Promise<MealLog> {
  const snap = await getDoc(mealLogDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<MealLog>) : {};
  return { date, entries: Array.isArray(data.entries) ? data.entries : [] };
}

export async function addMealEntry(uid: string, entry: string, date: string = todayId()): Promise<void> {
  const current = await getMealLog(uid, date);
  await setDoc(mealLogDocRef(uid, date), { date, entries: [...current.entries, entry] });
}

export async function listAllMealLogs(uid: string): Promise<MealLog[]> {
  const q = query(collection(db, 'users', uid, 'mealLog'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<MealLog>;
    return { date: data.date ?? d.id, entries: Array.isArray(data.entries) ? data.entries : [] };
  });
}
```

- [ ] **Step 5: Add `listAllSleepLogs`**

Replace the full contents of `src/domains/health/sleepApi.ts`:

```typescript
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
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

export async function listAllSleepLogs(uid: string): Promise<SleepLog[]> {
  const q = query(collection(db, 'users', uid, 'sleepLogs'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<SleepLog>;
    return { date: data.date ?? d.id, bedtime: data.bedtime ?? '', wakeTime: data.wakeTime ?? '' };
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/domains/finances/transactionsApi.test.ts src/domains/meals/mealLogApi.test.ts src/domains/health/sleepApi.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domains/finances/transactionsApi.ts src/domains/finances/transactionsApi.test.ts src/domains/meals/mealLogApi.ts src/domains/meals/mealLogApi.test.ts src/domains/health/sleepApi.ts src/domains/health/sleepApi.test.ts
git commit -m "feat: add list-all-history query functions for transactions, meal log, sleep log"
```

---

### Task 6: Settings — Account section (email, export, deletion request)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/domains/settings/SettingsScreen.tsx`
- Modify: `src/domains/settings/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `downloadCsv` (Task 3), `workoutLogToRows`/`learningLogToRows`/`transactionsToRows`/`mealLogsToRows`/`sleepLogsToRows`/`weightEntriesToRows`/`goalsToRows` (Task 4), `listAllTransactions`/`listAllMealLogs`/`listAllSleepLogs` (Task 5), plus existing `listWorkoutLogEntries` (`../workout/workoutApi`), `listLearningLogEntries` (`../learning/learningApi`), `listWeightEntries` (`../health/weightApi`), `listGoals` (`../goals/goalsApi`).
- Produces: `SettingsScreen({ uid, email }: { uid: string; email: string | null })` — the `email` prop is new; `App.tsx` now passes it from `useAuth()`'s `user.email`.

**Note:** Chores intentionally gets no export button. Chores only has `choresApi.listChores` (recurring chore *definitions*, i.e. setup/config, not a personal history log), and per-chore completion history lives in the shared `completions/{date}` collection, which isn't domain-specific. This matches the approved design decision to export historical logs only, not recurring config — do not add a Chores export button as a "fix."

- [ ] **Step 1: Thread `email` through `App.tsx`**

In `src/App.tsx`, change:

```typescript
function AuthedRoutes({ uid }: { uid: string }) {
```

to:

```typescript
function AuthedRoutes({ uid, email }: { uid: string; email: string | null }) {
```

Change:

```typescript
          <Route path="/settings" element={<SettingsScreen uid={uid} />} />
```

to:

```typescript
          <Route path="/settings" element={<SettingsScreen uid={uid} email={email} />} />
```

Change:

```typescript
      {user ? <AuthedRoutes uid={user.uid} /> : <SignedOutRoutes />}
```

to:

```typescript
      {user ? <AuthedRoutes uid={user.uid} email={user.email} /> : <SignedOutRoutes />}
```

- [ ] **Step 2: Update `App.test.tsx`'s `SettingsScreen` mock and add a coverage test**

In `src/App.test.tsx`, change:

```typescript
vi.mock('./domains/settings/SettingsScreen', () => ({
  SettingsScreen: ({ uid }: { uid: string }) => <div>Settings for {uid}</div>,
}));
```

to:

```typescript
vi.mock('./domains/settings/SettingsScreen', () => ({
  SettingsScreen: ({ uid, email }: { uid: string; email: string | null }) => (
    <div>
      Settings for {uid} ({email})
    </div>
  ),
}));
```

Add this test inside the `describe('App', ...)` block:

```typescript
  it('renders SettingsScreen with the signed-in email at /settings', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1', email: 'user1@example.com' }, loading: false });
    window.history.pushState({}, '', '/settings');
    render(<App />);
    expect(screen.getByText('Settings for user1 (user1@example.com)')).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run `App.test.tsx` to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS — this confirms the prop threading works before touching `SettingsScreen.tsx` itself.

- [ ] **Step 4: Write the failing `SettingsScreen` test additions**

In `src/domains/settings/SettingsScreen.test.tsx`, add these mocks near the top of the file, alongside the existing `vi.mock` calls:

```typescript
const mockListWorkoutLogEntries = vi.fn();
const mockListLearningLogEntries = vi.fn();
const mockListAllTransactions = vi.fn();
const mockListAllMealLogs = vi.fn();
const mockListAllSleepLogs = vi.fn();
const mockListWeightEntries = vi.fn();
const mockListGoals = vi.fn();

vi.mock('../workout/workoutApi', () => ({
  listWorkoutLogEntries: (...args: unknown[]) => mockListWorkoutLogEntries(...args),
}));
vi.mock('../learning/learningApi', () => ({
  listLearningLogEntries: (...args: unknown[]) => mockListLearningLogEntries(...args),
}));
vi.mock('../finances/transactionsApi', () => ({
  listAllTransactions: (...args: unknown[]) => mockListAllTransactions(...args),
}));
vi.mock('../meals/mealLogApi', () => ({
  listAllMealLogs: (...args: unknown[]) => mockListAllMealLogs(...args),
}));
vi.mock('../health/sleepApi', () => ({
  listAllSleepLogs: (...args: unknown[]) => mockListAllSleepLogs(...args),
}));
vi.mock('../health/weightApi', () => ({
  listWeightEntries: (...args: unknown[]) => mockListWeightEntries(...args),
}));
vi.mock('../goals/goalsApi', () => ({
  listGoals: (...args: unknown[]) => mockListGoals(...args),
}));
```

Change `renderScreen` to accept an email:

```typescript
function renderScreen(email: string | null = 'user1@example.com') {
  return render(
    <MemoryRouter>
      <SettingsScreen uid="user1" email={email} />
    </MemoryRouter>
  );
}
```

Add these tests inside the `describe('SettingsScreen', ...)` block, and reset the new mocks in `beforeEach`:

```typescript
  it('shows the signed-in email', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen('user1@example.com');
    expect(await screen.findByText(/user1@example\.com/)).toBeInTheDocument();
  });

  it('exports the workout log as a CSV download', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    mockListWorkoutLogEntries.mockResolvedValue([
      { id: 'w1', date: '2026-07-20', exercise: 'Squat', detail: '3x5', notes: '' },
    ]);
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Workout log' }));

    await waitFor(() => expect(mockListWorkoutLogEntries).toHaveBeenCalledWith('user1'));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('shows an error if an export fails', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    mockListGoals.mockRejectedValue(new Error('Firestore unavailable'));

    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Goals' }));

    expect(await screen.findByText(/Firestore unavailable/)).toBeInTheDocument();
  });

  it('renders a mailto deletion request link addressed with the account email', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen('user1@example.com');
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const link = screen.getByRole('link', { name: 'Request account deletion' });
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:konathalavamsi123@gmail.com'));
    expect(link).toHaveAttribute('href', expect.stringContaining('user1%40example.com'));
  });
```

Also update every other existing `renderScreen()` call in the file to keep working unchanged (the new `email` parameter has a default, so no other call sites need edits).

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: FAIL — `SettingsScreen` doesn't accept an `email` prop yet and has no Account section.

- [ ] **Step 6: Add the Account section to `SettingsScreen.tsx`**

In `src/domains/settings/SettingsScreen.tsx`, update the imports at the top of the file to add:

```typescript
import { listWorkoutLogEntries } from '../workout/workoutApi';
import { listLearningLogEntries } from '../learning/learningApi';
import { listAllTransactions } from '../finances/transactionsApi';
import { listAllMealLogs } from '../meals/mealLogApi';
import { listAllSleepLogs } from '../health/sleepApi';
import { listWeightEntries } from '../health/weightApi';
import { listGoals } from '../goals/goalsApi';
import {
  workoutLogToRows,
  learningLogToRows,
  transactionsToRows,
  mealLogsToRows,
  sleepLogsToRows,
  weightEntriesToRows,
  goalsToRows,
} from '../shared/exportRows';
import { downloadCsv } from '../shared/exportCsv';
```

Change the function signature:

```typescript
export function SettingsScreen({ uid }: { uid: string }) {
```

to:

```typescript
export function SettingsScreen({ uid, email }: { uid: string; email: string | null }) {
```

Add this state declaration alongside the other `useState` calls near the top of the component body:

```typescript
  const [exportError, setExportError] = useState<string | null>(null);
```

Add this handler alongside the other handler functions (`handleSave`, `handleNotificationsToggle`, `handleReplayTutorials`):

```typescript
  async function handleExport(filename: string, fetchRows: () => Promise<Record<string, unknown>[]>) {
    setExportError(null);
    try {
      const rows = await fetchRows();
      downloadCsv(filename, rows);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export data');
    }
  }
```

Add this new section in the JSX, immediately after the closing `</section>` of the "Tutorials" section and before the `{tutorial.isOpen && (...)}` block:

```typescript
      <hr className="border-line" />

      <section id="settings-account" className="flex flex-col gap-3 max-w-sm">
        <p className={sectionLabelClass}>Account</p>
        <p className="text-sm text-muted">Signed in as {email ?? 'unknown'}</p>

        <p className={sectionLabelClass}>Export data</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleExport('workout-log.csv', async () => workoutLogToRows(await listWorkoutLogEntries(uid)))}
          >
            Workout log
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              handleExport('learning-log.csv', async () => learningLogToRows(await listLearningLogEntries(uid)))
            }
          >
            Learning log
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleExport('transactions.csv', async () => transactionsToRows(await listAllTransactions(uid)))}
          >
            Transactions
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleExport('meal-log.csv', async () => mealLogsToRows(await listAllMealLogs(uid)))}
          >
            Meal log
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleExport('sleep-log.csv', async () => sleepLogsToRows(await listAllSleepLogs(uid)))}
          >
            Sleep log
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleExport('weight-log.csv', async () => weightEntriesToRows(await listWeightEntries(uid)))}
          >
            Weight log
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleExport('goals.csv', async () => goalsToRows(await listGoals(uid)))}
          >
            Goals
          </button>
        </div>
        {exportError && <p className="text-sm text-[#B3261E]">{exportError}</p>}

        <p className={sectionLabelClass}>Delete account</p>
        <a
          href={`mailto:konathalavamsi123@gmail.com?subject=${encodeURIComponent(
            'Punch In account deletion request'
          )}&body=${encodeURIComponent(
            `Please delete my Punch In account and all associated data.\n\nAccount email: ${email ?? 'unknown'}`
          )}`}
          className={`${buttonClass} inline-block text-center`}
        >
          Request account deletion
        </a>
      </section>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: PASS

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS — confirms `App.tsx`'s prop threading and the Settings rewrite haven't broken any other screen.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/domains/settings/SettingsScreen.tsx src/domains/settings/SettingsScreen.test.tsx
git commit -m "feat: add Settings Account section (email, per-domain CSV export, deletion request)"
```

---

### Task 7: Reminders Worker — bounded-concurrency batching

**Files:**
- Modify: `workers/reminders/src/index.ts`
- Test: `workers/reminders/src/index.test.ts`
- Modify: `docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md:38`

**Interfaces:**
- Consumes: `runReminderCheckForUser` (unchanged signature, already exported from the same file).
- Produces: `runReminderCheck(env: Env, now?: Date): Promise<void>` — signature unchanged, only its internals change; no other file calls it besides the `scheduled` handler at the bottom of the same file (unchanged).

- [ ] **Step 1: Write the failing test**

Add this test inside `describe('runReminderCheck', ...)` in `workers/reminders/src/index.test.ts`, after the existing "processes the remaining users when one user's check throws" test:

```typescript
  it('processes users in batches of 5 and logs a run summary', async () => {
    const userIds = Array.from({ length: 7 }, (_, i) => `uid${i}`);
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return userIds.map((id) => ({ id, data: {} }));
      if (path.endsWith('/fcmTokens')) return [];
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path.endsWith('/config/reminders')) return defaultConfig;
      return null;
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runReminderCheck(env, new Date('2026-07-23T06:46:00Z'));

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('7 succeeded, 0 failed, 7 total')
    );
    consoleLogSpy.mockRestore();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: FAIL — `runReminderCheck` currently never calls `console.log` with a summary.

- [ ] **Step 3: Implement bounded-concurrency batching**

In `workers/reminders/src/index.ts`, replace:

```typescript
export async function runReminderCheck(env: Env, now: Date = new Date()): Promise<void> {
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY) as ServiceAccountKey;
  const accessToken = await getAccessToken(key, SCOPES);
  const projectId = env.FIREBASE_PROJECT_ID;

  const users = await listDocuments(projectId, accessToken, 'users');

  for (const userDoc of users) {
    try {
      await runReminderCheckForUser(projectId, accessToken, userDoc.id, now);
    } catch (err) {
      console.error(`Reminder check failed for user ${userDoc.id}`, err);
    }
  }
}
```

with:

```typescript
const BATCH_SIZE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function runReminderCheck(env: Env, now: Date = new Date()): Promise<void> {
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY) as ServiceAccountKey;
  const accessToken = await getAccessToken(key, SCOPES);
  const projectId = env.FIREBASE_PROJECT_ID;

  const users = await listDocuments(projectId, accessToken, 'users');

  let succeeded = 0;
  let failed = 0;

  for (const batch of chunk(users, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      batch.map((userDoc) => runReminderCheckForUser(projectId, accessToken, userDoc.id, now))
    );
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeeded += 1;
      } else {
        failed += 1;
        console.error(`Reminder check failed for user ${batch[i].id}`, result.reason);
      }
    });
  }

  console.log(`Reminder check complete: ${succeeded} succeeded, ${failed} failed, ${users.length} total`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: PASS — including the pre-existing "fires a reminder for every user discovered", "does nothing when no users", "sends no pushes for a user who has disabled notifications", and "processes the remaining users when one user's check throws" tests, which exercise the same code path and must keep passing unchanged.

- [ ] **Step 5: Update the Worker design doc's scale note**

In `docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md:38`, replace:

```
**Cost/scale note:** sequential per-user processing within one Worker invocation. Fine for a handful of registered users (personal app usage); not a design intended for hundreds of users, but no queueing/fan-out infrastructure is warranted at this scale.
```

with:

```
**Cost/scale note:** bounded-concurrency batches of 5 users processed in parallel per invocation, rather than one sequential loop — keeps total Worker runtime from growing linearly with user count. Comfortable for dozens of registered users; still not a design intended for hundreds, and no queueing/fan-out infrastructure is warranted at this scale.
```

- [ ] **Step 6: Commit**

```bash
git add workers/reminders/src/index.ts workers/reminders/src/index.test.ts docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md
git commit -m "perf: batch the reminders Worker's per-user loop with bounded concurrency"
```

---

## Self-review notes

- **Spec coverage:** §1 (reframing) → Task 1. §2 (Settings Account: email, export, deletion) → Tasks 3, 4, 5, 6. §3 (Worker resilience) → Task 7. §4 (homepage cleanup) → Task 2. §5 (testing) → covered inline in every task.
- **Placeholder scan:** none found — every step has full code, no "TBD"/"add validation".
- **Type consistency:** `SettingsScreen({ uid, email }: { uid: string; email: string | null })` (Task 6) matches the `App.tsx` call site added in the same task. `downloadCsv(filename: string, rows: Record<string, unknown>[]): void` (Task 3) matches every call in Task 6's `handleExport`. Each `exportRows.ts` mapper's input type (Task 4) matches the return type of its paired API function (`listWorkoutLogEntries` → `WorkoutLogEntry[]` → `workoutLogToRows`, etc.).
- **Cross-plan dependency:** flagged in Global Constraints and Task 5 — this plan must run after the Finances credit/debit ledger plan.
