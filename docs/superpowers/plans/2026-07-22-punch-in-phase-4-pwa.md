# Punch In — Phase 4: PWA Manifest, Service Worker & Add-to-Home-Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Punch In into an installable Progressive Web App — a real app icon and manifest, an offline-capable service worker that caches the app shell, an in-app "new version available" prompt, and an "Add to Home Screen" install banner that shows a native install button on Chromium browsers and manual Share-sheet instructions on iOS Safari (which never fires the native install prompt).

**Architecture:** Uses `vite-plugin-pwa` (Workbox under the hood) to generate the manifest and service worker at build time from Vite config — no hand-rolled service worker code to maintain. Two small React hooks wrap the plugin's generated virtual modules (`virtual:pwa-register/react`) and the browser's native `beforeinstallprompt`/`appinstalled` events, each paired with a thin presentational component, following the same hook+component split already used throughout the app (e.g. `useDashboardData` + `Dashboard`). App icons are generated once from a single hand-authored SVG source via a small `sharp`-based script, committed as static PNGs — no runtime image processing.

**Tech Stack:** Same as Phase 1-3 (Vite, React 18, TypeScript, Tailwind CSS, react-router-dom, Firebase, Vitest, React Testing Library), plus two new devDependencies scoped to this phase: `vite-plugin-pwa` (manifest + service worker generation) and `sharp` (one-time icon rasterization, not imported anywhere in `src/`).

## Global Constraints

- Scope is PWA installability and offline shell only — manifest, service worker, install UI. No Cloud Functions, no Cloud Scheduler, no Firebase Cloud Messaging (FCM) push wiring — that is Phase 5 (per spec §8). Do not add a Firebase Messaging service worker or push-subscription code in this phase.
- New devDependencies ARE permitted this phase (`vite-plugin-pwa`, `sharp`) — this diverges from Phase 1-3's "no new dependencies" constraint, which was scoped to those phases' domain-CRUD work. Phase 4's own tech stack explicitly requires PWA tooling per spec §1 ("manifest + service worker for offline shell and push receipt"). Do not add any other new dependency beyond these two.
- Service worker updates must be explicit, not silent: `registerType: 'prompt'` — the app must show a visible "reload to update" affordance (this phase's `UpdateToast`) rather than swapping code under the user without warning.
- App icons must respect the maskable-icon safe zone (logo content kept within the inner ~80% of the canvas, background color filling the full square) so Android's adaptive-icon masking doesn't clip the logo — both `icon-512.png` (purpose `any`) and `maskable-icon-512.png` (purpose `maskable`) are generated from the same safe-zone-respecting source.
- `beforeinstallprompt` only fires on Chromium-based browsers; iOS Safari never fires it. The install UI must degrade to static "tap Share, then Add to Home Screen" instructions on iOS rather than ever showing a native-prompt button that will never appear there — this exact two-path flow is the one described in spec's "Reality check: alarms vs. notifications" section and its "What you'll need to do yourself" item 4.
- Test suite must remain at zero warnings (no React `act()` warnings, no console noise) and `npm run build` must succeed after every task — both carried over as hard bars from Phase 1-3.
- Any test that renders a component consuming a browser API not implemented by jsdom (`window.matchMedia`, the `virtual:pwa-register/react` module) must mock that dependency directly rather than letting it throw — follow the established mocking conventions from Phase 1-3 (`vi.mock(...)` with typed spread-arg factories).

---

## File Structure

```
scripts/icon-source.svg          — source vector icon (hand-authored, maskable-safe)
scripts/generate-icons.js        — one-time sharp-based PNG rasterization script
public/icons/                     — generated: icon-192.png, icon-512.png, maskable-icon-512.png, apple-touch-icon.png
package.json                      — MODIFY: add sharp + vite-plugin-pwa devDependencies, add "generate-icons" script
vite.config.ts                    — MODIFY: add VitePWA plugin (manifest, workbox, devOptions)
index.html                        — MODIFY: manifest link, apple-touch-icon link, theme-color + apple-mobile-web-app meta tags
src/vite-env.d.ts                 — MODIFY: add vite-plugin-pwa/client types reference
src/pwa/
  usePwaUpdate.ts                  — wraps virtual:pwa-register/react's useRegisterSW
  UpdateToast.tsx                  — "reload to update" / "ready to work offline" banner
  useInstallPrompt.ts               — beforeinstallprompt/appinstalled listener + iOS detection
  InstallPrompt.tsx                 — install banner (native prompt button, or iOS manual instructions)
src/App.tsx                       — MODIFY: mount InstallPrompt + UpdateToast in the authed app shell
src/App.test.tsx                  — MODIFY: mock the two new components alongside existing screen mocks
```

---

### Task 1: Generate app icons

**Files:**
- Create: `scripts/icon-source.svg`, `scripts/generate-icons.js`
- Create (generated, not hand-written): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-icon-512.png`, `public/icons/apple-touch-icon.png`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: four static PNG files under `public/icons/` that Task 2's manifest config and `index.html` will reference by path

This task is asset generation, not application logic — there is no test to write (same as Phase 1 Task 1's toolchain scaffolding). Verification is by inspecting the generated files.

- [ ] **Step 1: Install sharp**

```bash
npm install -D sharp
```

- [ ] **Step 2: Create the source icon**

Create `scripts/icon-source.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb"/>
  <path d="M170 262 L230 322 L344 190" fill="none" stroke="#ffffff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

This is a white checkmark on the app's existing brand blue (`#2563eb`, the same blue used for primary buttons throughout the app), with the checkmark kept within the inner safe-zone circle (radius ~204px around the 256,256 center of a 512×512 canvas) so it isn't clipped when Android applies an adaptive-icon mask.

- [ ] **Step 3: Create the generation script**

Create `scripts/generate-icons.js`:

```js
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'icon-source.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const { file, size } of targets) {
    await sharp(svgPath).resize(size, size).png().toFile(path.join(outDir, file));
  }
  console.log(`Generated ${targets.length} icons in ${outDir}`);
}

main();
```

- [ ] **Step 4: Add the npm script**

Add to `package.json`'s `"scripts"` block:

```json
"generate-icons": "node scripts/generate-icons.js"
```

- [ ] **Step 5: Run the generator**

Run: `npm run generate-icons`
Expected: prints `Generated 4 icons in .../public/icons`

Verify: `ls public/icons` shows `apple-touch-icon.png  icon-192.png  icon-512.png  maskable-icon-512.png`

- [ ] **Step 6: Commit**

```bash
git add scripts/icon-source.svg scripts/generate-icons.js public/icons package.json package-lock.json
git commit -m "chore: generate PWA app icons from a hand-authored SVG source"
```

---

### Task 2: Configure vite-plugin-pwa

**Files:**
- Modify: `vite.config.ts`, `index.html`, `src/vite-env.d.ts`, `package.json`

**Interfaces:**
- Consumes: the four icon files from Task 1 (`public/icons/*.png`)
- Produces: a build-time-generated `dist/manifest.webmanifest` and `dist/sw.js`; the `virtual:pwa-register/react` module that Task 3 imports; TypeScript types for that virtual module via the `vite-plugin-pwa/client` reference

This task is configuration, not application logic — there is no unit test to write. Verification is via `npm run build` and `npm test`.

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Configure the plugin**

Replace `vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    exclude: ['**/node_modules/**', '**/.claude/**', '**/.worktrees/**', '**/worktrees/**'],
  },
});
```

`registerType: 'prompt'` means the generated service worker will NOT auto-activate a new version silently — it waits for `updateServiceWorker()` to be called (Task 3's `UpdateToast` calls this from a user-visible button), per the Global Constraints' "explicit, not silent" rule. `injectRegister: false` disables the plugin's own auto-injected registration script, since Task 3's `usePwaUpdate` hook registers the service worker itself via `virtual:pwa-register/react`.

- [ ] **Step 3: Add manifest link and PWA meta tags**

Replace `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2563eb" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Punch In" />
    <title>Punch In</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Add the plugin's TypeScript types**

Replace `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors; `dist/manifest.webmanifest` and `dist/sw.js` exist

Verify: `ls dist` includes `manifest.webmanifest` and `sw.js` alongside `index.html` and `assets/`

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: PASS, same test count as before this task, zero warnings

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts index.html src/vite-env.d.ts package.json package-lock.json
git commit -m "feat: configure vite-plugin-pwa for manifest and offline service worker"
```

---

### Task 3: Service worker update hook and toast

**Files:**
- Create: `src/pwa/usePwaUpdate.ts`, `src/pwa/UpdateToast.tsx`
- Test: `src/pwa/UpdateToast.test.tsx`

**Interfaces:**
- Consumes: `useRegisterSW` from the virtual module `virtual:pwa-register/react` (provided by Task 2's plugin config)
- Produces: `usePwaUpdate(): { needRefresh: boolean; offlineReady: boolean; updateServiceWorker: (reloadPage?: boolean) => Promise<void> }`, `<UpdateToast />` (no props)

`usePwaUpdate` itself has no independent test file — it is a two-line wrapper with no branching logic, and its behavior is fully exercised through `UpdateToast`'s tests below (which mock the underlying virtual module it wraps). Testing it separately would just re-assert the same mock.

- [ ] **Step 1: Write the hook**

Create `src/pwa/usePwaUpdate.ts`:

```ts
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();

  return { needRefresh, offlineReady, updateServiceWorker };
}
```

- [ ] **Step 2: Write the failing test for UpdateToast**

Create `src/pwa/UpdateToast.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUpdateServiceWorker = vi.fn();
let mockNeedRefresh = false;
let mockOfflineReady = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [mockOfflineReady, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

import { UpdateToast } from './UpdateToast';

describe('UpdateToast', () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockOfflineReady = false;
    mockUpdateServiceWorker.mockClear();
  });

  it('renders nothing when there is no update and offline-ready has not fired', () => {
    const { container } = render(<UpdateToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the offline-ready message', () => {
    mockOfflineReady = true;
    render(<UpdateToast />);
    expect(screen.getByText('Punch In is ready to work offline.')).toBeInTheDocument();
  });

  it('shows a reload button when an update is available and calls updateServiceWorker(true) on click', async () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reload to update' }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/pwa/UpdateToast.test.tsx`
Expected: FAIL with "Cannot find module './UpdateToast'"

- [ ] **Step 4: Implement UpdateToast**

Create `src/pwa/UpdateToast.tsx`:

```tsx
import { usePwaUpdate } from './usePwaUpdate';

export function UpdateToast() {
  const { needRefresh, offlineReady, updateServiceWorker } = usePwaUpdate();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 bg-gray-900 text-white rounded-lg shadow-lg p-4 flex flex-col gap-2 z-50">
      {needRefresh ? (
        <>
          <p className="text-sm">A new version of Punch In is available.</p>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="bg-blue-600 text-white rounded px-3 py-2 text-sm self-start"
          >
            Reload to update
          </button>
        </>
      ) : (
        <p className="text-sm">Punch In is ready to work offline.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/pwa/UpdateToast.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 7: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add src/pwa/usePwaUpdate.ts src/pwa/UpdateToast.tsx src/pwa/UpdateToast.test.tsx
git commit -m "feat: add service worker update hook and reload-to-update toast"
```

---

### Task 4: Install-prompt hook

**Files:**
- Create: `src/pwa/useInstallPrompt.ts`
- Test: `src/pwa/useInstallPrompt.test.ts`

**Interfaces:**
- Consumes: the browser's `beforeinstallprompt` and `appinstalled` window events; `navigator.userAgent`; `window.matchMedia('(display-mode: standalone)')`
- Produces: `useInstallPrompt(): { canInstall: boolean; installed: boolean; isIOS: boolean; promptInstall: () => Promise<void> }`

- [ ] **Step 1: Write the failing test**

Create `src/pwa/useInstallPrompt.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

const originalUserAgent = window.navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function makeBeforeInstallPromptEvent() {
  const promptMock = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = promptMock;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return { event, promptMock };
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  });

  it('starts with canInstall false and installed false when no event has fired', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it('sets canInstall true after beforeinstallprompt fires', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event } = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => expect(result.current.canInstall).toBe(true));
  });

  it("promptInstall calls the deferred event's prompt() and then clears canInstall", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event, promptMock } = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('sets installed true and canInstall false when appinstalled fires', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event } = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(result.current.installed).toBe(true));
    expect(result.current.canInstall).toBe(false);
  });

  it('reports isIOS true for an iPhone user agent', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(true);
  });

  it('reports isIOS false for a desktop Chrome user agent', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pwa/useInstallPrompt.test.ts`
Expected: FAIL with "Cannot find module './useInstallPrompt'"

- [ ] **Step 3: Implement useInstallPrompt**

Create `src/pwa/useInstallPrompt.ts`:

```ts
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setDeferredEvent(null);
      setInstalled(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function promptInstall(): Promise<void> {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  return {
    canInstall: deferredEvent !== null && !installed,
    installed,
    isIOS,
    promptInstall,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pwa/useInstallPrompt.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Commit**

```bash
git add src/pwa/useInstallPrompt.ts src/pwa/useInstallPrompt.test.ts
git commit -m "feat: add install-prompt hook with iOS detection"
```

---

### Task 5: Install-prompt banner component

**Files:**
- Create: `src/pwa/InstallPrompt.tsx`
- Test: `src/pwa/InstallPrompt.test.tsx`

**Interfaces:**
- Consumes: `useInstallPrompt` from `./useInstallPrompt` (Task 4)
- Produces: `<InstallPrompt />` (no props)

- [ ] **Step 1: Write the failing tests**

Create `src/pwa/InstallPrompt.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPromptInstall = vi.fn().mockResolvedValue(undefined);
const mockUseInstallPrompt = vi.fn();

vi.mock('./useInstallPrompt', () => ({
  useInstallPrompt: () => mockUseInstallPrompt(),
}));

import { InstallPrompt } from './InstallPrompt';

describe('InstallPrompt', () => {
  beforeEach(() => {
    mockPromptInstall.mockClear();
    mockUseInstallPrompt.mockReset();
  });

  it('renders nothing when already installed', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      installed: true,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when not installable and not on iOS', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      installed: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Install button and calls promptInstall when canInstall is true', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      installed: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    render(<InstallPrompt />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(mockPromptInstall).toHaveBeenCalledTimes(1);
  });

  it('shows manual Add-to-Home-Screen instructions on iOS when no native prompt is available', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      installed: false,
      isIOS: true,
      promptInstall: mockPromptInstall,
    });
    render(<InstallPrompt />);
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  it('dismisses the banner when Dismiss is clicked', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      installed: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    const { container } = render(<InstallPrompt />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pwa/InstallPrompt.test.tsx`
Expected: FAIL with "Cannot find module './InstallPrompt'"

- [ ] **Step 3: Implement InstallPrompt**

Create `src/pwa/InstallPrompt.tsx`:

```tsx
import { useState } from 'react';
import { useInstallPrompt } from './useInstallPrompt';

export function InstallPrompt() {
  const { canInstall, installed, isIOS, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (installed || dismissed) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="text-sm text-blue-900">
        {canInstall ? (
          <p>Install Punch In on your device for quick access and offline use.</p>
        ) : (
          <p>Add Punch In to your Home Screen: tap the Share icon, then "Add to Home Screen".</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm"
          >
            Install
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

Run: `npx vitest run src/pwa/InstallPrompt.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, no `act()` warnings, no console noise

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/pwa/InstallPrompt.tsx src/pwa/InstallPrompt.test.tsx
git commit -m "feat: add install-prompt banner with iOS manual-instructions fallback"
```

---

### Task 6: Wire InstallPrompt and UpdateToast into the app shell

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `InstallPrompt` from `./pwa/InstallPrompt` (Task 5), `UpdateToast` from `./pwa/UpdateToast` (Task 3)
- Produces: both components mounted inside `AuthedRoutes`, visible on every authenticated page

Read the CURRENT `src/App.tsx` and `src/App.test.tsx` before making changes — `App.tsx`'s `AuthedRoutes` currently renders a header (with the sign-out button) followed by `<Routes>` for `/`, `/workout`, `/learning`, `/chores`, `/finances`, `/meals`, `/health`, `/goals`, plus a catch-all redirect. `App.test.tsx` mocks every domain screen component and `useAuth`/`signOutUser`/`firebase/config`. Neither `InstallPrompt` nor `UpdateToast` can run un-mocked inside `App.test.tsx`: `InstallPrompt` transitively calls `window.matchMedia`, which jsdom does not implement, and `UpdateToast` transitively imports the `virtual:pwa-register/react` module, which does not exist outside a real Vite+plugin build. Both must be mocked in `App.test.tsx` the same way every domain screen already is.

- [ ] **Step 1: Mount the two components in App.tsx**

In `src/App.tsx`, add two imports alongside the existing ones:

```ts
import { InstallPrompt } from './pwa/InstallPrompt';
import { UpdateToast } from './pwa/UpdateToast';
```

Change the `AuthedRoutes` function body from:

```tsx
function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="p-3 flex justify-end border-b">
        <button
          type="button"
          onClick={() => signOutUser()}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Sign out
        </button>
      </header>
      <Routes>
```

to:

```tsx
function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="p-3 flex justify-end border-b">
        <button
          type="button"
          onClick={() => signOutUser()}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Sign out
        </button>
      </header>
      <div className="p-3">
        <InstallPrompt />
      </div>
      <Routes>
```

Add `<UpdateToast />` directly after the closing `</Routes>` tag (still inside the surrounding `<>...</>` fragment, as the last element before it closes):

```tsx
      </Routes>
      <UpdateToast />
    </>
  );
}
```

- [ ] **Step 2: Mock the two components in App.test.tsx**

Add two mocks to `src/App.test.tsx`, alongside the existing `vi.mock(...)` calls (do not remove any existing mock):

```tsx
vi.mock('./pwa/InstallPrompt', () => ({ InstallPrompt: () => null }));
vi.mock('./pwa/UpdateToast', () => ({ UpdateToast: () => null }));
```

- [ ] **Step 3: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS, same test count as before this task, zero warnings

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: mount install-prompt banner and update toast in the app shell"
```

---

### Task 7: Manual smoke test — install and offline verification

**Files:** none (verification-only task)

**Interfaces:** none — this task exercises the manifest, service worker, and install UI built in Tasks 1-6 in a real browser.

- [ ] **Step 1: Build and preview the app**

```bash
npm run build
npm run preview
```

`npm run preview` serves the production build (with the real generated service worker and manifest — `npm run dev` only has these if `devOptions.enabled` is honored by the browser you're testing in, so prefer `preview` for this task).

- [ ] **Step 2: Verify the manifest and service worker in a desktop browser**

Open the preview URL in Chrome (or another Chromium browser) and confirm:

1. DevTools → Application → Manifest shows the app name "Punch In", the brand-blue theme color, and all three icons resolving correctly (no broken-image icons).
2. DevTools → Application → Service Workers shows a registered, activated service worker for the preview origin.
3. With DevTools → Network set to "Offline", reload the page — the app shell still loads (React app mounts, though Firestore-backed data will fail to load without a network, which is expected — only the shell being cacheable is in scope this phase).
4. The browser's address bar shows an install icon; clicking it (or the in-app "Install" button from the `InstallPrompt` banner) successfully installs the app, after which the `InstallPrompt` banner disappears (its `installed` state flips true).

- [ ] **Step 3: Verify the update-prompt flow**

1. With the app installed and running, make a trivial change to any source file (e.g. add a space), rebuild (`npm run build`), and reload the preview tab.
2. Confirm the `UpdateToast` banner appears with "A new version of Punch In is available." and a "Reload to update" button; clicking it reloads to the new version and the banner disappears.
3. Revert the trivial change if you made one purely for this test.

- [ ] **Step 4: Verify the iOS fallback text (desktop simulation only)**

Real iOS Safari testing on a physical iPhone is out of scope for this environment and is one of the items already listed in the spec's "What you'll need to do yourself" section (adding the installed PWA to an iPhone Home Screen via Safari → Share → Add to Home Screen). For this task, confirm only that the fallback text renders correctly when `isIOS` is true: in Chrome DevTools, open the Device Toolbar, select an iPhone device preset (which sets a matching `navigator.userAgent`), reload, and confirm the `InstallPrompt` banner shows "Add Punch In to your Home Screen: tap the Share icon, then 'Add to Home Screen'." with no "Install" button (since `beforeinstallprompt` won't have fired under this spoofed user agent either).

- [ ] **Step 5: Record the result**

If any step in Steps 2-4 fails, treat it as a bug to fix (write a regression test first, following the same TDD pattern as Tasks 3-5) before considering Phase 4 complete — matching how each prior phase's smoke test caught and fixed real bugs before that phase was called done. Real-device iOS verification (physical iPhone Add-to-Home-Screen + notification permission grant) remains explicitly the user's own action, to be done once Phase 5/6 add push notifications and there is something to grant permission for.
