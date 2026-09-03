# Punch In — Architecture

Status: **Built.** Punch In is a fully offline, on-device PWA. There is no
backend, no Firebase project, and no network call at runtime.

---

## 1. Reality check: alarms vs. notifications

| | Native Clock alarm | PWA local notification |
|---|---|---|
| Fires with sound even if phone is silenced-but-not-DND | Yes | No |
| Breaks through Focus Mode | Yes | No |
| Works with app closed / phone locked | Yes | Only if the PWA is installed to the Home Screen, and the tab/service worker is alive |
| Needs a backend | No | No — Punch In schedules notifications on-device |
| Reliability on iOS | High | Medium — timing can drift, and iOS may stop delivering silently |

**Bottom line:** for anything you truly cannot miss (workout wake-up,
medicine-style reminders), a real Clock alarm is still the dependable tool.
Punch In's reminders are on-device `Notification` API nudges scheduled by
`src/notifications/useLocalReminderScheduler.ts` — good enough for learning
time, chore due-dates, and evening wind-down.

---

## 2. Stack (as built)

| Layer | Choice | Notes |
|---|---|---|
| Hosting | Static host (Cloudflare Pages or Firebase Hosting) | Just serves the built `dist/` — see `deploy:cloudflare` / `deploy:firebase` scripts |
| Storage | **Client-side SQLite** via `sql.js` (WASM), persisted to IndexedDB | `src/localdb/sqliteEngine.ts` |
| Firestore API | **Local shim** (`src/localdb/localFirestore.ts`) | Implements the subset of the `firebase/firestore` surface the domain APIs use; the `firebase/firestore` specifier is aliased to it in `vite.config.ts` and `tsconfig.json`, so `src/domains/**Api.ts` run unmodified |
| Auth | **Local email + password** (`src/auth/localAuth.ts`) | Accounts stored in the SQLite `auth_users` table; passwords salted + PBKDF2-hashed (`src/auth/passwordHash.ts`); session is a uid in `localStorage`. Nothing leaves the device. |
| Reminders | On-device `Notification` API | `useLocalReminderScheduler`; no FCM, no push server |
| Service worker | Workbox precache only (`src/sw.ts`) | Precaches app shell + `sql-wasm.wasm`; that's all offline needs |

There is no APNs key, no Cloud Functions, no Cloud Scheduler. `firebase.json`
/ `firestore.rules` remain only for the optional Firebase *Hosting* deploy
path and are not otherwise used.

---

## 3. Data model (SQLite)

Two tables (`src/localdb/sqliteEngine.ts`):

- `documents(path, collection_path, data JSON, updated_at)` — every Firestore
  "document" the domain APIs read/write, keyed by full path. The shim
  filters/sorts/limits in JS over `collection_path`.
- `auth_users(id, email, salt, password_hash, created_at)` — local accounts.

Writes are debounced (~150 ms) then the whole DB is serialized to IndexedDB
under the `sqlite-db` key. `flushPersist()` forces an immediate write.

---

## 4. Auth flow

1. `LocalLogin` (`src/auth/LocalLogin.tsx`) — sign-up / sign-in form.
2. `signUpLocal` / `signInLocal` verify against `auth_users` and store the
   uid in `localStorage` (`punch-in-local-session-uid`).
3. `useAuth()` → `useLocalAuthState()` restores the session on load and
   exposes `{ user, loading }`. `redirectError` is always `null` (kept in the
   type for call-site compatibility).
4. `signOutUser()` clears the session key.

---

## 5. PWA behavior

- **Install:** `src/pwa/InstallPrompt.tsx` (`beforeinstallprompt`).
- **Update / offline-ready toast:** `src/pwa/UpdateToast.tsx`. The
  "ready to work offline" message auto-dismisses after 5 seconds; the
  "new version available" message stays until the user reloads.
- **Notification permission:** `src/notifications/NotificationPermission.tsx`
  → `useNotificationPermission` just calls `Notification.requestPermission()`.

---

## 6. Local development

```
pnpm install
pnpm dev            # vite dev server
pnpm test           # vitest
pnpm build          # tsc && vite build  -> dist/
```

No `.env` values are required to run the app. See `.env.example` for the few
build-time vars that only affect the optional marketing/SEO tags and the
Firebase Hosting deploy target.
