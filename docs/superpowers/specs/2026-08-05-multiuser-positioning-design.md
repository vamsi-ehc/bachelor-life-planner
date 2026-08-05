# Multiuser positioning & account lifecycle — design

Status: **Design approved — implementation not yet started.**

## Context

Punch In has so far been documented and marketed as a single-user personal app, even though the technical foundation for multiple isolated accounts already exists:

- Google Sign-In lets any Google account authenticate (`src/auth/useAuth.ts`).
- Firestore rules (`firestore.rules`) already scope every read/write to `request.auth.uid` — no cross-account access is possible today.
- The reminders Worker (`workers/reminders/src/index.ts`) already discovers registered users dynamically (via the `users/{uid}` registry doc) and loops over all of them, rather than targeting one hardcoded UID.

What's missing is the *framing* (docs and marketing copy still say "personal app," "single-user") and a handful of account-lifecycle features a real multiuser product needs: seeing which account you're signed into, exporting your own data, and a discoverable way to ask for account deletion.

This design does **not** add any social or shared-data feature. Each account remains fully private and isolated — "multiuser" means "many independent private accounts," not "users interact with each other's data."

## 1. Reframing (docs + copy)

- `docs/superpowers/specs/2026-07-20-punch-in-complete-app-design.md` and `docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md`: update language describing the app as single-user/personal to describe it as: any Google account can sign in and gets a fully isolated, private planner instance. No shared or social data between accounts.
- `src/marketing/TermsOfService.tsx` — "The service" section: change "Punch In is a personal life-tracking app covering workouts, learning, chores, finances, meals, health, and goals. It is provided by an individual developer, not a registered company." to "Punch In is a life-tracking app for individual users, covering workouts, learning, chores, finances, meals, health, and goals. It is operated by an individual developer, not a registered company."
- `src/marketing/PrivacyPolicy.tsx` — no changes needed; it already speaks in per-account terms ("your account's unique ID," "no other account can access your entries").
- `vite.config.ts` PWA manifest `description` field ("A single-user life planner covering...") — update to drop "single-user," matching the ToS wording change.

## 2. Settings — Account section (new)

New "Account" section in `src/domains/settings/SettingsScreen.tsx`:

- **Signed-in email**: read from the current Firebase Auth user (already available via `useAuth()`) and displayed as plain text. Nowhere in the UI currently shows this — the sidebar only has a "Sign out" button with no identifying context.
- **Export data**: one button per domain (Workout, Learning, Chores, Finances, Meals, Health, Goals). Each button fetches that domain's Firestore documents for the signed-in `uid` and triggers a client-side CSV download (e.g. `workout-log-2026-08-05.csv`). Reuses each domain's existing flat data shape — no new schema or backend endpoint; done as a client-side Firestore query + CSV serialization, same pattern already used for other list data in each domain screen.
  - New shared helper `src/domains/shared/exportCsv.ts`: `toCsv(rows: Record<string, unknown>[]): string` and `downloadCsv(filename: string, rows: Record<string, unknown>[]): void`, used by each domain's export button.
- **Request account deletion**: a `mailto:` link/button, prefilled with subject/body including the account email, addressed to the developer contact (same address already used in ToS/Privacy "Contact" sections). No automated deletion — this only makes the existing manual process (documented in the Privacy Policy) actually discoverable from inside the app instead of requiring the user to go find the email address in the Privacy Policy page.

## 3. Reminders Worker — bounded-concurrency resilience

`runReminderCheck` in `workers/reminders/src/index.ts` currently processes discovered users sequentially, one `runReminderCheckForUser` call at a time, each wrapped in try/catch.

- Change to bounded-concurrency batches: process users in fixed-size groups (batch size 5) via `Promise.allSettled`, moving to the next batch only after the current one settles. Keeps total Worker runtime from growing linearly forever as the user count increases, without introducing a queue or new infrastructure.
- Each per-user failure is still caught and logged individually (unchanged behavior — one user's error never stops others).
- Add a run-level summary log line after processing all batches: total users processed, count succeeded, count failed. Gives visibility into a growing failure rate without adding new tooling/dashboards.
- Update the "Cost/scale note" in `docs/superpowers/specs/2026-07-23-google-signin-multiuser-worker-design.md` to describe the new, still-bounded comfort zone (dozens of accounts processed per invocation within the Worker's CPU-time limit) rather than the old single-batch sequential description — still explicitly not designed for hundreds of users; no queueing/fan-out infrastructure added.

## 4. Homepage cleanup

`src/marketing/Home.tsx` currently has unused demo content implying a social/comparison feature that isn't real and isn't being built under this design:

- Remove the `SQUAD` array (other users' streaks: Rahul, Aisha, Devraj) and whatever JSX renders it.
- Remove the `PUBLIC_DOMAINS` / `PRIVATE_DOMAINS` constants and whatever JSX renders the public/private domain split.
- Leave the rest of the homepage demo (rings, trend chart, heatmap, punch strip) untouched — those demonstrate the real single-account dashboard, which is accurate.

## 5. Testing

- `src/domains/settings/SettingsScreen.test.tsx`: assert signed-in email renders; assert each domain's export button triggers a CSV download with expected headers/rows for mocked data; assert the deletion-request link/button renders with a `mailto:` href containing the account email.
- `src/domains/shared/exportCsv.test.ts`: new — unit tests for `toCsv`/`downloadCsv` covering empty input, special characters (commas, quotes) requiring CSV escaping.
- `workers/reminders/src/index.test.ts`: extend the existing multi-user test to assert batched/concurrent processing still processes all discovered users, and that one user's failure doesn't block others' processing (behavior preserved, not just performance changed); assert the run-level summary log fires with correct counts.
- `src/marketing/Home.test.tsx`: remove assertions tied to `SQUAD`/domain-split rendering; keep assertions for the retained demo sections.

## Out of scope

- Any social/comparison feature (leaderboards, friends, shared streaks) — explicitly not part of "multiuser" under this design.
- Shared/household data (multiple accounts editing the same chores/bills/etc.) — a different problem, not addressed here.
- Automated/self-service account deletion — deletion remains a manual, developer-processed request; this design only makes requesting it discoverable.
- Queueing/fan-out infrastructure for the reminders Worker — bounded-concurrency batching is a stopgap for growth from "a handful" to "dozens," not a scale-to-hundreds redesign.
- The Finances domain's credit/debit redesign — brainstormed and specced separately.
