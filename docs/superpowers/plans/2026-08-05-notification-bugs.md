# Notification Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two notification bugs reported in app testing: reminders arriving at an arbitrary time instead of the scheduled one, and the "Enable Notifications" banner reappearing on every app open.

**Architecture:** Add a `notificationsEnabled` app-level preference to `ReminderConfig` (shared type + client API + Cloudflare Worker), have the worker skip pushes when it's off, mark outgoing FCM messages high-priority so mobile OS battery optimization doesn't defer delivery, and rework the dashboard permission banner + add a Settings toggle so the prompt only ever shows once per user.

**Tech Stack:** React 18 + TypeScript (Vite), Firebase (Firestore, Cloud Messaging), Cloudflare Workers (cron-triggered reminder worker), Vitest + Testing Library.

## Global Constraints

- `ReminderConfig` is defined independently in two places that must stay in sync: `src/domains/shared/types.ts` (client) and the local `ReminderConfig` interface in `workers/reminders/src/index.ts` (worker). Both need the new field.
- Do not change the foreground local scheduler (`src/notifications/useLocalReminderScheduler.ts`) — out of scope per the design doc.
- Do not remove or weaken existing FCM invalid-token cleanup behavior in `workers/reminders/src/index.ts`.
- Read `Notification.permission` directly (not React state) when you need the browser's current, authoritative permission value — component state can lag one render behind a just-resolved `enable()` call.

---

### Task 1: Add `notificationsEnabled` to the data model

**Files:**
- Modify: `src/domains/shared/types.ts`
- Modify: `src/domains/settings/reminderConfigApi.ts`
- Modify: `src/domains/settings/reminderConfigApi.test.ts`
- Modify: `workers/reminders/src/index.ts:13-27,46-56`
- Modify: `workers/reminders/src/index.test.ts`

**Interfaces:**
- Produces: `ReminderConfig.notificationsEnabled: boolean` (client type, `src/domains/shared/types.ts`), consumed by Task 4 (SettingsScreen) and already read by `getReminderConfig`/`saveReminderConfig`.
- Produces: worker-local `ReminderConfig.notificationsEnabled: boolean`, consumed by Task 2 (`runReminderCheckForUser`).

- [ ] **Step 1: Update the shared client type**

In `src/domains/shared/types.ts`, add the field to the existing `ReminderConfig` interface:

```typescript
export interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
  notificationsEnabled: boolean;
}
```

- [ ] **Step 2: Write failing tests for the client API defaulting behavior**

In `src/domains/settings/reminderConfigApi.test.ts`, update the existing fixtures/assertions and add one new case. Replace the whole file content with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { getReminderConfig, saveReminderConfig, DEFAULT_REMINDER_CONFIG } from './reminderConfigApi';

describe('getReminderConfig', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns the defaults when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getReminderConfig('user1');
    expect(result).toEqual(DEFAULT_REMINDER_CONFIG);
    expect(result.notificationsEnabled).toBe(true);
  });

  it('defaults missing fields when the doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ workoutTime: '07:00' }) });
    const result = await getReminderConfig('user1');
    expect(result.workoutTime).toBe('07:00');
    expect(result.dinnerTime).toBe(DEFAULT_REMINDER_CONFIG.dinnerTime);
    expect(result.notificationsEnabled).toBe(true);
  });

  it('defaults notificationsEnabled to true when the doc predates the field', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ workoutTime: '07:00', dinnerTime: '18:30', learningTime: '20:30', weeklyReviewTime: '17:00', timezone: 'UTC' }),
    });
    const result = await getReminderConfig('user1');
    expect(result.notificationsEnabled).toBe(true);
  });

  it('returns the stored config when present', async () => {
    const stored = {
      workoutTime: '07:00',
      dinnerTime: '18:30',
      learningTime: '20:30',
      weeklyReviewTime: '17:00',
      timezone: 'America/New_York',
      notificationsEnabled: false,
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getReminderConfig('user1');
    expect(result).toEqual(stored);
  });
});

describe('saveReminderConfig', () => {
  beforeEach(() => mockSetDoc.mockReset());

  it('writes all 6 fields', async () => {
    const config = {
      workoutTime: '07:00',
      dinnerTime: '18:30',
      learningTime: '20:30',
      weeklyReviewTime: '17:00',
      timezone: 'America/New_York',
      notificationsEnabled: false,
    };
    await saveReminderConfig('user1', config);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), config);
  });
});
```

- [ ] **Step 3: Run the client API tests to verify they fail**

Run: `npx vitest run src/domains/settings/reminderConfigApi.test.ts`
Expected: FAIL — `DEFAULT_REMINDER_CONFIG.notificationsEnabled` is `undefined`, and `saveReminderConfig` doesn't write the field yet.

- [ ] **Step 4: Implement the client API changes**

In `src/domains/settings/reminderConfigApi.ts`, replace the whole file with:

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ReminderConfig } from '../shared/types';

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notificationsEnabled: true,
};

function reminderConfigDocRef(uid: string) {
  return doc(db, 'users', uid, 'config', 'reminders');
}

export async function getReminderConfig(uid: string): Promise<ReminderConfig> {
  const snap = await getDoc(reminderConfigDocRef(uid));
  if (!snap.exists()) return DEFAULT_REMINDER_CONFIG;
  const data = snap.data() as Partial<ReminderConfig>;
  return {
    workoutTime: data.workoutTime ?? DEFAULT_REMINDER_CONFIG.workoutTime,
    dinnerTime: data.dinnerTime ?? DEFAULT_REMINDER_CONFIG.dinnerTime,
    learningTime: data.learningTime ?? DEFAULT_REMINDER_CONFIG.learningTime,
    weeklyReviewTime: data.weeklyReviewTime ?? DEFAULT_REMINDER_CONFIG.weeklyReviewTime,
    timezone: data.timezone ?? DEFAULT_REMINDER_CONFIG.timezone,
    notificationsEnabled: data.notificationsEnabled ?? DEFAULT_REMINDER_CONFIG.notificationsEnabled,
  };
}

export async function saveReminderConfig(uid: string, config: ReminderConfig): Promise<void> {
  await setDoc(reminderConfigDocRef(uid), {
    workoutTime: config.workoutTime,
    dinnerTime: config.dinnerTime,
    learningTime: config.learningTime,
    weeklyReviewTime: config.weeklyReviewTime,
    timezone: config.timezone,
    notificationsEnabled: config.notificationsEnabled,
  });
}
```

- [ ] **Step 5: Run the client API tests to verify they pass**

Run: `npx vitest run src/domains/settings/reminderConfigApi.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Write a failing worker test for config decoding**

In `workers/reminders/src/index.test.ts`, add `notificationsEnabled: true` to the existing `defaultConfig` fixture (line 26) so it reads:

```typescript
const defaultConfig = { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC', notificationsEnabled: true };
```

This is a fixture update needed before Task 2's behavior test, not a new assertion — no new test in this step. Skip running yet; proceed to Task 2, which adds the behavior test that exercises this field.

- [ ] **Step 7: Update the worker's `ReminderConfig` type and defaults**

In `workers/reminders/src/index.ts`, replace lines 13-27 with:

```typescript
interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
  notificationsEnabled: boolean;
}

const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
  notificationsEnabled: true,
};
```

- [ ] **Step 8: Update `decodeReminderConfig` to decode the new field**

In `workers/reminders/src/index.ts`, replace the `decodeReminderConfig` function (lines 46-56) with:

```typescript
function decodeReminderConfig(data: Record<string, unknown> | null): ReminderConfig {
  if (!data) return DEFAULT_REMINDER_CONFIG;
  return {
    workoutTime: typeof data.workoutTime === 'string' ? data.workoutTime : DEFAULT_REMINDER_CONFIG.workoutTime,
    dinnerTime: typeof data.dinnerTime === 'string' ? data.dinnerTime : DEFAULT_REMINDER_CONFIG.dinnerTime,
    learningTime: typeof data.learningTime === 'string' ? data.learningTime : DEFAULT_REMINDER_CONFIG.learningTime,
    weeklyReviewTime:
      typeof data.weeklyReviewTime === 'string' ? data.weeklyReviewTime : DEFAULT_REMINDER_CONFIG.weeklyReviewTime,
    timezone: typeof data.timezone === 'string' ? data.timezone : DEFAULT_REMINDER_CONFIG.timezone,
    notificationsEnabled:
      typeof data.notificationsEnabled === 'boolean'
        ? data.notificationsEnabled
        : DEFAULT_REMINDER_CONFIG.notificationsEnabled,
  };
}
```

- [ ] **Step 9: Run the worker test suite to verify existing tests still pass**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: PASS (3 existing tests — no behavior change yet, `notificationsEnabled` defaults to `true` so nothing is skipped)

- [ ] **Step 10: Commit**

```bash
git add src/domains/shared/types.ts src/domains/settings/reminderConfigApi.ts src/domains/settings/reminderConfigApi.test.ts workers/reminders/src/index.ts workers/reminders/src/index.test.ts
git commit -m "feat: add notificationsEnabled preference to reminder config"
```

---

### Task 2: Worker skips pushes when disabled; FCM messages marked high-priority

**Files:**
- Modify: `workers/reminders/src/index.ts:69-86` (uses `ReminderConfig` from Task 1)
- Modify: `workers/reminders/src/index.test.ts` (uses `defaultConfig` fixture updated in Task 1 Step 6)
- Modify: `workers/reminders/src/fcm.ts`
- Modify: `workers/reminders/src/fcm.test.ts`

**Interfaces:**
- Consumes: `ReminderConfig.notificationsEnabled` from Task 1.
- Consumes: `sendPush(params: SendPushParams): Promise<SendPushResult>` — signature unchanged, only the outgoing payload changes.

- [ ] **Step 1: Write a failing test — worker skips all pushes when notifications are disabled**

In `workers/reminders/src/index.test.ts`, add this test inside the `describe('runReminderCheck', ...)` block, after the existing `'does nothing when no users are registered'` test:

```typescript
  it('sends no pushes for a user who has disabled notifications', async () => {
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users') return [{ id: 'uid1', data: {} }];
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      return [];
    });
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') return { ...defaultConfig, notificationsEnabled: false };
      return null;
    });

    await runReminderCheck(env, new Date('2026-07-23T06:46:00Z'));

    expect(mockSendPush).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: FAIL — `mockSendPush` is called because the worker doesn't check `notificationsEnabled` yet.

- [ ] **Step 3: Implement the skip in `runReminderCheckForUser`**

In `workers/reminders/src/index.ts`, in `runReminderCheckForUser`, right after `const config = decodeReminderConfig(configData);` (currently line 78), add:

```typescript
  if (!config.notificationsEnabled) return;
```

- [ ] **Step 4: Run the worker tests to verify they pass**

Run: `cd workers/reminders && npx vitest run src/index.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write a failing test — FCM payload is marked high priority**

In `workers/reminders/src/fcm.test.ts`, replace the first test's body assertion (lines 24-26) with:

```typescript
    expect(JSON.parse(options.body)).toEqual({
      message: {
        token: 'device-token',
        notification: { title: 'Workout time', body: "It's time for your workout." },
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
      },
    });
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd workers/reminders && npx vitest run src/fcm.test.ts`
Expected: FAIL — actual payload has no `android`/`apns` keys.

- [ ] **Step 7: Implement high-priority fields in `sendPush`**

In `workers/reminders/src/fcm.ts`, replace the `body: JSON.stringify({...})` block (lines 19-25) with:

```typescript
    body: JSON.stringify({
      message: {
        token: params.token,
        notification: { title: params.title, body: params.body },
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
        ...(params.tag ? { data: { tag: params.tag } } : {}),
      },
    }),
```

- [ ] **Step 8: Run the FCM tests to verify they pass**

Run: `cd workers/reminders && npx vitest run src/fcm.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Run the full worker test suite**

Run: `cd workers/reminders && npx vitest run`
Expected: PASS (all suites)

- [ ] **Step 10: Commit**

```bash
git add workers/reminders/src/index.ts workers/reminders/src/index.test.ts workers/reminders/src/fcm.ts workers/reminders/src/fcm.test.ts
git commit -m "fix: send high-priority FCM pushes and honor notificationsEnabled"
```

---

### Task 3: Dashboard banner hides on denied and persists dismissal

**Files:**
- Modify: `src/notifications/NotificationPermission.tsx`
- Modify: `src/notifications/NotificationPermission.test.tsx`

**Interfaces:**
- Consumes: `useNotificationPermission(uid, vapidKey)` → `{ status: 'idle' | 'granted' | 'denied', error: string | null, enable: () => Promise<void> }` (unchanged, from `src/notifications/useNotificationPermission.ts`).
- Behavior change only — no new exports.

- [ ] **Step 1: Write failing tests for the new banner behavior**

Replace `src/notifications/NotificationPermission.test.tsx` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockEnable = vi.fn();
const mockUseNotificationPermission = vi.fn();

vi.mock('./useNotificationPermission', () => ({
  useNotificationPermission: (...args: unknown[]) => mockUseNotificationPermission(...args),
}));

import { NotificationPermission } from './NotificationPermission';

describe('NotificationPermission', () => {
  beforeEach(() => {
    mockEnable.mockClear();
    mockUseNotificationPermission.mockReset();
    localStorage.clear();
  });

  it('renders nothing once granted', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'granted', enable: mockEnable, error: null });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when denied — browsers block re-prompting, so no banner is shown', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'denied', enable: mockEnable, error: null });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Enable button when idle and calls enable on click', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: null });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable' }));
    expect(mockEnable).toHaveBeenCalledTimes(1);
  });

  it('dismisses the banner when Dismiss is clicked', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: null });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the banner dismissed after remount, for the same uid', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: null });
    const first = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    first.unmount();

    const second = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it('shows the banner for a different uid even if another uid dismissed it', () => {
    localStorage.setItem('notif-banner-dismissed:user1', '1');
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: null });
    render(<NotificationPermission uid="user2" vapidKey="vapid-key" />);
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });

  it('displays an error message when error is set', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: 'Network error' });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/notifications/NotificationPermission.test.tsx`
Expected: FAIL — denied still renders a message; dismissal doesn't persist across remounts.

- [ ] **Step 3: Implement the new banner**

Replace `src/notifications/NotificationPermission.tsx` with:

```typescript
import { useState } from 'react';
import { useNotificationPermission } from './useNotificationPermission';

function dismissedKey(uid: string): string {
  return `notif-banner-dismissed:${uid}`;
}

export function NotificationPermission({ uid, vapidKey }: { uid: string; vapidKey: string }) {
  const { status, error, enable } = useNotificationPermission(uid, vapidKey);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissedKey(uid)) === '1');

  function dismiss() {
    localStorage.setItem(dismissedKey(uid), '1');
    setDismissed(true);
  }

  if (status === 'granted' || status === 'denied' || dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="text-sm text-blue-900">
        {error ? (
          <p className="text-red-700">{error}</p>
        ) : (
          <p>Turn on push reminders for workouts, learning, and chores.</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!error && (
          <button type="button" onClick={enable} className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm">
            Enable
          </button>
        )}
        <button type="button" onClick={dismiss} className="text-blue-700 text-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/notifications/NotificationPermission.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/notifications/NotificationPermission.tsx src/notifications/NotificationPermission.test.tsx
git commit -m "fix: hide notification banner once denied and persist dismissal per user"
```

---

### Task 4: Settings screen — Notifications toggle

**Files:**
- Modify: `src/domains/settings/SettingsScreen.tsx`
- Modify: `src/domains/settings/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `useNotificationPermission(uid, vapidKey)` from `src/notifications/useNotificationPermission.ts` — same hook the dashboard banner uses.
- Consumes: `getReminderConfig`/`saveReminderConfig` (Task 1) — now read/write `notificationsEnabled`.

- [ ] **Step 1: Write failing tests for the toggle**

In `src/domains/settings/SettingsScreen.test.tsx`, add the `useNotificationPermission` mock and update the `config` fixture. Replace the top of the file (imports through the `config` constant, lines 1-29) with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetReminderConfig = vi.fn();
const mockSaveReminderConfig = vi.fn();
const mockResetAllTutorialFlags = vi.fn().mockResolvedValue(undefined);
const mockEnable = vi.fn().mockResolvedValue(undefined);
const mockUseNotificationPermission = vi.fn();

vi.mock('./reminderConfigApi', () => ({
  getReminderConfig: (...args: unknown[]) => mockGetReminderConfig(...args),
  saveReminderConfig: (...args: unknown[]) => mockSaveReminderConfig(...args),
}));
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));
vi.mock('../../tutorials/tutorialFlagsApi', () => ({
  resetAllTutorialFlags: (...args: unknown[]) => mockResetAllTutorialFlags(...args),
}));
vi.mock('../../notifications/useNotificationPermission', () => ({
  useNotificationPermission: (...args: unknown[]) => mockUseNotificationPermission(...args),
}));

import { SettingsScreen } from './SettingsScreen';

const config = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
  notificationsEnabled: true,
};
```

Then update the `beforeEach` block (lines 40-44) to also reset the notification mocks, and default `mockUseNotificationPermission` to `'granted'`:

```typescript
describe('SettingsScreen', () => {
  beforeEach(() => {
    mockGetReminderConfig.mockReset();
    mockSaveReminderConfig.mockReset().mockResolvedValue(undefined);
    mockResetAllTutorialFlags.mockClear();
    mockEnable.mockClear().mockResolvedValue(undefined);
    mockUseNotificationPermission.mockReset().mockReturnValue({ status: 'granted', error: null, enable: mockEnable });
    vi.stubGlobal('Notification', { permission: 'granted' });
  });
```

Then add these tests at the end of the `describe('SettingsScreen', ...)` block, before the final closing `});`:

```typescript

  it('renders the Notifications toggle checked when enabled', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Enable reminder notifications')).toBeChecked());
  });

  it('turns notifications off and saves the preference', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Enable reminder notifications')).toBeChecked());

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Enable reminder notifications'));

    await waitFor(() =>
      expect(mockSaveReminderConfig).toHaveBeenCalledWith('user1', { ...config, notificationsEnabled: false })
    );
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('requests browser permission before turning notifications on', async () => {
    vi.stubGlobal('Notification', { permission: 'default' });
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', error: null, enable: mockEnable });
    mockGetReminderConfig.mockResolvedValue({ ...config, notificationsEnabled: false });
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Enable reminder notifications')).not.toBeChecked());

    mockEnable.mockImplementation(async () => {
      vi.stubGlobal('Notification', { permission: 'granted' });
    });
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Enable reminder notifications'));

    expect(mockEnable).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockSaveReminderConfig).toHaveBeenCalledWith('user1', { ...config, notificationsEnabled: true })
    );
  });

  it('does not save as enabled when the browser permission request is denied', async () => {
    vi.stubGlobal('Notification', { permission: 'default' });
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', error: null, enable: mockEnable });
    mockGetReminderConfig.mockResolvedValue({ ...config, notificationsEnabled: false });
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Enable reminder notifications')).not.toBeChecked());

    mockEnable.mockImplementation(async () => {
      vi.stubGlobal('Notification', { permission: 'denied' });
    });
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Enable reminder notifications'));

    expect(await screen.findByText(/Enable notifications in your browser/)).toBeInTheDocument();
    expect(mockSaveReminderConfig).not.toHaveBeenCalledWith('user1', expect.objectContaining({ notificationsEnabled: true }));
  });

  it('shows a blocked message instead of a toggle when permission is denied', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'denied', error: null, enable: mockEnable });
    mockGetReminderConfig.mockResolvedValue(config);
    renderScreen();
    expect(await screen.findByText(/Blocked by your browser/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Enable reminder notifications')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: FAIL — no "Enable reminder notifications" checkbox exists yet.

- [ ] **Step 3: Implement the toggle in `SettingsScreen`**

In `src/domains/settings/SettingsScreen.tsx`, add the import (after the existing `resetAllTutorialFlags` import on line 10):

```typescript
import { useNotificationPermission } from '../../notifications/useNotificationPermission';
```

Inside the `SettingsScreen` component, after the existing `useTutorial` line (line 18), add:

```typescript
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
  const { status: notificationStatus, enable: enableNotifications } = useNotificationPermission(uid, vapidKey);
  const [notifError, setNotifError] = useState<string | null>(null);
```

After the existing `handleSave` function (after line 36), add:

```typescript
  async function handleNotificationsToggle(nextEnabled: boolean) {
    if (!config) return;
    setNotifError(null);
    if (nextEnabled) {
      await enableNotifications();
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        setNotifError('Enable notifications in your browser to turn this on.');
        return;
      }
    }
    const updated = { ...config, notificationsEnabled: nextEnabled };
    setConfig(updated);
    try {
      await saveReminderConfig(uid, updated);
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Failed to save notification preference');
    }
  }
```

Finally, add a new section between the closing `</section>` of the Reminders form (line 129) and the `<hr className="border-line" />` (line 130):

```typescript
      <section className="flex flex-col gap-3 max-w-sm">
        <p className={sectionLabelClass}>Notifications</p>
        {notificationStatus === 'denied' ? (
          <p className="text-sm text-muted">
            Blocked by your browser. Enable notifications for this site in your browser settings, then reload.
          </p>
        ) : (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={config.notificationsEnabled}
              onChange={(e) => handleNotificationsToggle(e.target.checked)}
            />
            Enable reminder notifications
          </label>
        )}
        {notifError && <p className="text-sm text-[#B3261E]">{notifError}</p>}
      </section>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: PASS (all tests, including the pre-existing ones)

- [ ] **Step 5: Run the full client test suite**

Run: `npx vitest run`
Expected: PASS (no regressions in other suites)

- [ ] **Step 6: Run the TypeScript build to catch type errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/settings/SettingsScreen.tsx src/domains/settings/SettingsScreen.test.tsx
git commit -m "feat: add Notifications toggle to Settings screen"
```

---

## Manual verification (not automated)

After all tasks are merged, verify by hand since push delivery timing and browser permission prompts can't be fully exercised by unit tests:

1. Run `npm run dev`, open the app, grant notification permission, and confirm the dashboard banner disappears and does not reappear on reload.
2. Deny permission in a fresh browser profile and confirm the banner never appears, and Settings shows the "Blocked by your browser" message.
3. In Settings, toggle notifications off, then check Firestore (`users/{uid}/config/reminders`) to confirm `notificationsEnabled: false` was written.
4. Deploy the worker (`cd workers/reminders && wrangler deploy`) and confirm in the Firebase Cloud Messaging send logs that outgoing messages include `android.priority: HIGH`.
