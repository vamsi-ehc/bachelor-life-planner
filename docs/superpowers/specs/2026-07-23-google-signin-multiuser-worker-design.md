# Google Sign-In + Multi-User Worker Discovery — Design

## Context

Punch In's Firebase Auth account has silently gotten recreated with a new UID at least once already, which caused the Cloudflare reminders Worker (hardcoded to one `FIREBASE_UID` in `wrangler.toml`) to silently check/write the wrong (nonexistent) user's data — reminders never fired and nobody was told why. Two changes close this off:

1. Replace email/password auth with Google Sign-In only, for a stable identity tied to a real Google account instead of a Firebase-managed password account that can be lost/recreated.
2. Make the Worker discover which users exist from Firestore itself, instead of a hardcoded UID that has to be manually kept in sync with whichever account is currently live.

## Part A — Google Sign-In only

**Remove:** the email/password form, mode toggle (`signin`/`signup`), and the `signIn`/`signUp` exports from `src/auth/useAuth.ts`.

**Add to `src/auth/useAuth.ts`:**
- `signInWithGoogle(): Promise<void>` — calls `signInWithRedirect(auth, new GoogleAuthProvider())`. Redirect flow (not popup) because the app is used as an installed/standalone PWA on iOS Safari, where popup-based OAuth is unreliable.
- `useAuth()` calls `getRedirectResult(auth)` once on mount and surfaces a thrown/rejected redirect as an error the same way a failed sign-in does today, so `Login.tsx` can display it.

**`src/auth/Login.tsx`:** becomes a single "Sign in with Google" button (plus app name/heading). No email/password inputs, no mode toggle.

**Firebase Console:** Google sign-in provider is already enabled (done by the user). Email/password can remain enabled or be disabled in the console — irrelevant either way since the app no longer exposes it as a UI path.

**Not in scope:** migrating data from the old email/password UID to whatever new UID Google sign-in creates. This is a single-user personal app; the user will re-do Settings + notification permission grant once, under the new account, same as after the last UID change.

## Part B — Worker discovers registered users dynamically

**Problem:** Firestore only has *subcollections* under `users/{uid}/...` (config, fcmTokens, bills, etc.) — there is no actual document at `users/{uid}` itself. `listDocuments(projectId, token, 'users')` returns nothing today even though a user's data exists underneath, so there's no way for the Worker to enumerate "which users exist" without being told a UID explicitly.

**Fix — frontend registers on sign-in:**
- New small module `src/auth/userRegistry.ts` exporting `registerUser(uid: string, email: string | null): Promise<void>`, which does `setDoc(doc(db, 'users', uid), { email, updatedAt: serverTimestamp() }, { merge: true })`.
- `useAuth.ts`'s `onAuthStateChanged` callback calls `registerUser(user.uid, user.email)` (fire-and-forget with a caught/logged error — must never block rendering the rest of the app) whenever a non-null user is present.
- Firestore rules already cover this: `match /users/{uid}/{document=**}` includes the document at exactly `/users/{uid}` (recursive wildcards match zero or more segments) — no rules change needed.

**Fix — Worker loops over discovered users:**
- `workers/reminders/src/index.ts`: extract the existing single-user body of `runReminderCheck` into `runReminderCheckForUser(projectId: string, accessToken: string, uid: string, now: Date): Promise<void>` — same logic as today, parameterized on `uid` instead of reading `env.FIREBASE_UID`.
- New top-level `runReminderCheck(env: Env, now?: Date): Promise<void>` fetches the access token once, calls `listDocuments(projectId, accessToken, 'users')`, and calls `runReminderCheckForUser` once per returned user ID. Each call is wrapped in try/catch — one user's failure (bad data, transient Firestore error) is logged (`console.error`) and does not stop processing the rest.
- `Env` interface drops `FIREBASE_UID`. `wrangler.toml`'s `[vars]` drops `FIREBASE_UID` entirely — nothing left to manually keep in sync.

**Cost/scale note:** sequential per-user processing within one Worker invocation. Fine for a handful of registered users (personal app usage); not a design intended for hundreds of users, but no queueing/fan-out infrastructure is warranted at this scale.

## Testing

- `src/auth/Login.test.tsx`: rewritten to test the single Google button, loading/error states — remove email/password field assertions.
- `src/auth/useAuth.test.ts`: add tests for `signInWithGoogle` calling `signInWithRedirect` with a `GoogleAuthProvider`, and for `getRedirectResult` surfacing an error.
- `src/auth/userRegistry.test.ts`: new — asserts `registerUser` calls `setDoc` with the right merged fields.
- `workers/reminders/src/index.test.ts`: restructured so `listDocuments` mock returns multiple user IDs for the `'users'` path, and per-user Firestore paths are mocked keyed by uid; add a case where one user's check throws and asserts the other user's reminder still fires.

## Out of scope

- Migrating old email/password account's data to the new Google-account UID.
- Any UI for viewing/managing multiple registered users (this is still fundamentally a personal-use app; multi-user discovery exists only to make the Worker resilient to UID churn, not to build multi-tenancy features).
- Rate limiting / fan-out / queueing in the Worker for large numbers of users.
