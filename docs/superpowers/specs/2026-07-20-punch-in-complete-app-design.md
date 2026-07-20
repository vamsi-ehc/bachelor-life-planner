# Punch In — Complete App Design

Status: **Design approved — implementation not yet started.**

---

## 1. Scope & architecture

**Punch In** is a single-user life planner (with email login for cross-device access) covering 7 domains: Workout, Learning, Chores, Finances, Meals & Groceries, Sleep & Health, Goals & Journaling.

- **Frontend:** React PWA, installable to home screen, manifest + service worker for offline shell and push receipt.
- **Backend:** Firebase — Firestore (data), Cloud Functions + Cloud Scheduler (reminder firing logic), FCM (push delivery), Firebase Auth (email sign-in).
- **Reminder times:** fully editable in Settings, not hardcoded. Defaults seeded at 6:45 AM (workout), 7:00 PM (dinner nudge), 8:00 PM (learning), Sunday evening (weekly review).

### Why Firebase over the alternatives considered

- **Supabase** was ruled out because push notification delivery would still need a separate service wired on top — more effort for the one capability (reminders) the project exists for.
- **Local-first / no backend** was ruled out because it can't support cross-device sign-in (which was chosen) or real push notifications when the app is closed (the core reminder feature).

### Reality check: alarms vs. notifications (carried over, still holds)

| | Native Clock alarm | PWA push notification |
|---|---|---|
| Fires with sound even if phone is silenced-but-not-DND | Yes | No |
| Breaks through Focus Mode | Yes | No (no Time-Sensitive access for web apps) |
| Works with app closed / phone locked | Yes | Yes, but only if the PWA was added to Home Screen |
| Needs a backend | No | Yes |
| Reliability on iOS | High | Medium — no background sync, delivery timing can drift |

A PWA cannot replicate a Clock-app alarm. It sends a lock-screen notification at roughly the right time once installed to home screen and subscribed. For anything truly can't-miss (workout wake-up, medicine-style reminders), a real native alarm remains the more dependable tool — out of scope for this app, set directly on request. For everything else (learning time, chore due-dates, bill due-dates, evening wind-down, weekly review), a push notification is a fine fit.

---

## 2. Data model (Firestore)

One collection per domain, scoped under the signed-in user (`users/{uid}/...`):

| Collection | Contents |
|---|---|
| `config` | Categories, subtasks, recurring chore definitions + cadence, reminder time settings |
| `completions/{date}` | Daily punch-in state: workout/learning/chores done-flags for that date |
| `workoutLog/{entryId}` | Individual workout entries (exercise, sets/reps or duration, notes) |
| `finances/transactions/{id}` | Manual expense/income entries: amount, category, date, note |
| `finances/bills/{id}` | Recurring bill definitions: name, amount, due day, category |
| `meals/groceryList/{itemId}` | Checklist items: name, checked state |
| `meals/log/{date}` | Simple "what did I eat" entries per day |
| `health/sleep/{date}` | Bedtime, wake time per day |
| `health/weight/{entryId}` | Weight/measurement entries with date |
| `goals/{goalId}` | Goal title, target date, status, milestones |
| `journal/weeklyReview/{weekId}` | Structured weekly reflection answers |
| `reminders` | Scheduled times per reminder type, used by Cloud Functions to know when to fire |

This replaces a single local `planner-state` blob entirely — every domain gets its own collection so growth in one area doesn't bloat the others.

---

## 3. Dashboard — "Today" at a glance

Landing view, status-chips-grid style:

- **Top band:** date, current streak (largest visual element), overall "day health" % across all 7 areas.
- **7 status chips**, one per domain (Workout, Learning, Chores, Finances, Meals, Health, Goals) — each shows a compact today-state (done-count, green/amber/gray dot) and is tappable to drill into that domain's full view.
- **Due-now strip** (unified across all domains): overdue chores, bills due today, incomplete workout/learning after a configurable cutoff hour, groceries still needed, and a "weekly review due" flag on Sundays.
- **One action:** the existing "Punch In" quick-complete button stays as the single primary CTA.
- Trend heatmaps, workout log, spending charts, etc. all move one tap away from their respective chip — not competing for the first glance.

---

## 4. Per-domain features

| Domain | Core loop |
|---|---|
| **Workout** | Punch-in complete + log entry (exercise, sets/reps or duration, notes); streak tracking |
| **Learning** | Punch-in complete; optional note on what was studied; streak tracking |
| **Chores** | Recurring chore list with cadence (daily/weekly/custom); due-today auto-surfaces on dashboard; mark done |
| **Finances** | Add expense/income (amount, category, note); monthly budget bar per category; recurring bills list with due-day, auto-flagged when due |
| **Meals & groceries** | Running grocery checklist (add/check off items); simple daily "what did I eat" log, no recipes |
| **Sleep & health** | Log bedtime/wake time daily; periodic weight/measurement entries; simple trend view |
| **Goals & journaling** | Standing goals list with status/milestones; Sunday-evening prompt opens a structured weekly review (what went well / what didn't / focus for next week) |

Each domain gets its own screen (reached via its dashboard chip) with its log/list plus a lightweight trend view — a consistent pattern across all 7 so the shape established for one domain carries to the rest.

---

## 5. Reminders & notifications

- **Delivery:** FCM push, requires the PWA installed to home screen + notification permission granted from the installed app (not the browser tab).
- **Scheduled reminders** (Cloud Scheduler → Cloud Function → FCM), all times editable in Settings:
  - Workout — default 6:45 AM
  - Dinner prep nudge — default 7:00 PM
  - Learning — default 8:00 PM
  - Weekly review — default Sunday evening
- **Event-driven pushes** (fired when a condition is met, not time-scheduled): bill due today, recurring chore due today.
- **Dashboard-only nudges** (no push, shown only in the due-now strip): incomplete workout/learning after cutoff hour, groceries still needed.
- Real Clock-app alarms remain out of scope for this app — set directly, separately, on request.

---

## 6. Settings

- Editable reminder times for all 4 scheduled reminders (custom time picker per reminder, no hardcoded defaults).
- Recurring chore/bill management (add/edit/remove, cadence/due-day).
- Category and subtask config.
- Cutoff hour for the dashboard's "incomplete after X" nudges.
- Account: email shown, sign-out.

---

## 7. Auth

Firebase Auth, email/password (or magic link — decided at build time). One user account; all 7 domains' data scoped under that `uid`; accessible from any device signed in.

---

## 8. Build phases

1. **Phase 1:** Core shell — Firebase Auth (email sign-in), Firestore wiring, dashboard chips grid + due-now strip, Workout/Learning/Chores domains.
2. **Phase 2:** Finances + Meals & Groceries domains.
3. **Phase 3:** Sleep & Health + Goals & Journaling domains (incl. weekly review flow).
4. **Phase 4:** PWA manifest + service worker + "Add to Home Screen" flow.
5. **Phase 5:** Cloud Functions + Scheduler + FCM push wiring, tied to Settings-configured reminder times.
6. **Phase 6:** iOS APNs key setup + install-and-test on your phone.

Each phase ships something usable on its own — Phase 1 alone is already a complete upgrade over nothing.

---

## What you'll need to do yourself (can't be done from here)

1. Create a Firebase project (console.firebase.google.com).
2. Enable Firestore, Cloud Functions, Hosting, FCM, and Auth in that project.
3. Generate an APNs auth key from your Apple Developer account and upload it in Firebase → Project Settings → Cloud Messaging (needed for iOS push delivery).
4. Add the installed PWA to your iPhone Home Screen via Safari → Share → Add to Home Screen, then approve the notification permission prompt from inside the installed app.
