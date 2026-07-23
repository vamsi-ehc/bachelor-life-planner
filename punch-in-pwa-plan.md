# Punch In — PWA & Reminders: Build Plan

Status: **Planning only — nothing below has been built yet.**

---

## 1. Reality check: alarms vs. notifications

This shapes everything else, so it comes first.

| | Native Clock alarm | PWA push notification |
|---|---|---|
| Fires with sound even if phone is silenced-but-not-DND | Yes | No |
| Breaks through Focus Mode | Yes | No (no Time-Sensitive access for web apps) |
| Works with app closed / phone locked | Yes | Yes, **but only if the PWA was added to Home Screen** |
| Needs a backend | No | Yes (server has to send it at the right time) |
| Needs you to open a tab first | No | No, once subscribed |
| Reliability on iOS | High | Medium — Apple has no background sync, so delivery timing can drift, and some developers report iOS occasionally stops delivering silently |

**Bottom line:** a PWA cannot replicate a Clock-app alarm. It can send a lock-screen notification at roughly the right time, once installed to your home screen and subscribed. For anything you truly cannot miss (workout wake-up, medicine-style reminders), a real alarm is still the more dependable tool — separate from this project, and I can set those directly whenever you say go.

For everything else (learning time, chore due-dates, evening wind-down), a PWA push notification is a fine fit.

---

## 2. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Hosting | **Firebase Hosting** | Free tier, one CLI command to deploy, serves the PWA + service worker |
| Database | **Firestore** | Replaces the current browser-only storage; syncs across devices; free tier covers personal use easily |
| Scheduling | **Cloud Functions + Cloud Scheduler** | Fires at your configured times (6:45 AM, 8 PM, chore due-dates), triggers the push |
| Push delivery | **Firebase Cloud Messaging (FCM)** | Free, unlimited messages, routes iOS delivery through Apple Push Notification service automatically once an APNs key is added in the Firebase console |
| Auth | **Firebase Auth (anonymous or email)** | Just enough to tie your data to your device/account — no real "login" UX needed for a single-user app |

Everything above stays inside Firebase's free Spark/Blaze tier for a single-user personal app.

**What you'll need to do yourself (I can't do this part for you):**
1. Create a Firebase project (console.firebase.google.com) — you said you'll handle this.
2. Enable Firestore, Cloud Functions, Hosting, FCM in that project.
3. Generate an APNs auth key from your Apple Developer account and upload it in Firebase → Project Settings → Cloud Messaging (needed for iOS delivery specifically).
4. Add the PWA to your iPhone Home Screen via Safari → Share → Add to Home Screen, then approve the notification permission prompt from inside the installed app (not the browser tab).

I'll hand you deployable code plus a step-by-step checklist matching the above when we build.

---

## 3. Dashboard — "Today" at a glance

Since the priority is a single glance at status + streaks (not trend charts), the dashboard becomes the default landing view, replacing/absorbing the current "Today" tab:

- **Top band:** date, current streak (large), a single "day health" ring or bar showing % of today's tasks done
- **Three status chips:** Workout / Learning / Chores, each showing done-count and a colored dot (green = complete, amber = in progress, gray = not started)
- **Due-now strip:** any recurring chore that's due or overdue today, front and center — not buried in a separate tab
- **One action:** the existing "Punch In" quick-complete stays as the single primary button
- Trend heatmaps and the workout log move one tap away (still present, just not competing for the first glance)

This keeps the landing screen answering one question fast: *am I on track today, and what's my streak?*

---

## 4. Reminder configuration (what gets scheduled)

Defaults carried over from the existing plan, all editable later in Settings:

| Reminder | Time | Delivery |
|---|---|---|
| Workout | 6:45 AM daily | Native alarm (set on request) + optional push |
| Learning | 8:00 PM daily | Push notification |
| Dinner prep nudge | 7:00 PM daily | Push notification |
| Recurring chore due | Day-of, morning | Push notification, one per due chore |

---

## 5. Data model changes (Firestore)

Moving from the single local `planner-state` blob to collections:
- `config` — categories, subtasks, recurring chores + cadence (mirrors current structure)
- `completions/{date}` — one document per day
- `workoutLog/{entryId}` — one document per log entry
- `reminders` — scheduled times, used by the Cloud Function to know when to fire

This also means: once live, your data survives clearing browser storage or switching devices, since it lives in Firestore instead of the browser.

---

## 6. Build phases (once you give the go-ahead)

1. **Phase 1:** Rebuild the dashboard/landing view + wire up Firestore (replaces local-only storage)
2. **Phase 2:** Add PWA manifest + service worker + "Add to Home Screen" prompt
3. **Phase 3:** Cloud Functions + Scheduler + FCM push wiring, tied to your reminder config
4. **Phase 4:** iOS APNs key setup + install-and-test on your phone

Each phase is independently useful — Phase 1 alone is already an upgrade over the current version, even before push notifications exist.

---

## Open questions for you before I start building

- Reminder times: confirm 6:45 AM / 8 PM / 7 PM dinner nudge are still right, or adjust
- Should the dashboard's "due-now" strip include recurring chores only, or also flag an incomplete Workout/Learning block after a certain hour (e.g. nudge at 9 PM if learning isn't done)?
- Any preference between Firebase Auth being fully invisible (anonymous) vs. a simple email sign-in so you could check the dashboard from a second device later?
