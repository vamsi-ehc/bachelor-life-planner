# Marketing homepage, legal pages, and analytics wiring

Date: 2026-07-28

## Problem

Punch In has no public-facing explanation of what the product is. Signed-out
visitors currently see only `Login.tsx` — a Google sign-in button plus a
small feature blurb and demo visuals. There is no product overview, no
"how to get started" walkthrough, no privacy policy, no terms of service,
and no analytics/search-console wiring.

The app is a multi-user product (Firebase Auth + per-user Firestore data
across seven life domains: workout, learning, chores, finances, meals,
health, goals), so the legal pages and privacy language need to read as a
real product notice, not personal notes.

## Goals

- A real homepage at `/` for signed-out visitors: hero, product overview,
  how-it-works / get-started steps, a privacy & security summary, and a
  footer linking to Terms and Privacy.
- Polished, purposeful entrance/scroll animations using GSAP.
- `/privacy` and `/terms` as standalone public routes with honest,
  specific content (no fabricated compliance certifications).
- GA4 analytics and Google Search Console verification wired via env vars,
  gated behind a cookie-consent banner, with no real IDs invented.

## Non-goals

- No self-service account deletion / data export feature (out of scope —
  the privacy policy will say deletion requests go through email instead).
- No real GA4 property or Search Console site is created in this work —
  code is wired to accept IDs via env vars.
- No claim of formal compliance certifications (SOC 2, HIPAA, ISO 27001).

## Architecture & routing

- New `src/marketing/` folder: `Home.tsx`, `PrivacyPolicy.tsx`,
  `TermsOfService.tsx`, `ConsentBanner.tsx`, `Footer.tsx` (shared footer).
- `App.tsx`: the router mounts regardless of auth state.
  - `/` renders `Home` (marketing page, embeds existing sign-in button)
    when signed out, and `Dashboard` when signed in.
  - `/privacy` and `/terms` are public routes reachable in either auth
    state.
  - All other existing authed routes keep redirecting to `/` (which then
    resolves to Login-embedded-in-Home) when signed out.
- The current `Login.tsx` sign-in button + demo-rings block becomes a
  component embedded into `Home`'s "Get started" section rather than a
  full-screen gate. `Login.tsx` itself can be simplified or removed once
  its content is folded in — whichever keeps the diff smaller is fine.

## Homepage content & animation

Sections, top to bottom:

1. **Hero** — product name, one-line pitch, animated `ActivityRings`
   visual, primary CTA button that triggers Google sign-in.
2. **Product overview** — what the product is, the seven domains, the
   "punch in" daily-tracking concept, and the dashboard/trend/heatmap
   value proposition.
3. **How it works / Get started** — numbered steps: sign in with Google →
   pick your domains → punch in daily → watch rings/trends/heatmap build
   up. Reuses the `DEMO_RINGS` / `DEMO_TREND` / `DEMO_HEATMAP_VALUES` data
   already defined in `Login.tsx`.
4. **Privacy & security summary** — short trust block: data is scoped to
   your account, Firestore rules restrict access to the owning `uid`,
   Google-only auth, no data sold. Links to `/privacy` for the full text.
5. **Footer** — links to Privacy, Terms, contact email
   (konathalavamsi123@gmail.com), copyright line.

Animation: add `gsap` as a dependency. Use `gsap.context()` scoped to the
page root plus `ScrollTrigger` for staggered fade/slide-up reveals per
section on scroll, and a subtle looping entrance animation on the hero
rings. All GSAP animations check `window.matchMedia('(prefers-reduced-motion: reduce)')`
and skip/shorten motion when true.

## Legal pages

**Operator/contact**: individual developer, contact via
konathalavamsi123@gmail.com. No registered company is claimed.

**Privacy Policy** (`/privacy`) covers:
- What's collected: Google account name/email via Firebase Auth; domain
  data you log (workout, learning, chores, finances, meals, health,
  goals) stored in Firestore under your `uid`.
- Why: to run the tracking/dashboard features.
- Third parties: Firebase/Google Cloud as infrastructure processor,
  Google Analytics (only if configured), no ad networks, no data sold.
- Security: Firestore security rules restrict all reads/writes to the
  authenticated owner; HTTPS everywhere; Google OAuth means the app never
  handles passwords directly.
- Retention: kept until a deletion request is made — no self-service
  delete/export exists yet, so the page states deletion requests go
  through the contact email.
- Cookies/analytics: GA4 loads only if configured and only after the
  visitor accepts the consent banner; this is disclosed plainly.
- User rights: access/deletion via email request.
- Children: not directed at children under 13.
- Changes: dated "last updated" line, changes posted on this page.

**Terms of Service** (`/terms`) covers:
- Description of the service.
- Account eligibility (must sign in with a valid Google account).
- Acceptable use.
- "As-is" / no-warranty disclaimer.
- Limitation of liability.
- Termination rights (either party).
- Changes to terms (dated, posted on this page).
- Governing law left generic ("applicable mandatory law in your
  jurisdiction") — no specific jurisdiction is asserted.

**Security compliance stance**: describe actual practices only (Firestore
rules, OAuth, HTTPS, Firebase infra). Explicitly do not claim SOC 2,
HIPAA, or ISO 27001 compliance, since none is held and this is not a
healthcare or financial institution despite tracking health/finance data.

## Analytics & Search Console

- `src/analytics/ga.ts`: loads the GA4 `gtag.js` snippet only if
  `import.meta.env.VITE_GA_MEASUREMENT_ID` is set, only in production
  builds, and only once the visitor has accepted the consent banner.
  Tracks a pageview on each route change via a small hook wired in
  `App.tsx`.
- `src/marketing/ConsentBanner.tsx`: shown once per browser (localStorage
  flag) on first visit with Accept/Decline. GA only loads on Accept. This
  ties directly to the Privacy Policy's cookie section.
- `index.html`: placeholder Search Console verification meta tag,
  `<meta name="google-site-verification" content="%VITE_GSC_VERIFICATION%" />`
  or equivalent env-var-driven approach documented inline for how to fill
  in a real value at build time.
- `public/sitemap.xml` listing `/`, `/privacy`, `/terms`.
- `public/robots.txt` allowing crawl and pointing at the sitemap.
- No real GA Measurement ID or GSC verification string is invented —
  both stay as env-var placeholders.

## Testing

- Existing test patterns in the repo use Vitest + Testing Library
  (`App.test.tsx`, `Login.test.tsx`). New components get equivalent
  render/interaction tests: `Home` renders all sections and CTA triggers
  sign-in; `PrivacyPolicy`/`TermsOfService` render their content;
  `ConsentBanner` accept/decline flow and localStorage persistence;
  `ga.ts` doesn't load gtag without consent or without an env var set.
- GSAP animations are treated as presentational — not unit tested beyond
  confirming reduced-motion short-circuits them.
