# Marketing Homepage, Legal Pages & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-out visitors a real product-overview homepage at `/` with GSAP-animated sections, add public `/privacy` and `/terms` pages, and wire GA4 + Search Console behind a cookie-consent gate — all without inventing real analytics IDs or false compliance claims.

**Architecture:** New `src/marketing/` folder holds `Home.tsx`, `Footer.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `ConsentBanner.tsx`. `App.tsx` is restructured so `BrowserRouter` always mounts (even signed-out), with `/`, `/privacy`, `/terms` public and everything else gated on auth. `src/analytics/ga.ts` lazily loads GA4 only in production, only with an env var set, and only after consent. GSAP drives scroll-triggered reveals on `Home`.

**Tech Stack:** React 18, react-router-dom v6, Tailwind CSS (existing design tokens: `paper`, `card`, `ink`, `muted`, `line`, `primary`, `domain.*`, `font-display`/`font-mono`), Vitest + Testing Library, GSAP + ScrollTrigger (new dependency).

## Global Constraints

- No fabricated GA4 Measurement ID or Google Search Console verification string — both are env-var placeholders (`VITE_GA_MEASUREMENT_ID`, `VITE_GSC_VERIFICATION`).
- No claim of SOC 2 / HIPAA / ISO 27001 or any formal compliance certification — describe actual practices only (Firestore rules, OAuth, HTTPS).
- Legal pages use konathalavamsi123@gmail.com as the sole contact; operator described as an individual developer, not a registered company.
- Privacy Policy must state that account deletion/data export happens via emailing the contact address (no self-service feature exists).
- All GSAP animations must short-circuit under `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- GA4 must not load unless the visitor has clicked "Accept" on the consent banner (localStorage-persisted).
- Follow existing code style: functional components, Tailwind utility classes using the existing design tokens, `font-display` for headings, `font-mono` for small/uppercase labels, no comments unless non-obvious.
- Existing Vitest/Testing Library patterns: `vi.mock` for module boundaries, `screen.getByRole`/`getByText`, `userEvent` for interactions (see `src/App.test.tsx`, `src/auth/Login.test.tsx`).

---

## Task 1: Add GSAP dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `gsap` package (with `ScrollTrigger` plugin, bundled in `gsap/ScrollTrigger`) available to import in later tasks.

- [ ] **Step 1: Install gsap**

Run: `npm install gsap`

- [ ] **Step 2: Verify it landed in package.json dependencies**

Run: `grep '"gsap"' package.json`
Expected: a line like `"gsap": "^3.x.x",` under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gsap dependency for homepage animations"
```

---

## Task 2: `Footer` component

**Files:**
- Create: `src/marketing/Footer.tsx`
- Test: `src/marketing/Footer.test.tsx`

**Interfaces:**
- Produces: `Footer` — a React component, no props, exported as `export function Footer()`. Renders links to `/privacy`, `/terms`, a `mailto:konathalavamsi123@gmail.com` link, and a copyright line containing "Punch In".

- [ ] **Step 1: Write the failing test**

```tsx
// src/marketing/Footer.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

describe('Footer', () => {
  it('links to privacy, terms, and a contact email', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute(
      'href',
      'mailto:konathalavamsi123@gmail.com'
    );
    expect(screen.getByText(/Punch In/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/marketing/Footer.test.tsx`
Expected: FAIL — `Footer` module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/marketing/Footer.tsx
import { Link } from 'react-router-dom';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line px-4 sm:px-6 xl:px-10 py-6 flex flex-col sm:flex-row gap-3 sm:gap-6 sm:items-center justify-between font-mono text-xs text-muted">
      <div>&copy; {year} Punch In. All rights reserved.</div>
      <nav className="flex gap-4">
        <Link to="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-ink">
          Terms
        </Link>
        <a href="mailto:konathalavamsi123@gmail.com" className="hover:text-ink">
          Contact
        </a>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/marketing/Footer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/marketing/Footer.tsx src/marketing/Footer.test.tsx
git commit -m "feat(marketing): add shared Footer component"
```

---

## Task 3: `PrivacyPolicy` page

**Files:**
- Create: `src/marketing/PrivacyPolicy.tsx`
- Test: `src/marketing/PrivacyPolicy.test.tsx`

**Interfaces:**
- Consumes: `Footer` from `./Footer` (Task 2).
- Produces: `PrivacyPolicy` — `export function PrivacyPolicy()`, no props. Renders headings for each required section and the `Footer`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/marketing/PrivacyPolicy.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPolicy } from './PrivacyPolicy';

describe('PrivacyPolicy', () => {
  it('covers what is collected, third parties, security, retention, cookies, rights, and contact', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/what we collect/i)).toBeInTheDocument();
    expect(screen.getByText(/firestore/i)).toBeInTheDocument();
    expect(screen.getByText(/third part/i)).toBeInTheDocument();
    expect(screen.getByText(/security/i)).toBeInTheDocument();
    expect(screen.getByText(/retention/i)).toBeInTheDocument();
    expect(screen.getByText(/cookies|analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/konathalavamsi123@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/soc 2|hipaa|iso 27001/i)).not.toBeNull();
  });
});
```

Note: the last two assertions confirm the page discusses compliance honestly — the implementation must contain the literal string "does not currently hold" (or equivalent) next to those certification names, never a bare claim of holding them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/marketing/PrivacyPolicy.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/marketing/PrivacyPolicy.tsx
import { Footer } from './Footer';

export function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs text-muted">Last updated 2026-07-28</p>
      </div>

      <section>
        <h2 className="font-display font-semibold text-lg">Who runs this</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is built and operated by an individual developer, not a registered company. If you have
          questions about this policy or your data, contact{' '}
          <a href="mailto:konathalavamsi123@gmail.com" className="text-primary underline">
            konathalavamsi123@gmail.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">What we collect</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          When you sign in with Google, we receive your account name and email address via Firebase
          Authentication. Everything you log inside the app — workout, learning, chores, finances, meals,
          health, and goals entries — is stored in Cloud Firestore under a document scoped to your account's
          unique ID.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Why we collect it</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Solely to run the tracking and dashboard features: building your rings, trend chart, and consistency
          heatmap. We do not use your data for anything else.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Third parties</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We use Firebase and Google Cloud as our infrastructure and authentication processor. If configured,
          we use Google Analytics (GA4) to understand aggregate usage — only after you accept the cookie
          banner. We do not use ad networks, and we never sell your data to anyone.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Security</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Cloud Firestore security rules restrict every read and write to the authenticated owner of that
          data — no other account can access your entries. All traffic is served over HTTPS. Because sign-in
          uses Google OAuth, this app never sees or stores your password.
        </p>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In does not currently hold formal certifications such as SOC 2, HIPAA, or ISO 27001. Despite
          tracking health and finance entries, this app is not a healthcare provider or financial institution
          and is not subject to those regulatory frameworks.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Retention &amp; your rights</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We keep your data until you ask us to delete it. There is currently no self-service delete or export
          button in the app — email{' '}
          <a href="mailto:konathalavamsi123@gmail.com" className="text-primary underline">
            konathalavamsi123@gmail.com
          </a>{' '}
          from your account's address and we will delete or export your data on request.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Cookies &amp; analytics</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We only load Google Analytics cookies after you click "Accept" on the cookie banner shown on your
          first visit. If you decline, no analytics script loads.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Children</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is not directed at children under 13, and we do not knowingly collect data from them.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Changes to this policy</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          If this policy changes, we will update the date at the top of this page.
        </p>
      </section>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/marketing/PrivacyPolicy.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/marketing/PrivacyPolicy.tsx src/marketing/PrivacyPolicy.test.tsx
git commit -m "feat(marketing): add Privacy Policy page"
```

---

## Task 4: `TermsOfService` page

**Files:**
- Create: `src/marketing/TermsOfService.tsx`
- Test: `src/marketing/TermsOfService.test.tsx`

**Interfaces:**
- Consumes: `Footer` from `./Footer` (Task 2).
- Produces: `TermsOfService` — `export function TermsOfService()`, no props.

- [ ] **Step 1: Write the failing test**

```tsx
// src/marketing/TermsOfService.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsOfService } from './TermsOfService';

describe('TermsOfService', () => {
  it('covers eligibility, acceptable use, disclaimer, liability, termination, and governing law', () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByText(/eligibility/i)).toBeInTheDocument();
    expect(screen.getByText(/acceptable use/i)).toBeInTheDocument();
    expect(screen.getByText(/as is|as-is/i)).toBeInTheDocument();
    expect(screen.getByText(/limitation of liability/i)).toBeInTheDocument();
    expect(screen.getByText(/termination/i)).toBeInTheDocument();
    expect(screen.getByText(/governing law/i)).toBeInTheDocument();
    expect(screen.getByText(/konathalavamsi123@gmail\.com/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/marketing/TermsOfService.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/marketing/TermsOfService.tsx
import { Footer } from './Footer';

export function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Terms of Service</h1>
        <p className="mt-2 font-mono text-xs text-muted">Last updated 2026-07-28</p>
      </div>

      <section>
        <h2 className="font-display font-semibold text-lg">The service</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is a personal life-tracking app covering workouts, learning, chores, finances, meals,
          health, and goals. It is provided by an individual developer, not a registered company.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Eligibility</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          You need a valid Google account to sign in and use Punch In. You are responsible for keeping that
          account secure.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Acceptable use</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Use Punch In only for its intended purpose of tracking your own personal activity. Don't attempt to
          disrupt the service, access another account's data, or use the app for unlawful purposes.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">No warranty</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is provided "as is" and "as available," without warranties of any kind, express or
          implied, including fitness for a particular purpose or uninterrupted availability.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Limitation of liability</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          To the maximum extent permitted by law, the operator of Punch In is not liable for any indirect,
          incidental, or consequential damages arising from your use of the service.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Termination</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          You may stop using Punch In and request account deletion at any time. We may suspend or terminate
          access if these terms are violated.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Changes to these terms</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          If these terms change, we will update the date at the top of this page.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Governing law</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          These terms are governed by the applicable mandatory law of your jurisdiction; no specific
          jurisdiction is otherwise asserted.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Contact</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Questions about these terms:{' '}
          <a href="mailto:konathalavamsi123@gmail.com" className="text-primary underline">
            konathalavamsi123@gmail.com
          </a>
          .
        </p>
      </section>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/marketing/TermsOfService.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/marketing/TermsOfService.tsx src/marketing/TermsOfService.test.tsx
git commit -m "feat(marketing): add Terms of Service page"
```

---

## Task 5: `ga.ts` analytics module

**Files:**
- Create: `src/analytics/ga.ts`
- Test: `src/analytics/ga.test.ts`

**Interfaces:**
- Produces:
  - `export function loadGoogleAnalytics(): void` — injects the GA4 `gtag.js` script tag and initializes `window.dataLayer`/`window.gtag` if and only if `import.meta.env.VITE_GA_MEASUREMENT_ID` is set and `import.meta.env.PROD` is true. Safe to call multiple times (must not inject the script twice).
  - `export function trackPageview(path: string): void` — calls `window.gtag('event', 'page_view', { page_path: path })` if `window.gtag` exists; no-ops otherwise.
- Consumed by: `ConsentBanner` (Task 6, calls `loadGoogleAnalytics` on accept) and `App.tsx` (Task 8, calls `trackPageview` on route change).

- [ ] **Step 1: Write the failing tests**

```ts
// src/analytics/ga.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ga', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as unknown as { gtag?: unknown }).gtag;
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.assign(import.meta.env, originalEnv);
  });

  it('does not inject a script when VITE_GA_MEASUREMENT_ID is unset', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '');
    const { loadGoogleAnalytics } = await import('./ga');
    loadGoogleAnalytics();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('does not inject a script outside production', async () => {
    vi.stubEnv('PROD', 'false');
    const { loadGoogleAnalytics } = await import('./ga');
    loadGoogleAnalytics();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('injects exactly one gtag script when configured in production', async () => {
    const { loadGoogleAnalytics } = await import('./ga');
    loadGoogleAnalytics();
    loadGoogleAnalytics();
    const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
    expect(scripts.length).toBe(1);
  });

  it('trackPageview no-ops when gtag is not present', async () => {
    const { trackPageview } = await import('./ga');
    expect(() => trackPageview('/privacy')).not.toThrow();
  });

  it('trackPageview calls window.gtag with the path when present', async () => {
    const gtagMock = vi.fn();
    (window as unknown as { gtag: typeof gtagMock }).gtag = gtagMock;
    const { trackPageview } = await import('./ga');
    trackPageview('/privacy');
    expect(gtagMock).toHaveBeenCalledWith('event', 'page_view', { page_path: '/privacy' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analytics/ga.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/analytics/ga.ts
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

export function loadGoogleAnalytics(): void {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId || !import.meta.env.PROD || loaded) {
    return;
  }
  loaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
}

export function trackPageview(path: string): void {
  window.gtag?.('event', 'page_view', { page_path: path });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/analytics/ga.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/ga.ts src/analytics/ga.test.ts
git commit -m "feat(analytics): add gated GA4 loader and pageview tracker"
```

---

## Task 6: `ConsentBanner` component

**Files:**
- Create: `src/marketing/ConsentBanner.tsx`
- Test: `src/marketing/ConsentBanner.test.tsx`

**Interfaces:**
- Consumes: `loadGoogleAnalytics` from `../analytics/ga` (Task 5).
- Produces: `ConsentBanner` — `export function ConsentBanner()`, no props. Persists choice under localStorage key `"punch-in-consent"` with value `"accepted"` or `"declined"`. Renders nothing once a choice has been persisted (including choices made in a prior session).

- [ ] **Step 1: Write the failing test**

```tsx
// src/marketing/ConsentBanner.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockLoadGoogleAnalytics = vi.fn();
vi.mock('../analytics/ga', () => ({
  loadGoogleAnalytics: (...args: unknown[]) => mockLoadGoogleAnalytics(...args),
}));

import { ConsentBanner } from './ConsentBanner';

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockLoadGoogleAnalytics.mockClear();
  });

  it('shows the banner on first visit', () => {
    render(<ConsentBanner />);
    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
  });

  it('loads analytics and hides the banner on Accept', async () => {
    render(<ConsentBanner />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /accept/i }));
    expect(mockLoadGoogleAnalytics).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('punch-in-consent')).toBe('accepted');
  });

  it('hides the banner without loading analytics on Decline', async () => {
    render(<ConsentBanner />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /decline/i }));
    expect(mockLoadGoogleAnalytics).not.toHaveBeenCalled();
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('punch-in-consent')).toBe('declined');
  });

  it('does not render if a choice was already made in localStorage', () => {
    window.localStorage.setItem('punch-in-consent', 'accepted');
    render(<ConsentBanner />);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('loads analytics immediately if consent was already accepted previously', () => {
    window.localStorage.setItem('punch-in-consent', 'accepted');
    render(<ConsentBanner />);
    expect(mockLoadGoogleAnalytics).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/marketing/ConsentBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/marketing/ConsentBanner.tsx
import { useEffect, useState } from 'react';
import { loadGoogleAnalytics } from '../analytics/ga';

const STORAGE_KEY = 'punch-in-consent';

export function ConsentBanner() {
  const [choice, setChoice] = useState<string | null>(() => window.localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (choice === 'accepted') {
      loadGoogleAnalytics();
    }
  }, [choice]);

  if (choice) {
    return null;
  }

  function decide(value: 'accepted' | 'declined') {
    window.localStorage.setItem(STORAGE_KEY, value);
    setChoice(value);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-card px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <p className="text-sm text-muted leading-relaxed">
        We use cookies for analytics only if you accept. See our{' '}
        <a href="/privacy" className="text-primary underline">
          Privacy Policy
        </a>
        .
      </p>
      <div className="flex gap-2 flex-none">
        <button
          type="button"
          onClick={() => decide('declined')}
          className="px-4 py-2 rounded-lg text-sm font-mono text-muted border border-line hover:text-ink"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          className="px-4 py-2 rounded-lg text-sm font-mono text-white bg-primary hover:bg-primary-dark"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/marketing/ConsentBanner.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/marketing/ConsentBanner.tsx src/marketing/ConsentBanner.test.tsx
git commit -m "feat(marketing): add cookie consent banner gating GA4 load"
```

---

## Task 7: `Home` marketing page with GSAP animation

**Files:**
- Create: `src/marketing/Home.tsx`
- Test: `src/marketing/Home.test.tsx`
- Modify: `src/auth/Login.tsx:1-115` (trim to just the sign-in block, dropping the header/feature-grid chrome now owned by `Home`)
- Test: `src/auth/Login.test.tsx` (verify still passes against the trimmed component)

**Interfaces:**
- Consumes: `signInWithGoogle` from `../auth/useAuth`; `ActivityRings`/`RingSegment` from `../components/ActivityRings`; `TrendChart` from `../dashboard/TrendChart`; `ConsistencyHeatmap` from `../dashboard/ConsistencyHeatmap`; `DayHealthPoint` from `../dashboard/dashboardLogic`; `Footer` from `./Footer` (Task 2); `Login` from `../auth/Login` (trimmed sign-in button block).
- Produces: `Home` — `export function Home()`, no props, rendered at `/` when signed out (wired in Task 8).

- [ ] **Step 1: Trim `Login.tsx` to just the sign-in block**

Replace the full contents of `src/auth/Login.tsx` with:

```tsx
// src/auth/Login.tsx
import { useState } from 'react';
import { signInWithGoogle } from './useAuth';

export function Login() {
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-0 bg-[#1A73E8] hover:bg-[#1669C1] text-white font-medium rounded-lg w-full sm:w-auto shadow-sm overflow-hidden"
      >
        <span className="flex items-center justify-center bg-white w-10 h-10 rounded-l-lg flex-none">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
        </span>
        <span className="flex-1 sm:flex-none text-center px-5 py-3">Sign in with Google</span>
      </button>
      {error && <p className="mt-3 text-sm text-[#B3261E]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Run the existing Login test to confirm it still passes**

Run: `npx vitest run src/auth/Login.test.tsx`
Expected: PASS (the existing test only checks for the sign-in button, error text, and absence of email/password fields — all still present).

- [ ] **Step 3: Write the failing test for `Home`**

```tsx
// src/marketing/Home.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../auth/Login', () => ({ Login: () => <div>Login screen</div> }));

import { Home } from './Home';

describe('Home', () => {
  it('renders the hero, product overview, how-it-works, privacy summary, and footer', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /punch in/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/workout/i)).toBeInTheDocument();
    expect(screen.getByText(/learning/i)).toBeInTheDocument();
    expect(screen.getByText(/chores/i)).toBeInTheDocument();
    expect(screen.getByText(/finances/i)).toBeInTheDocument();
    expect(screen.getByText(/meals/i)).toBeInTheDocument();
    expect(screen.getByText(/health/i)).toBeInTheDocument();
    expect(screen.getByText(/goals/i)).toBeInTheDocument();
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read.*privacy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /privacy/i, exact: false })).toBeInTheDocument();
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/marketing/Home.test.tsx`
Expected: FAIL — `Home` module not found.

- [ ] **Step 5: Write the `Home` implementation**

```tsx
// src/marketing/Home.tsx
import { useEffect, useRef } from 'react';
import { Login } from '../auth/Login';
import { ActivityRings, RingSegment } from '../components/ActivityRings';
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
  { title: 'Sign in with Google', body: 'One account, no passwords to manage.' },
  { title: 'Pick your domains', body: 'Turn on the parts of your day you actually want to track.' },
  { title: 'Punch in daily', body: 'Log a workout, a chore, a meal — whatever moved today.' },
  { title: 'Watch it build up', body: 'Rings fill in, a trend line forms, a heatmap of your streak appears.' },
];

export function Home() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !rootRef.current) {
      return;
    }

    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (cancelled || !rootRef.current) {
        return;
      }
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 85%' },
            }
          );
        });
      }, rootRef);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <div ref={rootRef} className="flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 xl:px-10 py-5 border-b border-line">
        <div className="font-display font-bold text-lg tracking-tight">
          Punch<span className="text-primary">·</span>In
        </div>
        <div className="font-mono text-[11px] text-muted uppercase tracking-wide hidden sm:block">
          Life planner
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-8 xl:gap-16 px-4 sm:px-6 xl:px-10 pt-10 xl:pt-16 pb-8 items-center">
        <div data-reveal className="xl:max-w-md">
          <h1 className="font-display font-bold text-3xl sm:text-4xl leading-tight">
            Punch In: seven parts of your day, one honest number.
          </h1>
          <p className="mt-4 text-sm xl:text-base text-muted leading-relaxed">
            Punch In tracks workouts, learning, chores, money, meals, health, and goals in one place, then
            turns them into a streak and a day-health score you actually keep coming back to.
          </p>
          <div className="mt-6">
            <Login />
          </div>
        </div>
        <div className="flex justify-center" data-reveal>
          <ActivityRings segments={DEMO_RINGS} className="w-[190px] h-[190px] xl:w-[240px] xl:h-[240px]" />
        </div>
      </section>

      <section className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line" data-reveal>
        <h2 className="font-display font-semibold text-xl">Seven domains, one dashboard</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DOMAINS.map((d) => (
            <div key={d.name} className="flex items-center gap-2 p-3 rounded-lg border border-line bg-card">
              <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: d.color }} />
              <span className="text-sm font-display font-medium">{d.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 grid lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-display font-semibold text-base">A trend, not just a mood</h3>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Fourteen days of your day-health score, so a good stretch is something you can see.
            </p>
            <div className="mt-3">
              <TrendChart values={DEMO_TREND} />
            </div>
          </div>
          <div>
            <h3 className="font-display font-semibold text-base">Consistency you can point to</h3>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Ten weeks of punches, mapped like a punch card.
            </p>
            <div className="mt-3 overflow-x-auto">
              <ConsistencyHeatmap points={DEMO_HISTORY} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line" data-reveal>
        <h2 className="font-display font-semibold text-xl">Get started</h2>
        <ol className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="font-mono text-xs text-primary">0{i + 1}</span>
              <h3 className="font-display font-semibold text-sm">{step.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line" data-reveal>
        <h2 className="font-display font-semibold text-xl">Privacy &amp; security, in short</h2>
        <p className="mt-3 text-sm text-muted leading-relaxed max-w-2xl">
          Your data lives under your own account, and Firestore security rules keep every other account out.
          Sign-in uses Google OAuth, so we never see your password. We don't sell your data.{' '}
          <a href="/privacy" className="text-primary underline">
            Read the full Privacy Policy
          </a>
          .
        </p>
      </section>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/marketing/Home.test.tsx src/auth/Login.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/marketing/Home.tsx src/marketing/Home.test.tsx src/auth/Login.tsx
git commit -m "feat(marketing): add animated Home product-overview page, trim Login to sign-in only"
```

---

## Task 8: Wire routing, consent banner, and pageview tracking into `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `Home` (Task 7), `PrivacyPolicy` (Task 3), `TermsOfService` (Task 4), `ConsentBanner` (Task 6), `trackPageview` from `../analytics/ga` (Task 5).
- Produces: `App` continues to be the default export; behavior change is that `/`, `/privacy`, `/terms` are reachable signed-out, and a route-change hook calls `trackPageview`.

- [ ] **Step 1: Update `App.test.tsx` for the new signed-out routing behavior**

Replace the `'shows the Login screen when signed out'` test and add new ones:

```tsx
// changes within src/App.test.tsx — add these mocks near the top, alongside the existing ones
vi.mock('./marketing/Home', () => ({ Home: () => <div>Home screen</div> }));
vi.mock('./marketing/PrivacyPolicy', () => ({ PrivacyPolicy: () => <div>Privacy screen</div> }));
vi.mock('./marketing/TermsOfService', () => ({ TermsOfService: () => <div>Terms screen</div> }));
vi.mock('./marketing/ConsentBanner', () => ({ ConsentBanner: () => null }));
vi.mock('./analytics/ga', () => ({ trackPageview: vi.fn() }));
```

Replace:

```tsx
  it('shows the Login screen when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
```

with:

```tsx
  it('shows the Home marketing page at / when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

  it('shows the Privacy page at /privacy when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(screen.getByText('Privacy screen')).toBeInTheDocument();
  });

  it('shows the Terms page at /terms when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    window.history.pushState({}, '', '/terms');
    render(<App />);
    expect(screen.getByText('Terms screen')).toBeInTheDocument();
  });

  it('shows the Privacy page at /privacy when signed in too', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(screen.getByText('Privacy screen')).toBeInTheDocument();
  });
```

Also remove the now-unused `vi.mock('./auth/Login', ...)` line — `Login` is no longer imported directly by `App`.

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `Home`/`PrivacyPolicy`/`TermsOfService` routes don't exist yet in `App.tsx`, and `App` still renders `<Login />` directly when signed out (no router mounted pre-auth), so `/privacy` never resolves.

- [ ] **Step 3: Rewrite `App.tsx`**

```tsx
// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, signOutUser } from './auth/useAuth';
import { Dashboard } from './dashboard/Dashboard';
import { WorkoutScreen } from './domains/workout/WorkoutScreen';
import { LearningScreen } from './domains/learning/LearningScreen';
import { ChoresScreen } from './domains/chores/ChoresScreen';
import { FinancesScreen } from './domains/finances/FinancesScreen';
import { MealsScreen } from './domains/meals/MealsScreen';
import { HealthScreen } from './domains/health/HealthScreen';
import { GoalsScreen } from './domains/goals/GoalsScreen';
import { SettingsScreen } from './domains/settings/SettingsScreen';
import { InstallPrompt } from './pwa/InstallPrompt';
import { UpdateToast } from './pwa/UpdateToast';
import { NotificationPermission } from './notifications/NotificationPermission';
import { Sidebar } from './components/Sidebar';
import { Home } from './marketing/Home';
import { PrivacyPolicy } from './marketing/PrivacyPolicy';
import { TermsOfService } from './marketing/TermsOfService';
import { ConsentBanner } from './marketing/ConsentBanner';
import { trackPageview } from './analytics/ga';

function PageviewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);
  return null;
}

function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  return (
    <div className="lg:flex lg:min-h-screen">
      <Sidebar onSignOut={() => signOutUser()} />
      <div className="flex-1 min-w-0">
        <header className="lg:hidden p-3 sm:px-6 flex justify-end gap-2 border-b border-line bg-card">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="font-mono text-xs text-muted border border-line rounded-full px-3 py-1.5 hover:text-ink"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="font-mono text-xs text-muted border border-line rounded-full px-3 py-1.5 hover:text-ink"
          >
            Sign out
          </button>
        </header>
        <div className="max-w-3xl mx-auto w-full p-3 sm:px-6 flex flex-col gap-2">
          <InstallPrompt />
          <NotificationPermission uid={uid} vapidKey={import.meta.env.VITE_FIREBASE_VAPID_KEY} />
        </div>
        <Routes>
          <Route path="/" element={<Dashboard uid={uid} onNavigate={navigate} />} />
          <Route path="/workout" element={<WorkoutScreen uid={uid} />} />
          <Route path="/learning" element={<LearningScreen uid={uid} />} />
          <Route path="/chores" element={<ChoresScreen uid={uid} />} />
          <Route path="/finances" element={<FinancesScreen uid={uid} />} />
          <Route path="/meals" element={<MealsScreen uid={uid} />} />
          <Route path="/health" element={<HealthScreen uid={uid} />} />
          <Route path="/goals" element={<GoalsScreen uid={uid} />} />
          <Route path="/settings" element={<SettingsScreen uid={uid} />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <UpdateToast />
      </div>
    </div>
  );
}

function SignedOutRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PageviewTracker />
      <ConsentBanner />
      {user ? <AuthedRoutes uid={user.uid} /> : <SignedOutRoutes />}
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (this also catches any other file referencing the old `App`/`Login` shape).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(routing): mount router pre-auth, add Home/Privacy/Terms routes, wire consent banner and pageview tracking"
```

---

## Task 9: Search Console meta tag, sitemap, robots.txt, and env var documentation

**Files:**
- Modify: `index.html`
- Create: `public/sitemap.xml`
- Create: `public/robots.txt`
- Modify: `.env.example`

**Interfaces:**
- No code interfaces — static assets and build-time env vars only.

- [ ] **Step 1: Add the Search Console verification placeholder and env vars**

In `index.html`, inside `<head>`, add just below the `<title>Punch In</title>` line:

```html
    <!-- Replace VITE_GSC_VERIFICATION in your env with the real Search Console token to enable verification -->
    <meta name="google-site-verification" content="%VITE_GSC_VERIFICATION%" />
```

Append to `.env.example`:

```
VITE_GA_MEASUREMENT_ID=
VITE_GSC_VERIFICATION=
```

- [ ] **Step 2: Verify Vite substitutes `%VITE_GSC_VERIFICATION%` in `index.html`**

Run: `grep -n "VITE_GSC_VERIFICATION" .env.example index.html`
Expected: both files list the placeholder. (Vite replaces `%ENV_VAR%` patterns in `index.html` automatically at build time for any `VITE_`-prefixed var — no plugin needed.)

- [ ] **Step 3: Create `public/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://punch-in.example.com/</loc>
  </url>
  <url>
    <loc>https://punch-in.example.com/privacy</loc>
  </url>
  <url>
    <loc>https://punch-in.example.com/terms</loc>
  </url>
</urlset>
```

Note: `https://punch-in.example.com` is a placeholder — replace with the real deployed domain once known.

- [ ] **Step 4: Create `public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://punch-in.example.com/sitemap.xml
```

- [ ] **Step 5: Commit**

```bash
git add index.html public/sitemap.xml public/robots.txt .env.example
git commit -m "chore(seo): add Search Console verification placeholder, sitemap, and robots.txt"
```

---

## Task 10: Full verification pass

**Files:** none created/modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Run the TypeScript build**

Run: `npm run build`
Expected: builds successfully with no type errors (this also confirms `gsap`/`gsap/ScrollTrigger` types resolve, and that the dynamic `import('gsap')` calls in `Home.tsx` type-check).

- [ ] **Step 3: Spot-check the dev server manually**

Run: `npm run dev` (in background), then visit `/`, `/privacy`, `/terms` while signed out, and confirm:
- `/` shows the new Home page with hero, domains grid, trend chart, heatmap, get-started steps, privacy summary, footer, and a working "Sign in with Google" button.
- Scroll-triggered sections fade/slide in as you scroll (or appear immediately if `prefers-reduced-motion` is on).
- The cookie consent banner appears once, and clicking Accept/Decline persists across a page reload.
- `/privacy` and `/terms` render full text and link back to each other and to `/`.

Stop the dev server when done.
