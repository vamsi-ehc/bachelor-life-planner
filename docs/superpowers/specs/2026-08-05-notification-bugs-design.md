# Notification bug fixes — design

## Context

User testing feedback surfaced two notification issues:

1. Reminders fire at an "arbitrary" time instead of the configured time.
2. The "Enable Notifications" banner reappears every time the app is opened, even after the user already granted/denied permission.

## Bug 1 — Arbitrary delivery time

Two independent delivery paths exist for the same reminder:

- **Foreground scheduler** (`src/notifications/useLocalReminderScheduler.ts`): schedules a precise `setTimeout` in the open tab. Only fires if the tab/PWA stays open and unthrottled continuously until the target time — in practice this rarely survives from "app opened" to a next-morning reminder, since mobile browsers suspend/kill backgrounded tabs.
- **Background push** (`workers/reminders`, Cloudflare Cron `* * * * *`): checks every minute server-side (`shouldFireDaily`/`shouldFireWeekly`, 2-minute window) and sends an FCM push via `sendPush` (`workers/reminders/src/fcm.ts`). This is the path that actually delivers in practice.

`sendPush` sends the FCM message with no priority flag, so Android/iOS treat it as normal priority and are free to batch/defer delivery under Doze/App Standby/battery optimization — this is what surfaces as "arbitrary time" delivery.

**Fix:** mark the FCM message high-priority (`android.priority: "high"`, `apns.headers['apns-priority']: '10'`) in `sendPush` so the OS treats it as time-sensitive. No changes to the foreground scheduler — it remains a harmless best-effort optimization, not the primary path.

## Bug 2 — Repeated permission prompt / notification preference

Root cause: `NotificationPermission.tsx` keeps `dismissed` in local component `useState`, reset on every mount. The `denied` status isn't covered by the hide condition at all, so a denied user sees the banner every visit.

Scope expanded per user request: add an explicit in-app notification preference (not just banner dismissal), following standard mobile/web app practice of separating "browser permission" from "app-level preference."

**Data model:** add `notificationsEnabled: boolean` (default `true`) to `ReminderConfig`, in both:
- `src/domains/shared/types.ts`
- `workers/reminders/src/index.ts` (`ReminderConfig` interface + `DEFAULT_REMINDER_CONFIG` + `decodeReminderConfig`)

**Worker behavior:** `runReminderCheckForUser` skips all push jobs for a user when `config.notificationsEnabled === false` (single early check, before building `jobs`).

**Dashboard banner (`NotificationPermission.tsx`):**
- `status === 'granted'` → hidden (unchanged).
- `status === 'denied'` → always hidden. Browsers block re-prompting once denied; nagging is bad practice. No in-banner messaging for this state.
- `status === 'idle'` → shown once; "Dismiss" persists to `localStorage` (key includes uid) so it never reappears after dismissal, across sessions/reloads. Only resets if permission itself changes back to `idle` (e.g. site data cleared).

**Settings screen — new "Notifications" toggle:**
- Reflects current state: On / Off / "Blocked by browser" (when `Notification.permission === 'denied'` — toggle disabled, with a short note that it must be re-enabled via browser site settings).
- Toggle **on** while permission not yet granted: runs the existing `enable()` flow (browser prompt + token save) via `useNotificationPermission`; on success, sets `notificationsEnabled: true` and saves via `saveReminderConfig`.
- Toggle **off**: sets `notificationsEnabled: false` and saves. Worker stops sending pushes immediately. Browser permission and FCM token are left intact so re-enabling later doesn't require a fresh browser permission prompt.

## Testing

- `workers/reminders/src/fcm.test.ts`: assert high-priority fields present in the outgoing FCM payload.
- `workers/reminders/src/index.test.ts`: assert `runReminderCheckForUser` sends no pushes when `notificationsEnabled: false`.
- `src/notifications/NotificationPermission.test.tsx`: assert banner hidden when `denied`, hidden after dismiss+remount (localStorage persisted).
- `src/domains/settings/SettingsScreen.test.tsx`: assert toggle renders and calls save with updated `notificationsEnabled`.

## Out of scope

- Workout UI restructure (separate design).
- Custom reminders feature (separate design).
- Removing/replacing the foreground local scheduler.
