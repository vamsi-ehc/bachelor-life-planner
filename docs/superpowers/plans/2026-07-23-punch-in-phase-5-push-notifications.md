# Punch In — Phase 5: Push Notifications (Cloudflare Worker + FCM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver working reminder push notifications for Punch In — a Settings screen to edit reminder times, client-side notification-permission + FCM token registration wired into a custom offline-capable service worker, and a scheduled Cloudflare Worker that reads Firestore over its REST API and sends pushes via the FCM HTTP v1 API on a cron schedule.

**Architecture:** Firebase Cloud Functions + Cloud Scheduler (the original spec's backend choice) require the paid Blaze plan; this project stays on Firebase's free Spark plan instead and moves the "fire reminders" backend to a Cloudflare Worker (free tier, Cron Triggers included). The Worker has no access to `firebase-admin` (it doesn't run in the Workers runtime), so it authenticates as a Google Cloud service account, exchanges a hand-signed JWT for an OAuth access token via Web Crypto (`crypto.subtle`, available natively in the Workers runtime and in Node 20+), and calls the plain Firestore REST API and FCM HTTP v1 REST API directly with that token — no Firebase SDK needed server-side. Firestore security rules are not enforced for service-account-authenticated REST calls (only Firebase Auth end-user and unauthenticated requests are rule-checked), so the Worker has full read/write access to `users/{uid}/...` the same way the Admin SDK would. This is a single-user app (per the spec's Auth section), so the Worker is configured with one hardcoded `FIREBASE_UID` rather than iterating all users.

On the client: notification permission + FCM token registration follow the same hook+presentational-component split already used for the Phase 4 install prompt (`useInstallPrompt` + `InstallPrompt`). Receiving a push while the app is closed requires a service worker with Firebase Messaging's background-message handler wired in, which requires switching `vite-plugin-pwa` from its default `generateSW` strategy to `injectManifest` (a hand-written `src/sw.ts` that the plugin injects the precache manifest into) so `onBackgroundMessage` can be registered alongside Workbox precaching in the same service worker.

**Tech Stack:** Same as Phase 1-4 (Vite, React 18, TypeScript, Tailwind CSS, react-router-dom, Firebase JS SDK v10, Vitest, React Testing Library, `vite-plugin-pwa`) for the frontend. New for this phase: `firebase/messaging` and `firebase/messaging/sw` (already included in the existing `firebase` package — no new dependency), plus a new devDependency `workbox-precaching` (needed because `injectManifest` requires the app to import it directly, unlike `generateSW` which bundles Workbox internally). The Worker lives in its own directory (`workers/reminders/`) as an independent npm project with its own `package.json`, using `wrangler` (Cloudflare's CLI) and `vitest`, with zero runtime dependencies (only Web Crypto and `fetch`, both built into the Workers runtime).

## Global Constraints

- No Firebase Blaze plan, no Cloud Functions, no Cloud Scheduler, no `firebase-admin` — the backend is a Cloudflare Worker using hand-rolled Firestore REST + FCM v1 REST calls authenticated via a Google service-account JWT, per the user's explicit choice to use their existing Cloudflare account instead of upgrading Firebase billing.
- This is a single-user app: the Worker is configured with one `FIREBASE_UID` value (a Cloudflare env var), not a loop over all Firebase Auth users.
- Settings scope for this phase is exactly the 4 reminder times (workout, dinner, learning, weekly review) plus timezone — no chore/bill/category management UI, no dashboard "incomplete after cutoff hour" nudge. Those remain out of scope.
- Weekly review always fires on Sunday (matches the existing `isWeeklyReviewDue` dashboard logic, which hardcodes `dow === 0`) — there is no configurable weekly-review day, only a configurable time.
- Test suite must remain at zero warnings (no React `act()` warnings, no console noise) and `npm run build` must succeed after every frontend task — carried over as a hard bar from Phase 1-4. The Worker's own `npm test` (run from `workers/reminders/`) must pass after every Worker task.
- Follow established mocking conventions from Phase 1-4: `vi.mock('firebase/firestore', ...)` and `vi.mock('../../firebase/config', () => ({ db: {} }))` for Firestore API modules (see `src/domains/health/sleepApi.test.ts`); mock sibling hook/component modules the same way `App.test.tsx` mocks every screen.
- Dates are `YYYY-MM-DD` strings throughout the existing app (`src/domains/shared/dateUtils.ts`'s `todayId`/`dayOfWeek`/`dayOfMonth`/`daysInMonth`/`weekId`) — the Worker mirrors this format for its own date bookkeeping.
- The Worker's `workers/` directory must be excluded from the root project's `npm test` run (its own tests run via `workers/reminders`'s own `npm test`), the same way `.claude` and `worktrees` are already excluded in `vite.config.ts`.

---

## File Structure

```
workers/reminders/
  wrangler.toml                  — Cloudflare Worker config: cron triggers, env vars
  package.json                   — wrangler, typescript, vitest devDependencies; no runtime deps
  tsconfig.json                  — Workers-runtime TS config
  vitest.config.ts               — node-environment vitest config
  src/
    googleAuth.ts                 — service-account JWT signing + OAuth token exchange (Web Crypto)
    googleAuth.test.ts
    firestore.ts                  — Firestore REST helpers (get/list/patch/delete document, value encode/decode)
    firestore.test.ts
    fcm.ts                        — FCM HTTP v1 send helper
    fcm.test.ts
    dateUtils.ts                  — timezone-aware date/time helpers (Intl-based)
    dateUtils.test.ts
    reminders.ts                  — pure "should this reminder fire now" logic
    reminders.test.ts
    dueChecks.ts                  — ported bill-due / chore-due logic
    dueChecks.test.ts
    index.ts                      — scheduled handler: orchestrates the above, sends pushes
    index.test.ts

vite.config.ts                    — MODIFY: exclude workers/, switch VitePWA to injectManifest strategy
tsconfig.json                     — MODIFY: exclude src/sw.ts (webworker lib conflicts with DOM lib)
package.json                      — MODIFY: add workbox-precaching devDependency
src/sw.ts                         — custom service worker: Workbox precache + FCM background handler
src/domains/shared/types.ts       — MODIFY: add ReminderConfig type
src/domains/settings/
  reminderConfigApi.ts             — Firestore API for users/{uid}/config/reminders
  reminderConfigApi.test.ts
  SettingsScreen.tsx                — time-picker form for the 4 reminder times
  SettingsScreen.test.tsx
src/notifications/
  firebaseMessaging.ts              — wraps firebase/messaging: permission + token request
  firebaseMessaging.test.ts
  fcmTokensApi.ts                   — Firestore API for users/{uid}/fcmTokens/{token}
  fcmTokensApi.test.ts
  useNotificationPermission.ts      — hook: enable() -> requests permission, saves token
  useNotificationPermission.test.ts
  NotificationPermission.tsx        — banner component (mirrors InstallPrompt)
  NotificationPermission.test.tsx
src/App.tsx                       — MODIFY: mount NotificationPermission, add /settings route + nav link
src/App.test.tsx                  — MODIFY: mock the new components/screen
.env.example                      — MODIFY (or create): document VITE_FIREBASE_VAPID_KEY
```

---

## Part A — Cloudflare Worker (reminder backend)

### Task 1: Scaffold the Worker project

**Files:**
- Create: `workers/reminders/package.json`, `workers/reminders/tsconfig.json`, `workers/reminders/vitest.config.ts`, `workers/reminders/wrangler.toml`, `workers/reminders/src/index.ts`
- Modify: `vite.config.ts` (exclude `workers/` from the root test run)

**Interfaces:**
- Consumes: nothing yet
- Produces: a working `npm test` and `wrangler dev` in `workers/reminders/`; later tasks fill in `src/index.ts`'s real logic

This task requires Node 20+ locally (for `crypto.subtle` support used by later tasks and by `wrangler`'s own tooling) — verify with `node --version` before starting.

- [ ] **Step 1: Create the Worker's package.json**

Create `workers/reminders/package.json`:

```json
{
  "name": "punch-in-reminders-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241106.0",
    "typescript": "^5.2.2",
    "vitest": "^1.1.0",
    "wrangler": "^3.90.0"
  }
}
```

- [ ] **Step 2: Create the Worker's tsconfig.json**

Create `workers/reminders/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create the vitest config**

Create `workers/reminders/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 4: Create wrangler.toml**

Create `workers/reminders/wrangler.toml`:

```toml
name = "punch-in-reminders"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[triggers]
crons = ["*/15 * * * *"]

[vars]
FIREBASE_PROJECT_ID = "REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID"
FIREBASE_UID = "REPLACE_WITH_YOUR_FIREBASE_UID"
```

`GOOGLE_SERVICE_ACCOUNT_KEY` is not set here — it's a secret, set later via `wrangler secret put` (Task 8), never committed to source.

- [ ] **Step 5: Create a placeholder handler**

Create `workers/reminders/src/index.ts`:

```ts
export default {
  async fetch(): Promise<Response> {
    return new Response('ok');
  },
};
```

- [ ] **Step 6: Install dependencies and verify**

```bash
cd workers/reminders && npm install
```

Run: `npm test`
Expected: PASS (0 tests, since none exist yet — vitest exits 0 with "No test files found" only if configured to fail on that; if it errors, add a trivial placeholder test file `src/index.test.ts` with `import { describe, it, expect } from 'vitest'; describe('placeholder', () => { it('passes', () => { expect(true).toBe(true); }); });` — this file will be replaced by Task 7's real tests, so it's fine to overwrite later.)

- [ ] **Step 7: Exclude workers/ from the root test run**

In the root `vite.config.ts`, modify the `test.exclude` array:

```ts
    exclude: ['**/node_modules/**', '**/.claude/**', '**/.worktrees/**', '**/worktrees/**', '**/workers/**'],
```

- [ ] **Step 8: Verify the root suite still passes**

Run (from repo root): `npm test`
Expected: PASS, same test count as before this task

- [ ] **Step 9: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/package.json workers/reminders/package-lock.json workers/reminders/tsconfig.json workers/reminders/vitest.config.ts workers/reminders/wrangler.toml workers/reminders/src/index.ts vite.config.ts
git commit -m "chore: scaffold Cloudflare Worker project for reminder push notifications"
```

If a placeholder test file was added in Step 6, include `workers/reminders/src/index.test.ts` in the `git add` (it will be overwritten by Task 7).

---

### Task 2: Google service-account authentication

**Files:**
- Create: `workers/reminders/src/googleAuth.ts`, `workers/reminders/src/googleAuth.test.ts`

**Interfaces:**
- Consumes: nothing (uses only the Workers runtime's global `crypto` and `fetch`)
- Produces: `ServiceAccountKey { client_email: string; private_key: string }`, `getAccessToken(key: ServiceAccountKey, scopes: string[]): Promise<string>` — later tasks (7, 8) parse `env.GOOGLE_SERVICE_ACCOUNT_KEY` (a JSON string secret) into a `ServiceAccountKey` and call this.

- [ ] **Step 1: Write the failing test**

Create `workers/reminders/src/googleAuth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken } from './googleAuth';

function arrayBufferToPem(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

async function makeTestKeyPem(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  return arrayBufferToPem(exported);
}

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('signs a JWT and exchanges it for an access token', async () => {
    const privateKeyPem = await makeTestKeyPem();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'test-access-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await getAccessToken(
      { client_email: 'worker@test-project.iam.gserviceaccount.com', private_key: privateKeyPem },
      ['https://www.googleapis.com/auth/datastore'],
    );

    expect(token).toBe('test-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(options.method).toBe('POST');
    const body = options.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const assertion = body.get('assertion') ?? '';
    expect(assertion.split('.')).toHaveLength(3);
  });

  it('throws when the token endpoint rejects the request', async () => {
    const privateKeyPem = await makeTestKeyPem();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid_grant' }),
    );

    await expect(
      getAccessToken({ client_email: 'x@y.iam.gserviceaccount.com', private_key: privateKeyPem }, ['scope']),
    ).rejects.toThrow('Google token exchange failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers/reminders && npx vitest run src/googleAuth.test.ts`
Expected: FAIL with "Cannot find module './googleAuth'"

- [ ] **Step 3: Implement googleAuth.ts**

Create `workers/reminders/src/googleAuth.ts`:

```ts
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(data: ArrayBuffer | string): string {
  let base64: string;
  if (typeof data === 'string') {
    base64 = btoa(unescape(encodeURIComponent(data)));
  } else {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function getAccessToken(key: ServiceAccountKey, scopes: string[]): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(key.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/googleAuth.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/src/googleAuth.ts workers/reminders/src/googleAuth.test.ts
git commit -m "feat(worker): add Google service-account JWT auth for Firestore/FCM REST calls"
```

---

### Task 3: Firestore REST helpers

**Files:**
- Create: `workers/reminders/src/firestore.ts`, `workers/reminders/src/firestore.test.ts`

**Interfaces:**
- Consumes: an OAuth access token (from Task 2's `getAccessToken`)
- Produces: `getDocument(projectId, accessToken, path): Promise<Record<string, unknown> | null>`, `listDocuments(projectId, accessToken, path): Promise<Array<{ id: string; data: Record<string, unknown> }>>`, `patchDocument(projectId, accessToken, path, fields): Promise<void>`, `deleteDocument(projectId, accessToken, path): Promise<void>` — `path` is a Firestore document/collection path relative to `projects/{projectId}/databases/(default)/documents/`, e.g. `users/abc123/config/reminders`

- [ ] **Step 1: Write the failing test**

Create `workers/reminders/src/firestore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocument, listDocuments, patchDocument, deleteDocument } from './firestore';

describe('getDocument', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('decodes string, integer, boolean, and map fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          fields: {
            workoutTime: { stringValue: '06:45' },
            cutoffHour: { integerValue: '21' },
            workout: { booleanValue: true },
            chores: { mapValue: { fields: { abc: { booleanValue: true } } } },
          },
        }),
      }),
    );

    const result = await getDocument('proj1', 'token1', 'users/u1/config/reminders');

    expect(result).toEqual({
      workoutTime: '06:45',
      cutoffHour: 21,
      workout: true,
      chores: { abc: true },
    });
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await getDocument('proj1', 'token1', 'users/u1/config/reminders');
    expect(result).toBeNull();
  });
});

describe('listDocuments', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns id + decoded data for each document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: [
            {
              name: 'projects/proj1/databases/(default)/documents/users/u1/bills/bill1',
              fields: { name: { stringValue: 'Rent' }, dueDay: { integerValue: '1' } },
            },
          ],
        }),
      }),
    );

    const result = await listDocuments('proj1', 'token1', 'users/u1/bills');

    expect(result).toEqual([{ id: 'bill1', data: { name: 'Rent', dueDay: 1 } }]);
  });

  it('returns an empty array when there are no documents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const result = await listDocuments('proj1', 'token1', 'users/u1/bills');
    expect(result).toEqual([]);
  });
});

describe('patchDocument', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a PATCH with an updateMask for each field and encoded values', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await patchDocument('proj1', 'token1', 'users/u1/reminderState/workout', { lastSentDate: '2026-07-23' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('updateMask.fieldPaths=lastSentDate');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ fields: { lastSentDate: { stringValue: '2026-07-23' } } });
  });
});

describe('deleteDocument', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a DELETE request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await deleteDocument('proj1', 'token1', 'users/u1/fcmTokens/abc');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/firestore.test.ts`
Expected: FAIL with "Cannot find module './firestore'"

- [ ] **Step 3: Implement firestore.ts**

Create `workers/reminders/src/firestore.ts`:

```ts
type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function decodeValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  return null;
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = encodeValue(v);
  return fields;
}

function decodeFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) result[k] = decodeValue(v);
  return result;
}

function baseUrl(projectId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function getDocument(
  projectId: string,
  accessToken: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${baseUrl(projectId)}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore getDocument failed: ${response.status}`);
  const json = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  return decodeFields(json.fields);
}

export async function listDocuments(
  projectId: string,
  accessToken: string,
  path: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const response = await fetch(`${baseUrl(projectId)}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Firestore listDocuments failed: ${response.status}`);
  const json = (await response.json()) as {
    documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }>;
  };
  return (json.documents ?? []).map((d) => ({
    id: d.name.split('/').pop() as string,
    data: decodeFields(d.fields),
  }));
}

export async function patchDocument(
  projectId: string,
  accessToken: string,
  path: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const mask = Object.keys(fields)
    .map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`)
    .join('&');
  const response = await fetch(`${baseUrl(projectId)}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });
  if (!response.ok) throw new Error(`Firestore patchDocument failed: ${response.status}`);
}

export async function deleteDocument(projectId: string, accessToken: string, path: string): Promise<void> {
  const response = await fetch(`${baseUrl(projectId)}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Firestore deleteDocument failed: ${response.status}`);
  }
}
```

`patchDocument` with an `updateMask` both updates existing fields and creates the document (with just those fields) if it doesn't exist yet — this is relied on in Task 7 to lazily create `reminderState` documents on first fire.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/firestore.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/src/firestore.ts workers/reminders/src/firestore.test.ts
git commit -m "feat(worker): add Firestore REST API helpers with value encode/decode"
```

---

### Task 4: FCM v1 send helper

**Files:**
- Create: `workers/reminders/src/fcm.ts`, `workers/reminders/src/fcm.test.ts`

**Interfaces:**
- Consumes: an OAuth access token with the `firebase.messaging` scope (from Task 2)
- Produces: `sendPush(params: { projectId: string; accessToken: string; token: string; title: string; body: string }): Promise<{ ok: boolean; invalidToken: boolean }>`

- [ ] **Step 1: Write the failing test**

Create `workers/reminders/src/fcm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPush } from './fcm';

describe('sendPush', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('posts a notification message to the FCM v1 endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendPush({
      projectId: 'proj1',
      accessToken: 'token1',
      token: 'device-token',
      title: 'Workout time',
      body: "It's time for your workout.",
    });

    expect(result).toEqual({ ok: true, invalidToken: false });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/proj1/messages:send');
    expect(JSON.parse(options.body)).toEqual({
      message: { token: 'device-token', notification: { title: 'Workout time', body: "It's time for your workout." } },
    });
  });

  it('reports invalidToken when FCM returns UNREGISTERED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { status: 'UNREGISTERED' } }) }),
    );

    const result = await sendPush({ projectId: 'proj1', accessToken: 'token1', token: 'stale', title: 't', body: 'b' });

    expect(result).toEqual({ ok: false, invalidToken: true });
  });

  it('does not report invalidToken for other errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { status: 'INTERNAL' } }) }),
    );

    const result = await sendPush({ projectId: 'proj1', accessToken: 'token1', token: 't', title: 't', body: 'b' });

    expect(result).toEqual({ ok: false, invalidToken: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fcm.test.ts`
Expected: FAIL with "Cannot find module './fcm'"

- [ ] **Step 3: Implement fcm.ts**

Create `workers/reminders/src/fcm.ts`:

```ts
export interface SendPushParams {
  projectId: string;
  accessToken: string;
  token: string;
  title: string;
  body: string;
}

export interface SendPushResult {
  ok: boolean;
  invalidToken: boolean;
}

export async function sendPush(params: SendPushParams): Promise<SendPushResult> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${params.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: params.token,
        notification: { title: params.title, body: params.body },
      },
    }),
  });
  if (response.ok) return { ok: true, invalidToken: false };

  const errorBody = (await response.json().catch(() => null)) as { error?: { status?: string } } | null;
  const status = errorBody?.error?.status;
  const invalidToken = status === 'UNREGISTERED' || status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT';
  return { ok: false, invalidToken };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/fcm.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/src/fcm.ts workers/reminders/src/fcm.test.ts
git commit -m "feat(worker): add FCM HTTP v1 send helper with invalid-token detection"
```

---

### Task 5: Timezone-aware date/time helpers and reminder-firing logic

**Files:**
- Create: `workers/reminders/src/dateUtils.ts`, `workers/reminders/src/dateUtils.test.ts`, `workers/reminders/src/reminders.ts`, `workers/reminders/src/reminders.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions over `Date` and IANA timezone strings, using `Intl.DateTimeFormat`)
- Produces: `zonedParts`, `zonedDateId(date, timeZone): string`, `zonedMinutesSinceMidnight(date, timeZone): number`, `zonedWeekday(date, timeZone): number` (0=Sunday) from `dateUtils.ts`; `parseHHMM(hhmm): number`, `shouldFireDaily(now, timeZone, configuredTime, lastSentDate, windowMinutes?): { fire: boolean; todayId: string }`, `shouldFireWeekly(now, timeZone, configuredTime, targetWeekday, lastSentDate, windowMinutes?): { fire: boolean; todayId: string }` from `reminders.ts`

- [ ] **Step 1: Write the failing test for dateUtils**

Create `workers/reminders/src/dateUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { zonedDateId, zonedMinutesSinceMidnight, zonedWeekday } from './dateUtils';

describe('zonedDateId', () => {
  it('formats the date in UTC', () => {
    expect(zonedDateId(new Date('2026-07-23T10:00:00Z'), 'UTC')).toBe('2026-07-23');
  });

  it('rolls the date back a day for a negative-offset timezone before local midnight', () => {
    // 2026-07-23T02:00:00Z is 2026-07-22T21:00:00 in America/New_York (UTC-5 in July... actually UTC-4 DST)
    expect(zonedDateId(new Date('2026-07-23T02:00:00Z'), 'America/New_York')).toBe('2026-07-22');
  });
});

describe('zonedMinutesSinceMidnight', () => {
  it('returns 0 at midnight UTC', () => {
    expect(zonedMinutesSinceMidnight(new Date('2026-07-23T00:00:00Z'), 'UTC')).toBe(0);
  });

  it('returns 405 at 06:45 UTC', () => {
    expect(zonedMinutesSinceMidnight(new Date('2026-07-23T06:45:00Z'), 'UTC')).toBe(405);
  });

  it('accounts for a fixed non-UTC offset (Asia/Kolkata, UTC+5:30, no DST)', () => {
    // 2026-07-23T01:15:00Z is 2026-07-23T06:45:00 in Asia/Kolkata
    expect(zonedMinutesSinceMidnight(new Date('2026-07-23T01:15:00Z'), 'Asia/Kolkata')).toBe(405);
  });
});

describe('zonedWeekday', () => {
  it('returns 0 for a Sunday (2026-07-19 is a Sunday)', () => {
    expect(zonedWeekday(new Date('2026-07-19T12:00:00Z'), 'UTC')).toBe(0);
  });

  it('returns 4 for a Thursday (2026-07-23 is a Thursday)', () => {
    expect(zonedWeekday(new Date('2026-07-23T12:00:00Z'), 'UTC')).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dateUtils.test.ts`
Expected: FAIL with "Cannot find module './dateUtils'"

- [ ] **Step 3: Implement dateUtils.ts**

Create `workers/reminders/src/dateUtils.ts`:

```ts
export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function zonedDateId(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function zonedMinutesSinceMidnight(date: Date, timeZone: string): number {
  const { hour, minute } = zonedParts(date, timeZone);
  return hour * 60 + minute;
}

export function zonedWeekday(date: Date, timeZone: string): number {
  const { year, month, day } = zonedParts(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dateUtils.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing test for reminders.ts**

Create `workers/reminders/src/reminders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseHHMM, shouldFireDaily, shouldFireWeekly } from './reminders';

describe('parseHHMM', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(parseHHMM('06:45')).toBe(405);
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('23:59')).toBe(1439);
  });
});

describe('shouldFireDaily', () => {
  it('fires when now is within the window of the configured time and not already sent today', () => {
    const now = new Date('2026-07-23T06:50:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', null);
    expect(result).toEqual({ fire: true, todayId: '2026-07-23' });
  });

  it('does not fire when outside the window', () => {
    const now = new Date('2026-07-23T07:30:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', null);
    expect(result.fire).toBe(false);
  });

  it('does not fire twice on the same day even if within the window', () => {
    const now = new Date('2026-07-23T06:50:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', '2026-07-23');
    expect(result.fire).toBe(false);
  });

  it('fires again on a new day', () => {
    const now = new Date('2026-07-24T06:50:00Z');
    const result = shouldFireDaily(now, 'UTC', '06:45', '2026-07-23');
    expect(result).toEqual({ fire: true, todayId: '2026-07-24' });
  });
});

describe('shouldFireWeekly', () => {
  it('fires on the target weekday within the time window', () => {
    // 2026-07-19 is a Sunday
    const now = new Date('2026-07-19T18:05:00Z');
    const result = shouldFireWeekly(now, 'UTC', '18:00', 0, null);
    expect(result).toEqual({ fire: true, todayId: '2026-07-19' });
  });

  it('does not fire on a non-target weekday', () => {
    const now = new Date('2026-07-20T18:05:00Z'); // Monday
    const result = shouldFireWeekly(now, 'UTC', '18:00', 0, null);
    expect(result.fire).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/reminders.test.ts`
Expected: FAIL with "Cannot find module './reminders'"

- [ ] **Step 7: Implement reminders.ts**

Create `workers/reminders/src/reminders.ts`:

```ts
import { zonedDateId, zonedMinutesSinceMidnight, zonedWeekday } from './dateUtils';

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export interface FireCheck {
  fire: boolean;
  todayId: string;
}

export function shouldFireDaily(
  now: Date,
  timeZone: string,
  configuredTime: string,
  lastSentDate: string | null,
  windowMinutes = 15,
): FireCheck {
  const todayId = zonedDateId(now, timeZone);
  if (lastSentDate === todayId) return { fire: false, todayId };
  const diff = Math.abs(zonedMinutesSinceMidnight(now, timeZone) - parseHHMM(configuredTime));
  return { fire: diff < windowMinutes, todayId };
}

export function shouldFireWeekly(
  now: Date,
  timeZone: string,
  configuredTime: string,
  targetWeekday: number,
  lastSentDate: string | null,
  windowMinutes = 15,
): FireCheck {
  const todayId = zonedDateId(now, timeZone);
  if (lastSentDate === todayId) return { fire: false, todayId };
  if (zonedWeekday(now, timeZone) !== targetWeekday) return { fire: false, todayId };
  const diff = Math.abs(zonedMinutesSinceMidnight(now, timeZone) - parseHHMM(configuredTime));
  return { fire: diff < windowMinutes, todayId };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/reminders.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 9: Run the full worker suite**

Run: `npm test`
Expected: PASS, all tests from Tasks 2-5

- [ ] **Step 10: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/src/dateUtils.ts workers/reminders/src/dateUtils.test.ts workers/reminders/src/reminders.ts workers/reminders/src/reminders.test.ts
git commit -m "feat(worker): add timezone-aware date helpers and reminder-firing logic"
```

---

### Task 6: Ported bill-due and chore-due checks

**Files:**
- Create: `workers/reminders/src/dueChecks.ts`, `workers/reminders/src/dueChecks.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions)
- Produces: `Bill { id, name, amount, dueDay, category }`, `ChoreConfig { id, name, cadence: 'daily' | 'weekly', weeklyDays?: number[] }`, `isBillDueToday(bill, dayOfMonth, daysInMonth): boolean`, `isChoreDueToday(chore, dow): boolean`, `daysInMonthFor(year, month): number` (month is 1-12)

This mirrors `src/domains/finances/billsApi.ts`'s `isBillDueToday` and `src/domains/chores/choresApi.ts`'s `isChoreDueToday` exactly (same field names, same "clamp to last day of short months" rule) — the Worker can't import from `src/` (separate npm project, separate runtime), so the logic is duplicated here deliberately.

- [ ] **Step 1: Write the failing test**

Create `workers/reminders/src/dueChecks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isBillDueToday, isChoreDueToday, daysInMonthFor, Bill, ChoreConfig } from './dueChecks';

describe('isBillDueToday', () => {
  const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'housing' };

  it('is due when dueDay matches the day of month', () => {
    expect(isBillDueToday(bill, 1, 31)).toBe(true);
    expect(isBillDueToday(bill, 2, 31)).toBe(false);
  });

  it('clamps to the last day of a short month', () => {
    const lateBill: Bill = { ...bill, dueDay: 31 };
    expect(isBillDueToday(lateBill, 28, 28)).toBe(true); // Feb, non-leap
    expect(isBillDueToday(lateBill, 27, 28)).toBe(false);
  });
});

describe('isChoreDueToday', () => {
  it('is always due for a daily chore', () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    expect(isChoreDueToday(chore, 3)).toBe(true);
  });

  it('is due only on configured weekdays for a weekly chore', () => {
    const chore: ChoreConfig = { id: 'c2', name: 'Trash', cadence: 'weekly', weeklyDays: [1, 4] };
    expect(isChoreDueToday(chore, 1)).toBe(true);
    expect(isChoreDueToday(chore, 4)).toBe(true);
    expect(isChoreDueToday(chore, 2)).toBe(false);
  });

  it('is not due when a weekly chore has no configured days', () => {
    const chore: ChoreConfig = { id: 'c3', name: 'Laundry', cadence: 'weekly' };
    expect(isChoreDueToday(chore, 1)).toBe(false);
  });
});

describe('daysInMonthFor', () => {
  it('returns 28 for February of a non-leap year', () => {
    expect(daysInMonthFor(2026, 2)).toBe(28);
  });

  it('returns 31 for July', () => {
    expect(daysInMonthFor(2026, 7)).toBe(31);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dueChecks.test.ts`
Expected: FAIL with "Cannot find module './dueChecks'"

- [ ] **Step 3: Implement dueChecks.ts**

Create `workers/reminders/src/dueChecks.ts`:

```ts
export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
}

export interface ChoreConfig {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}

export function isBillDueToday(bill: Bill, dayOfMonth: number, daysInMonth: number): boolean {
  return bill.dueDay === dayOfMonth || (dayOfMonth === daysInMonth && bill.dueDay > daysInMonth);
}

export function isChoreDueToday(chore: ChoreConfig, dow: number): boolean {
  if (chore.cadence === 'daily') return true;
  return chore.weeklyDays?.includes(dow) ?? false;
}

export function daysInMonthFor(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dueChecks.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/src/dueChecks.ts workers/reminders/src/dueChecks.test.ts
git commit -m "feat(worker): port bill-due and chore-due logic from the dashboard"
```

---

### Task 7: Scheduled handler — orchestrate everything

**Files:**
- Modify: `workers/reminders/src/index.ts`
- Create/Modify: `workers/reminders/src/index.test.ts` (replaces the Task 1 placeholder, if one was added)

**Interfaces:**
- Consumes: `getAccessToken` (Task 2), `getDocument`/`listDocuments`/`patchDocument`/`deleteDocument` (Task 3), `sendPush` (Task 4), `zonedParts`/`zonedDateId`/`zonedWeekday` (Task 5's `dateUtils.ts`), `shouldFireDaily`/`shouldFireWeekly` (Task 5's `reminders.ts`), `isBillDueToday`/`isChoreDueToday`/`daysInMonthFor`/`Bill`/`ChoreConfig` (Task 6)
- Produces: `Env { GOOGLE_SERVICE_ACCOUNT_KEY: string; FIREBASE_PROJECT_ID: string; FIREBASE_UID: string }`, `runReminderCheck(env: Env, now?: Date): Promise<void>`, and the default export's `scheduled` handler that Cloudflare invokes on each cron tick

Reads `users/{uid}/config/reminders` for the 4 configured times + timezone (defaulting to hardcoded values if the doc doesn't exist yet — i.e. before the Settings screen from Task 10 has ever been saved), checks `users/{uid}/reminderState/{key}` for per-reminder dedup, and for bill/chore due-today also reads `users/{uid}/bills`, `users/{uid}/chores`, and today's `users/{uid}/completions/{date}` to skip already-completed chores. Sends one push per fired reminder to every token in `users/{uid}/fcmTokens`, cleaning up invalid tokens as it goes.

- [ ] **Step 1: Write the failing test**

Create `workers/reminders/src/index.test.ts` (overwrite the Task 1 placeholder if present):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAccessToken = vi.fn();
const mockGetDocument = vi.fn();
const mockListDocuments = vi.fn();
const mockPatchDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockSendPush = vi.fn();

vi.mock('./googleAuth', () => ({ getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args) }));
vi.mock('./firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  listDocuments: (...args: unknown[]) => mockListDocuments(...args),
  patchDocument: (...args: unknown[]) => mockPatchDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}));
vi.mock('./fcm', () => ({ sendPush: (...args: unknown[]) => mockSendPush(...args) }));

import { runReminderCheck, Env } from './index';

const env: Env = {
  GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: 'key' }),
  FIREBASE_PROJECT_ID: 'proj1',
  FIREBASE_UID: 'uid1',
};

describe('runReminderCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('access-token');
    mockSendPush.mockResolvedValue({ ok: true, invalidToken: false });
    mockPatchDocument.mockResolvedValue(undefined);
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  it('sends the workout push and updates state when the configured time matches', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      return null; // no reminderState docs yet, no completion doc
    });
    mockListDocuments.mockResolvedValue([]); // no bills, chores, or fcmTokens by default

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockGetAccessToken).toHaveBeenCalledWith(
      { client_email: 'x@y.iam.gserviceaccount.com', private_key: 'key' },
      ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging'],
    );
    // No tokens registered, so sendPush is never called, but state is still updated for the fired reminder.
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockPatchDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid1/reminderState/workout', {
      lastSentDate: '2026-07-23',
    });
  });

  it('sends a push to every registered token when a reminder fires', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      return null;
    });
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/fcmTokens') {
        return [{ id: 'tok-a', data: { token: 'tok-a' } }, { id: 'tok-b', data: { token: 'tok-b' } }];
      }
      return [];
    });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).toHaveBeenCalledTimes(2);
    expect(mockSendPush).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-a', title: 'Workout time' }),
    );
  });

  it('does not fire the workout reminder again once lastSentDate matches today', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      if (path === 'users/uid1/reminderState/workout') return { lastSentDate: '2026-07-23' };
      return null;
    });
    mockListDocuments.mockResolvedValue([]);

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockPatchDocument).not.toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'users/uid1/reminderState/workout', expect.anything(),
    );
  });

  it('bundles due bill names into a single push and skips a completed chore', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      if (path === 'users/uid1/completions/2026-07-23') return { chores: { chore1: true } };
      return null;
    });
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/bills') return [{ id: 'b1', data: { name: 'Rent', amount: 1200, dueDay: 23, category: 'housing' } }];
      if (path === 'users/uid1/chores') {
        return [
          { id: 'chore1', data: { name: 'Dishes', cadence: 'daily' } },
          { id: 'chore2', data: { name: 'Trash', cadence: 'daily' } },
        ];
      }
      if (path === 'users/uid1/fcmTokens') return [{ id: 'tok-a', data: { token: 'tok-a' } }];
      return [];
    });

    await runReminderCheck(env, new Date('2026-07-23T07:30:00Z'));

    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bills due today', body: 'Rent' }));
    expect(mockSendPush).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chores due today', body: 'Trash' }));
  });

  it('deletes a token that FCM reports as unregistered', async () => {
    mockGetDocument.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/config/reminders') {
        return { workoutTime: '06:45', dinnerTime: '19:00', learningTime: '20:00', weeklyReviewTime: '18:00', timezone: 'UTC' };
      }
      return null;
    });
    mockListDocuments.mockImplementation(async (_p: string, _t: string, path: string) => {
      if (path === 'users/uid1/fcmTokens') return [{ id: 'stale-token', data: { token: 'stale-token' } }];
      return [];
    });
    mockSendPush.mockResolvedValue({ ok: false, invalidToken: true });

    await runReminderCheck(env, new Date('2026-07-23T06:50:00Z'));

    expect(mockDeleteDocument).toHaveBeenCalledWith('proj1', 'access-token', 'users/uid1/fcmTokens/stale-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL (either "Cannot find module" for missing exports, or assertion failures against the Task 1 placeholder)

- [ ] **Step 3: Implement the scheduled handler**

Replace `workers/reminders/src/index.ts`:

```ts
import { getAccessToken, ServiceAccountKey } from './googleAuth';
import { getDocument, listDocuments, patchDocument, deleteDocument } from './firestore';
import { sendPush } from './fcm';
import { zonedParts, zonedDateId, zonedWeekday } from './dateUtils';
import { shouldFireDaily, shouldFireWeekly } from './reminders';
import { isBillDueToday, isChoreDueToday, daysInMonthFor, Bill, ChoreConfig } from './dueChecks';

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_UID: string;
}

interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
}

const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

const MORNING_CHECK_TIME = '07:30';

const SCOPES = ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging'];

interface DailyReminderDef {
  key: string;
  getTime: (config: ReminderConfig) => string;
  title: string;
  body: string;
}

const DAILY_REMINDERS: DailyReminderDef[] = [
  { key: 'workout', getTime: (c) => c.workoutTime, title: 'Workout time', body: "It's time for your workout." },
  { key: 'dinner', getTime: (c) => c.dinnerTime, title: 'Dinner prep', body: 'Time to start prepping dinner.' },
  { key: 'learning', getTime: (c) => c.learningTime, title: 'Learning time', body: "It's time for your learning session." },
];

function decodeReminderConfig(data: Record<string, unknown> | null): ReminderConfig {
  if (!data) return DEFAULT_REMINDER_CONFIG;
  return {
    workoutTime: typeof data.workoutTime === 'string' ? data.workoutTime : DEFAULT_REMINDER_CONFIG.workoutTime,
    dinnerTime: typeof data.dinnerTime === 'string' ? data.dinnerTime : DEFAULT_REMINDER_CONFIG.dinnerTime,
    learningTime: typeof data.learningTime === 'string' ? data.learningTime : DEFAULT_REMINDER_CONFIG.learningTime,
    weeklyReviewTime:
      typeof data.weeklyReviewTime === 'string' ? data.weeklyReviewTime : DEFAULT_REMINDER_CONFIG.weeklyReviewTime,
    timezone: typeof data.timezone === 'string' ? data.timezone : DEFAULT_REMINDER_CONFIG.timezone,
  };
}

function lastSentDateOf(state: Record<string, unknown> | null): string | null {
  return typeof state?.lastSentDate === 'string' ? state.lastSentDate : null;
}

interface PushJob {
  key: string;
  todayId: string;
  title: string;
  body: string;
}

export async function runReminderCheck(env: Env, now: Date = new Date()): Promise<void> {
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY) as ServiceAccountKey;
  const accessToken = await getAccessToken(key, SCOPES);
  const projectId = env.FIREBASE_PROJECT_ID;
  const base = `users/${env.FIREBASE_UID}`;

  const configData = await getDocument(projectId, accessToken, `${base}/config/reminders`);
  const config = decodeReminderConfig(configData);

  const jobs: PushJob[] = [];

  for (const reminder of DAILY_REMINDERS) {
    const state = await getDocument(projectId, accessToken, `${base}/reminderState/${reminder.key}`);
    const check = shouldFireDaily(now, config.timezone, reminder.getTime(config), lastSentDateOf(state));
    if (check.fire) jobs.push({ key: reminder.key, todayId: check.todayId, title: reminder.title, body: reminder.body });
  }

  const reviewState = await getDocument(projectId, accessToken, `${base}/reminderState/weeklyReview`);
  const reviewCheck = shouldFireWeekly(now, config.timezone, config.weeklyReviewTime, 0, lastSentDateOf(reviewState));
  if (reviewCheck.fire) {
    jobs.push({ key: 'weeklyReview', todayId: reviewCheck.todayId, title: 'Weekly review', body: 'Time for your weekly review.' });
  }

  const billState = await getDocument(projectId, accessToken, `${base}/reminderState/billDue`);
  const billCheck = shouldFireDaily(now, config.timezone, MORNING_CHECK_TIME, lastSentDateOf(billState));
  if (billCheck.fire) {
    const { year, month, day } = zonedParts(now, config.timezone);
    const bills = await listDocuments(projectId, accessToken, `${base}/bills`);
    const dueBills = bills
      .map((d) => ({ id: d.id, ...d.data }) as Bill)
      .filter((bill) => isBillDueToday(bill, day, daysInMonthFor(year, month)));
    if (dueBills.length > 0) {
      jobs.push({ key: 'billDue', todayId: billCheck.todayId, title: 'Bills due today', body: dueBills.map((b) => b.name).join(', ') });
    } else {
      await patchDocument(projectId, accessToken, `${base}/reminderState/billDue`, { lastSentDate: billCheck.todayId });
    }
  }

  const choreState = await getDocument(projectId, accessToken, `${base}/reminderState/choreDue`);
  const choreCheck = shouldFireDaily(now, config.timezone, MORNING_CHECK_TIME, lastSentDateOf(choreState));
  if (choreCheck.fire) {
    const dow = zonedWeekday(now, config.timezone);
    const todayId = zonedDateId(now, config.timezone);
    const chores = await listDocuments(projectId, accessToken, `${base}/chores`);
    const completion = await getDocument(projectId, accessToken, `${base}/completions/${todayId}`);
    const completedChoreIds = (completion?.chores as Record<string, boolean> | undefined) ?? {};
    const dueChores = chores
      .map((d) => ({ id: d.id, ...d.data }) as ChoreConfig)
      .filter((chore) => isChoreDueToday(chore, dow) && !completedChoreIds[chore.id]);
    if (dueChores.length > 0) {
      jobs.push({ key: 'choreDue', todayId: choreCheck.todayId, title: 'Chores due today', body: dueChores.map((c) => c.name).join(', ') });
    } else {
      await patchDocument(projectId, accessToken, `${base}/reminderState/choreDue`, { lastSentDate: choreCheck.todayId });
    }
  }

  if (jobs.length === 0) return;

  const tokens = await listDocuments(projectId, accessToken, `${base}/fcmTokens`);

  for (const job of jobs) {
    for (const tokenDoc of tokens) {
      const token = tokenDoc.data.token as string;
      const result = await sendPush({ projectId, accessToken, token, title: job.title, body: job.body });
      if (result.invalidToken) {
        await deleteDocument(projectId, accessToken, `${base}/fcmTokens/${tokenDoc.id}`);
      }
    }
    await patchDocument(projectId, accessToken, `${base}/reminderState/${job.key}`, { lastSentDate: job.todayId });
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response('ok');
  },
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(runReminderCheck(env));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/index.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full worker suite**

Run: `npm test`
Expected: PASS, all Worker tests from Tasks 2-7

- [ ] **Step 6: Type-check the Worker**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/src/index.ts workers/reminders/src/index.test.ts
git commit -m "feat(worker): wire up the scheduled reminder-check handler"
```

---

### Task 8: Deploy the Worker (manual — no code)

**Files:** none (verification/setup-only task)

**Interfaces:** none

- [ ] **Step 1: Generate a Google Cloud service-account key**

In the Google Cloud Console (console.cloud.google.com), select the project backing this Firebase project, go to IAM & Admin → Service Accounts → Create Service Account. Grant it the **Cloud Datastore User** role (for Firestore REST access) and the **Firebase Cloud Messaging API Admin** role (for sending pushes). Create a JSON key and download it — this file is never committed to the repo.

- [ ] **Step 2: Fill in wrangler.toml's real values**

Edit `workers/reminders/wrangler.toml`, replacing the placeholders from Task 1 Step 4 with your real Firebase project ID (Firebase console → Project Settings → General → Project ID) and your Firebase Auth UID (Firebase console → Authentication → Users → the one user's User UID column).

- [ ] **Step 3: Log in to Cloudflare and set the secret**

```bash
cd workers/reminders
npx wrangler login
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

When prompted, paste the entire contents of the downloaded service-account JSON key file as a single line.

- [ ] **Step 4: Deploy**

```bash
npx wrangler deploy
```

Expected: output shows the Worker deployed with a `*/15 * * * *` cron trigger attached.

- [ ] **Step 5: Verify a manual trigger**

In the Cloudflare dashboard, go to Workers & Pages → punch-in-reminders → Triggers, and use "Trigger cron manually" if available, or wait up to 15 minutes for a real tick. Check Workers & Pages → punch-in-reminders → Logs for a successful invocation with no errors. At this point there are no FCM tokens registered yet (Part B hasn't been built), so no push is expected — the goal is confirming the Worker runs without throwing.

- [ ] **Step 6: Commit the wrangler.toml project-ID/UID fill-in**

```bash
cd /home/vamsi/Documents/bachelor-life-planner
git add workers/reminders/wrangler.toml
git commit -m "chore(worker): configure Firebase project ID and UID for the reminders Worker"
```

Confirm `wrangler.toml`'s `[vars]` values are non-secret before committing (Firebase project ID and a Firebase Auth UID are both fine to commit — they aren't credentials, and `wrangler.toml` is the standard place Cloudflare expects non-secret config). `GOOGLE_SERVICE_ACCOUNT_KEY` is never in this file — it went in as a `wrangler secret` in Step 3 and is stored encrypted by Cloudflare, not in source control.

---

## Part B — Frontend (Settings, permission UI, service worker)

### Task 9: ReminderConfig type and Firestore API

**Files:**
- Modify: `src/domains/shared/types.ts`
- Create: `src/domains/settings/reminderConfigApi.ts`, `src/domains/settings/reminderConfigApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`
- Produces: `ReminderConfig` type, `DEFAULT_REMINDER_CONFIG`, `getReminderConfig(uid): Promise<ReminderConfig>`, `saveReminderConfig(uid, config): Promise<void>` — read by Task 10's `SettingsScreen`, and by the Worker (Task 7) at the Firestore path `users/{uid}/config/reminders`, whose field names must match exactly

- [ ] **Step 1: Add the ReminderConfig type**

In `src/domains/shared/types.ts`, add:

```ts
export interface ReminderConfig {
  workoutTime: string;
  dinnerTime: string;
  learningTime: string;
  weeklyReviewTime: string;
  timezone: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/domains/settings/reminderConfigApi.test.ts`:

```ts
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
  });

  it('defaults missing fields when the doc exists but is partial', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ workoutTime: '07:00' }) });
    const result = await getReminderConfig('user1');
    expect(result.workoutTime).toBe('07:00');
    expect(result.dinnerTime).toBe(DEFAULT_REMINDER_CONFIG.dinnerTime);
  });

  it('returns the stored config when present', async () => {
    const stored = {
      workoutTime: '07:00',
      dinnerTime: '18:30',
      learningTime: '20:30',
      weeklyReviewTime: '17:00',
      timezone: 'America/New_York',
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getReminderConfig('user1');
    expect(result).toEqual(stored);
  });
});

describe('saveReminderConfig', () => {
  beforeEach(() => mockSetDoc.mockReset());

  it('writes all 5 fields', async () => {
    const config = {
      workoutTime: '07:00',
      dinnerTime: '18:30',
      learningTime: '20:30',
      weeklyReviewTime: '17:00',
      timezone: 'America/New_York',
    };
    await saveReminderConfig('user1', config);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), config);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/domains/settings/reminderConfigApi.test.ts`
Expected: FAIL with "Cannot find module './reminderConfigApi'"

- [ ] **Step 4: Implement reminderConfigApi.ts**

Create `src/domains/settings/reminderConfigApi.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ReminderConfig } from '../shared/types';

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  };
}

export async function saveReminderConfig(uid: string, config: ReminderConfig): Promise<void> {
  await setDoc(reminderConfigDocRef(uid), {
    workoutTime: config.workoutTime,
    dinnerTime: config.dinnerTime,
    learningTime: config.learningTime,
    weeklyReviewTime: config.weeklyReviewTime,
    timezone: config.timezone,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/domains/settings/reminderConfigApi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full frontend suite**

Run (from repo root): `npm test`
Expected: PASS, no regressions

- [ ] **Step 7: Commit**

```bash
git add src/domains/shared/types.ts src/domains/settings/reminderConfigApi.ts src/domains/settings/reminderConfigApi.test.ts
git commit -m "feat: add ReminderConfig type and Firestore API"
```

---

### Task 10: Settings screen

**Files:**
- Create: `src/domains/settings/SettingsScreen.tsx`, `src/domains/settings/SettingsScreen.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `getReminderConfig`, `saveReminderConfig` (Task 9)
- Produces: `<SettingsScreen uid={uid} />`, mounted at the `/settings` route

- [ ] **Step 1: Write the failing test**

Create `src/domains/settings/SettingsScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetReminderConfig = vi.fn();
const mockSaveReminderConfig = vi.fn();

vi.mock('./reminderConfigApi', () => ({
  getReminderConfig: (...args: unknown[]) => mockGetReminderConfig(...args),
  saveReminderConfig: (...args: unknown[]) => mockSaveReminderConfig(...args),
}));

import { SettingsScreen } from './SettingsScreen';

const config = {
  workoutTime: '06:45',
  dinnerTime: '19:00',
  learningTime: '20:00',
  weeklyReviewTime: '18:00',
  timezone: 'UTC',
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockGetReminderConfig.mockReset();
    mockSaveReminderConfig.mockReset().mockResolvedValue(undefined);
  });

  it('shows a loading state before the config resolves', () => {
    mockGetReminderConfig.mockReturnValue(new Promise(() => {}));
    render(<SettingsScreen uid="user1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the loaded reminder times', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    render(<SettingsScreen uid="user1" />);
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));
    expect(screen.getByLabelText('Dinner prep reminder')).toHaveValue('19:00');
    expect(screen.getByLabelText('Learning reminder')).toHaveValue('20:00');
    expect(screen.getByLabelText('Weekly review reminder (Sunday)')).toHaveValue('18:00');
  });

  it('saves the edited config on submit', async () => {
    mockGetReminderConfig.mockResolvedValue(config);
    render(<SettingsScreen uid="user1" />);
    await waitFor(() => expect(screen.getByLabelText('Workout reminder')).toHaveValue('06:45'));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Workout reminder'));
    await user.type(screen.getByLabelText('Workout reminder'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveReminderConfig).toHaveBeenCalledWith('user1', { ...config, workoutTime: '07:00' });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: FAIL with "Cannot find module './SettingsScreen'"

- [ ] **Step 3: Implement SettingsScreen.tsx**

Create `src/domains/settings/SettingsScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { getReminderConfig, saveReminderConfig } from './reminderConfigApi';
import { ReminderConfig } from '../shared/types';

export function SettingsScreen({ uid }: { uid: string }) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReminderConfig(uid)
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, [uid]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    await saveReminderConfig(uid, config);
    setSaved(true);
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (!config) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
        <label className="flex flex-col text-sm" htmlFor="workoutTime">
          Workout reminder
          <input
            id="workoutTime"
            type="time"
            value={config.workoutTime}
            onChange={(e) => setConfig({ ...config, workoutTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="dinnerTime">
          Dinner prep reminder
          <input
            id="dinnerTime"
            type="time"
            value={config.dinnerTime}
            onChange={(e) => setConfig({ ...config, dinnerTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="learningTime">
          Learning reminder
          <input
            id="learningTime"
            type="time"
            value={config.learningTime}
            onChange={(e) => setConfig({ ...config, learningTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="weeklyReviewTime">
          Weekly review reminder (Sunday)
          <input
            id="weeklyReviewTime"
            type="time"
            value={config.weeklyReviewTime}
            onChange={(e) => setConfig({ ...config, weeklyReviewTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <p className="text-sm text-gray-600">Timezone: {config.timezone}</p>
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2 self-start">
          Save
        </button>
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </form>
    </div>
  );
}
```

Note each `<label>` wraps its `<input>` via matching `htmlFor`/`id`, matching the accessible-name lookup `getByLabelText` uses in the test above (the existing `HealthScreen` relies on implicit label-wrapping instead since its inputs have no `id` — both patterns are valid, `htmlFor`/`id` is used here because it's required for `getByLabelText` to resolve unambiguously when labels wrap only text, not the input itself, in some Testing Library configurations; using it consistently avoids ambiguity).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/settings/SettingsScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the /settings route and a nav link into App.tsx**

Read the current `src/App.tsx` first (Task 6 of Phase 4 already modified it to include `InstallPrompt`). Add the import:

```ts
import { SettingsScreen } from './domains/settings/SettingsScreen';
```

Change the header to add a Settings link before the Sign out button:

```tsx
      <header className="p-3 flex justify-end gap-2 border-b">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => signOutUser()}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Sign out
        </button>
      </header>
```

Add the route inside `<Routes>`, before the catch-all:

```tsx
        <Route path="/settings" element={<SettingsScreen uid={uid} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
```

- [ ] **Step 6: Mock SettingsScreen in App.test.tsx**

Add to `src/App.test.tsx`, alongside the existing screen mocks:

```tsx
vi.mock('./domains/settings/SettingsScreen', () => ({
  SettingsScreen: ({ uid }: { uid: string }) => <div>Settings for {uid}</div>,
}));
```

- [ ] **Step 7: Run the full suite and confirm no regressions**

Run: `npm test`
Expected: PASS, zero warnings

- [ ] **Step 8: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add src/domains/settings/SettingsScreen.tsx src/domains/settings/SettingsScreen.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add Settings screen for editable reminder times"
```

---

### Task 11: Firebase Messaging client wrapper

**Files:**
- Create: `src/notifications/firebaseMessaging.ts`, `src/notifications/firebaseMessaging.test.ts`

**Interfaces:**
- Consumes: `app` from `../firebase/config`, `firebase/messaging`'s `getMessaging`/`getToken`/`isSupported`, the browser's `Notification` global and `navigator.serviceWorker`
- Produces: `requestPushToken(vapidKey: string): Promise<string | null>`

- [ ] **Step 1: Write the failing test**

Create `src/notifications/firebaseMessaging.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsSupported = vi.fn();
const mockGetMessaging = vi.fn(() => ({}));
const mockGetToken = vi.fn();

vi.mock('firebase/messaging', () => ({
  isSupported: () => mockIsSupported(),
  getMessaging: (...args: unknown[]) => mockGetMessaging(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));
vi.mock('../firebase/config', () => ({ app: {} }));

import { requestPushToken } from './firebaseMessaging';

describe('requestPushToken', () => {
  const mockRequestPermission = vi.fn();
  const mockRegistration = {};

  beforeEach(() => {
    mockIsSupported.mockReset();
    mockGetToken.mockReset();
    mockRequestPermission.mockReset();
    vi.stubGlobal('Notification', { requestPermission: mockRequestPermission });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
    });
  });

  it('returns null when messaging is not supported', async () => {
    mockIsSupported.mockResolvedValue(false);
    const token = await requestPushToken('vapid-key');
    expect(token).toBeNull();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue('denied');
    const token = await requestPushToken('vapid-key');
    expect(token).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('returns the token when permission is granted', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue('granted');
    mockGetToken.mockResolvedValue('device-token');
    const token = await requestPushToken('vapid-key');
    expect(token).toBe('device-token');
    expect(mockGetToken).toHaveBeenCalledWith(expect.anything(), {
      vapidKey: 'vapid-key',
      serviceWorkerRegistration: mockRegistration,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notifications/firebaseMessaging.test.ts`
Expected: FAIL with "Cannot find module './firebaseMessaging'"

- [ ] **Step 3: Implement firebaseMessaging.ts**

Create `src/notifications/firebaseMessaging.ts`:

```ts
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app } from '../firebase/config';

export async function requestPushToken(vapidKey: string): Promise<string | null> {
  const supported = await isSupported();
  if (!supported) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  return token || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notifications/firebaseMessaging.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/notifications/firebaseMessaging.ts src/notifications/firebaseMessaging.test.ts
git commit -m "feat: add Firebase Messaging permission + token request wrapper"
```

---

### Task 12: FCM token Firestore API

**Files:**
- Create: `src/notifications/fcmTokensApi.ts`, `src/notifications/fcmTokensApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../firebase/config`
- Produces: `saveFcmToken(uid: string, token: string): Promise<void>` — writes to `users/{uid}/fcmTokens/{token}`, the same path Task 7's Worker reads

- [ ] **Step 1: Write the failing test**

Create `src/notifications/fcmTokensApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockServerTimestamp = vi.fn(() => 'server-timestamp-sentinel');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { saveFcmToken } from './fcmTokensApi';

describe('saveFcmToken', () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockSetDoc.mockClear();
  });

  it('writes the token doc keyed by the token itself', async () => {
    await saveFcmToken('user1', 'device-token');

    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'user1', 'fcmTokens', 'device-token');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      token: 'device-token',
      userAgent: expect.any(String),
      createdAt: 'server-timestamp-sentinel',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notifications/fcmTokensApi.test.ts`
Expected: FAIL with "Cannot find module './fcmTokensApi'"

- [ ] **Step 3: Implement fcmTokensApi.ts**

Create `src/notifications/fcmTokensApi.ts`:

```ts
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
    token,
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notifications/fcmTokensApi.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/notifications/fcmTokensApi.ts src/notifications/fcmTokensApi.test.ts
git commit -m "feat: add Firestore API for storing FCM device tokens"
```

---

### Task 13: Notification-permission hook

**Files:**
- Create: `src/notifications/useNotificationPermission.ts`, `src/notifications/useNotificationPermission.test.ts`

**Interfaces:**
- Consumes: `requestPushToken` (Task 11), `saveFcmToken` (Task 12)
- Produces: `useNotificationPermission(uid: string, vapidKey: string): { status: 'idle' | 'granted' | 'denied'; enable: () => Promise<void> }`

- [ ] **Step 1: Write the failing test**

Create `src/notifications/useNotificationPermission.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockRequestPushToken = vi.fn();
const mockSaveFcmToken = vi.fn();

vi.mock('./firebaseMessaging', () => ({ requestPushToken: (...args: unknown[]) => mockRequestPushToken(...args) }));
vi.mock('./fcmTokensApi', () => ({ saveFcmToken: (...args: unknown[]) => mockSaveFcmToken(...args) }));

import { useNotificationPermission } from './useNotificationPermission';

describe('useNotificationPermission', () => {
  beforeEach(() => {
    mockRequestPushToken.mockReset();
    mockSaveFcmToken.mockReset().mockResolvedValue(undefined);
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useNotificationPermission('user1', 'vapid-key'));
    expect(result.current.status).toBe('idle');
  });

  it('sets status to granted and saves the token on success', async () => {
    mockRequestPushToken.mockResolvedValue('device-token');
    const { result } = renderHook(() => useNotificationPermission('user1', 'vapid-key'));

    await act(async () => {
      await result.current.enable();
    });

    expect(mockRequestPushToken).toHaveBeenCalledWith('vapid-key');
    expect(mockSaveFcmToken).toHaveBeenCalledWith('user1', 'device-token');
    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('sets status to denied when no token is returned', async () => {
    mockRequestPushToken.mockResolvedValue(null);
    const { result } = renderHook(() => useNotificationPermission('user1', 'vapid-key'));

    await act(async () => {
      await result.current.enable();
    });

    expect(mockSaveFcmToken).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.status).toBe('denied'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notifications/useNotificationPermission.test.ts`
Expected: FAIL with "Cannot find module './useNotificationPermission'"

- [ ] **Step 3: Implement useNotificationPermission.ts**

Create `src/notifications/useNotificationPermission.ts`:

```ts
import { useState } from 'react';
import { requestPushToken } from './firebaseMessaging';
import { saveFcmToken } from './fcmTokensApi';

export type NotificationPermissionStatus = 'idle' | 'granted' | 'denied';

export function useNotificationPermission(uid: string, vapidKey: string) {
  const [status, setStatus] = useState<NotificationPermissionStatus>('idle');

  async function enable(): Promise<void> {
    const token = await requestPushToken(vapidKey);
    if (!token) {
      setStatus('denied');
      return;
    }
    await saveFcmToken(uid, token);
    setStatus('granted');
  }

  return { status, enable };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notifications/useNotificationPermission.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/notifications/useNotificationPermission.ts src/notifications/useNotificationPermission.test.ts
git commit -m "feat: add notification-permission hook"
```

---

### Task 14: NotificationPermission banner, wired into the app shell

**Files:**
- Create: `src/notifications/NotificationPermission.tsx`, `src/notifications/NotificationPermission.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `useNotificationPermission` (Task 13)
- Produces: `<NotificationPermission uid={uid} vapidKey={string} />`, mounted in `AuthedRoutes` alongside `InstallPrompt`

- [ ] **Step 1: Write the failing tests**

Create `src/notifications/NotificationPermission.test.tsx`:

```tsx
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
  });

  it('renders nothing once granted', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'granted', enable: mockEnable });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Enable button when idle and calls enable on click', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable' }));
    expect(mockEnable).toHaveBeenCalledTimes(1);
  });

  it('shows a blocked message and no Enable button when denied', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'denied', enable: mockEnable });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(screen.getByText(/blocked/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
  });

  it('dismisses the banner when Dismiss is clicked', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notifications/NotificationPermission.test.tsx`
Expected: FAIL with "Cannot find module './NotificationPermission'"

- [ ] **Step 3: Implement NotificationPermission.tsx**

Create `src/notifications/NotificationPermission.tsx`:

```tsx
import { useState } from 'react';
import { useNotificationPermission } from './useNotificationPermission';

export function NotificationPermission({ uid, vapidKey }: { uid: string; vapidKey: string }) {
  const { status, enable } = useNotificationPermission(uid, vapidKey);
  const [dismissed, setDismissed] = useState(false);

  if (status === 'granted' || dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="text-sm text-blue-900">
        {status === 'denied' ? (
          <p>Notifications are blocked. Enable them in your browser settings to get reminders.</p>
        ) : (
          <p>Turn on push reminders for workouts, learning, and chores.</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status !== 'denied' && (
          <button type="button" onClick={enable} className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm">
            Enable
          </button>
        )}
        <button type="button" onClick={() => setDismissed(true)} className="text-blue-700 text-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notifications/NotificationPermission.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Mount it in App.tsx**

In `src/App.tsx`, add the import:

```ts
import { NotificationPermission } from './notifications/NotificationPermission';
```

Change the block that currently mounts `InstallPrompt` alone:

```tsx
      <div className="p-3">
        <InstallPrompt />
      </div>
```

to also mount `NotificationPermission`, reading the VAPID key from the Vite env:

```tsx
      <div className="p-3 flex flex-col gap-2">
        <InstallPrompt />
        <NotificationPermission uid={uid} vapidKey={import.meta.env.VITE_FIREBASE_VAPID_KEY} />
      </div>
```

- [ ] **Step 6: Mock it in App.test.tsx**

Add to `src/App.test.tsx`, alongside the existing mocks:

```tsx
vi.mock('./notifications/NotificationPermission', () => ({ NotificationPermission: () => null }));
```

- [ ] **Step 7: Document the new env var**

If a `.env.example` file exists, add a line `VITE_FIREBASE_VAPID_KEY=` to it (generated in Firebase Console → Project Settings → Cloud Messaging → Web configuration → "Generate key pair" under Web Push certificates — this is the user's own manual step, listed again in Task 16). If no `.env.example` exists in this repo, skip this step (do not create a new file pattern not already established).

- [ ] **Step 8: Run the full suite and confirm no regressions**

Run: `npm test`
Expected: PASS, zero warnings

- [ ] **Step 9: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 10: Commit**

```bash
git add src/notifications/NotificationPermission.tsx src/notifications/NotificationPermission.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: mount notification-permission banner in the app shell"
```

(If `.env.example` was modified in Step 7, include it in this commit too.)

---

### Task 15: Custom service worker with FCM background handler

**Files:**
- Create: `src/sw.ts`
- Modify: `vite.config.ts`, `tsconfig.json`, `package.json`

**Interfaces:**
- Consumes: `self.__WB_MANIFEST` (injected by `vite-plugin-pwa`'s `injectManifest` strategy at build time), `firebase/app`'s `initializeApp`, `firebase/messaging/sw`'s `getMessaging`/`onBackgroundMessage`
- Produces: `dist/sw.js` built from this file, replacing the Workbox-`generateSW`-produced service worker Phase 4 shipped

This is asset/config work, not testable application logic (same as Phase 4 Task 2) — verified via `npm run build` and a manual check that `dist/sw.js` exists and contains both precaching and messaging code.

- [ ] **Step 1: Add the workbox-precaching devDependency**

```bash
npm install -D workbox-precaching
```

`injectManifest` (unlike `generateSW`) requires the service worker source to import Workbox itself rather than having it bundled in automatically.

- [ ] **Step 2: Switch vite.config.ts to the injectManifest strategy**

Modify the `VitePWA(...)` call in `vite.config.ts` — replace the `workbox: { globPatterns: [...] }` block with `strategies`, `srcDir`, `filename`, and `injectManifest`:

```ts
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Punch In',
        short_name: 'Punch In',
        description:
          'A single-user life planner covering workouts, learning, chores, finances, meals, health, and goals.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
```

- [ ] **Step 3: Create the custom service worker**

Create `src/sw.ts`:

```ts
/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

precacheAndRoute(self.__WB_MANIFEST);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'Punch In';
  const body = payload.notification?.body ?? '';
  self.registration.showNotification(title, { body, icon: '/icons/icon-192.png' });
});
```

- [ ] **Step 4: Exclude sw.ts from the main tsconfig**

`tsconfig.json`'s `compilerOptions.lib` includes `"DOM"`, which conflicts with the `"webworker"` lib `src/sw.ts` needs (`self` is typed differently in each — TypeScript disallows having both loaded at once). Since `npm run build` runs `tsc && vite build`, and `tsc` walks everything under `include: ["src"]`, exclude this one file from the root program (Vite/esbuild still compiles and bundles it as a normal entry when building — `tsc` here is only a project-wide type-check gate, not what actually emits `sw.ts`'s JS):

```json
  "include": ["src"],
  "exclude": ["src/sw.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
```

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors; `dist/sw.js` exists

Verify: `grep -c "precacheAndRoute\|onBackgroundMessage" dist/sw.js` reports at least 1 (bundled/minified names may differ — if the grep finds nothing, open `dist/sw.js` and manually confirm both Workbox precaching calls and Firebase Messaging's background handler are present, not just the raw source string).

- [ ] **Step 6: Run the full suite and confirm no regressions**

Run: `npm test`
Expected: PASS, same test count as before this task, zero warnings

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts tsconfig.json package.json package-lock.json src/sw.ts
git commit -m "feat: switch to a custom service worker with FCM background message handling"
```

---

### Task 16: Manual smoke test — end-to-end push delivery

**Files:** none (verification-only task)

**Interfaces:** none — exercises Tasks 1-15 together in a real browser and the deployed Worker.

- [ ] **Step 1: Generate the Web Push VAPID key**

In Firebase Console → Project Settings → Cloud Messaging → Web configuration → "Generate key pair" (under "Web Push certificates"). Copy the key pair value into a local `.env` file as `VITE_FIREBASE_VAPID_KEY=<value>` (never commit `.env` — confirm it's already gitignored, same as the other `VITE_FIREBASE_*` values).

- [ ] **Step 2: Build, preview, and install**

```bash
npm run build
npm run preview
```

Open the preview URL, sign in, and install the app to your device's home screen (same flow as Phase 4's smoke test) — push delivery while the app is closed only works from the installed PWA, not a browser tab.

- [ ] **Step 3: Grant notification permission**

From the installed app, click "Enable" on the `NotificationPermission` banner and grant the permission prompt. Confirm in Firebase Console → Firestore → `users/{your-uid}/fcmTokens` that a new document appeared with a `token` field.

- [ ] **Step 4: Trigger a test reminder**

In Firebase Console → Firestore, edit `users/{your-uid}/config/reminders`, setting `workoutTime` to a value about 5-10 minutes in the future (in your configured `timezone`, or edit `timezone` too if it's wrong). Wait for the next Cloudflare cron tick (every 15 minutes) at or after that time.

- [ ] **Step 5: Verify delivery**

Confirm a push notification titled "Workout time" arrives on the device (works with the app fully closed, since this exercises `onBackgroundMessage` in the installed service worker). Check Cloudflare Workers & Pages → punch-in-reminders → Logs to confirm the invocation succeeded, and check `users/{your-uid}/reminderState/workout` in Firestore now has today's date as `lastSentDate`.

- [ ] **Step 6: Verify de-duplication**

Wait for the next cron tick (still within the same day) and confirm no second "Workout time" push arrives — `shouldFireDaily`'s `lastSentDate` check (Task 5) should suppress it.

- [ ] **Step 7: Restore real reminder times**

Reset `workoutTime` (and `timezone` if changed) back to your real preferred value via the Settings screen in the app (exercises Task 10 end-to-end too), or directly in Firestore.

- [ ] **Step 8: Record the result**

If any step in Steps 2-7 fails, treat it as a bug: write a regression test first (following the TDD pattern used throughout this plan) before considering Phase 5 complete — the same standard Phase 4's smoke test was held to. Real iOS APNs delivery (requiring the APNs auth key upload mentioned in the top-level spec) remains out of scope for this phase — that's Phase 6.
