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
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
