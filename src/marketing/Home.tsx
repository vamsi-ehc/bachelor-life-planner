// src/marketing/Home.tsx
import { motion, MotionConfig, Variants } from 'motion/react';
import { Login } from '../auth/Login';
import { LocalLogin } from '../auth/LocalLogin';
import { isLocalAuthProvider } from '../auth/authMode';
import { ActivityRings, RingSegment } from '../components/ActivityRings';
import { PunchStrip, buildPunchDays } from '../components/PunchStrip';
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
const DEMO_PUNCH_DAYS = buildPunchDays(6, 14);

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

const PUBLIC_DOMAINS = [
  { name: 'Workout', color: '#C4502D' },
  { name: 'Health', color: '#2E8E88' },
  { name: 'Goals', color: '#6C5DA0' },
];

const PRIVATE_DOMAINS = [
  { name: 'Learning' },
  { name: 'Chores' },
  { name: 'Finances' },
  { name: 'Meals' },
];

const SQUAD = [
  { name: 'Rahul', streak: 22 },
  { name: 'You', streak: 6, mine: true },
  { name: 'Aisha', streak: 6 },
  { name: 'Devraj', streak: 4 },
];

const STEPS = [
  isLocalAuthProvider
    ? { title: 'Create a local account', body: 'An email and password, stored only on this device.' }
    : { title: 'Sign in with Google', body: 'One account, no new password to remember.' },
  { title: 'Pick your domains', body: 'Turn on the parts of your day you actually want tracked.' },
  { title: 'Add a squad (optional)', body: 'Punch in solo, or bring a few friends along for the ride.' },
  { title: 'Watch the strip fill in', body: 'Streaks, trend, and rank build up one day at a time.' },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export interface HomeProps {
  redirectError?: string | null;
}

export function Home({ redirectError = null }: HomeProps) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-4 sm:px-6 xl:px-10 py-5 border-b border-line motion-safe:animate-rise-in">
          <div className="font-display font-bold text-lg tracking-tight">
            Punch<span className="text-primary">·</span>In
          </div>
          <div className="font-mono text-[11px] text-muted uppercase tracking-wide hidden sm:block">
            Life planner
          </div>
        </header>

        {/* Hero: asymmetric split */}
        <section className="grid md:grid-cols-2 gap-10 xl:gap-16 px-4 sm:px-6 xl:px-10 pt-10 xl:pt-16 pb-8 items-center">
          <div className="max-w-xl">
            <h1
              className="font-display font-bold text-3xl sm:text-4xl leading-tight motion-safe:animate-rise-in"
              style={{ animationDelay: '0.1s' }}
            >
              Punch in daily. Let your streak do the talking.
            </h1>
            <p
              className="mt-4 text-sm xl:text-base text-muted leading-relaxed motion-safe:animate-rise-in"
              style={{ animationDelay: '0.2s' }}
            >
              Track workouts, health, and goals in public. Keep chores, meals, and money private. Either way, the
              strip remembers.
            </p>

            <div className="mt-8">
              <div className="font-mono text-[10.5px] tracking-widest uppercase text-muted">Day 7 of 14</div>
              <PunchStrip days={DEMO_PUNCH_DAYS} className="mt-3" />
            </div>

            <motion.div className="mt-6 inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {isLocalAuthProvider ? (
                <LocalLogin redirectError={redirectError} />
              ) : (
                <Login redirectError={redirectError} />
              )}
            </motion.div>
          </div>

          <div className="relative flex justify-center motion-safe:animate-rise-in" style={{ animationDelay: '0.3s' }}>
            <div className="motion-safe:animate-float">
              <ActivityRings segments={DEMO_RINGS} className="w-[190px] h-[190px] xl:w-[240px] xl:h-[240px]" />
            </div>
            <div
              className="absolute -top-2 right-2 xl:right-8 flex items-center gap-1.5 bg-card border border-line rounded-full px-3 py-1.5 shadow-sm motion-safe:animate-pop-in"
              style={{ animationDelay: '0.9s' }}
            >
              <span className="text-sm">🔥</span>
              <span className="font-mono text-xs font-semibold">6-day streak</span>
            </div>
          </div>
        </section>

        {/* Why: editorial manifesto, offset, no card */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
        >
          <div className="max-w-2xl lg:ml-[10%]">
            <h2 className="font-display font-semibold text-2xl sm:text-3xl leading-snug">
              You've quit habit trackers before. Every one of them was private.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
              A checklist nobody else sees is easy to quietly stop keeping. There's no one to notice, and no cost to
              letting it slide. The habits that actually stick are the ones with a witness: a gym buddy who asks
              where you were, a friend who'd spot the gap in your streak.
            </p>
            <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
              Punch In is built around that one idea. Track seven parts of your life in one place, and let a few of
              them be visible to people who'll actually notice when the strip stops filling in.
            </p>
          </div>
        </motion.section>

        {/* Domains: bento, 3 cells, background diversity */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <h2 className="font-display font-semibold text-xl sm:text-2xl max-w-2xl">
            Your call which parts go public.
          </h2>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Workouts, health, and goals can show up on your friends' feed and the leaderboard. Everything else stays
            visible to only you, always.
          </p>

          <div className="mt-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="flex flex-col gap-4">
              <motion.div variants={fadeUp} className="rounded-2xl p-5 sm:p-6 bg-primary-dim">
                <span className="font-mono text-[10.5px] tracking-widest uppercase text-primary-dark">
                  Public, if you want
                </span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PUBLIC_DOMAINS.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 px-3 py-2 rounded-full bg-card">
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: d.color }} />
                      <span className="text-sm font-medium">{d.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="rounded-2xl p-5 sm:p-6 bg-card border border-line">
                <span className="font-mono text-[10.5px] tracking-widest uppercase text-muted">Always yours</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRIVATE_DOMAINS.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 px-3 py-2 rounded-full bg-paper">
                      <span className="w-2 h-2 rounded-full flex-none bg-muted" />
                      <span className="text-sm">{d.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <motion.div
              variants={fadeUp}
              className="rounded-2xl p-6 sm:p-8 bg-ink text-paper flex flex-col items-center justify-center text-center"
            >
              <ActivityRings segments={DEMO_RINGS} className="w-[150px] h-[150px] xl:w-[190px] xl:h-[190px]" />
              <h3 className="mt-5 font-display font-semibold text-base">Today, at a glance</h3>
              <p className="mt-1 text-sm text-paper/70 leading-relaxed max-w-xs">
                Seven domains, one ring each. Fill them in and the rest of the day feels lighter.
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* Proof: split, tinted panels, no card border */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <div className="grid lg:grid-cols-2 gap-4">
            <motion.div variants={fadeUp} className="rounded-2xl p-6 sm:p-8 bg-primary-dim">
              <h3 className="font-display font-semibold text-base sm:text-lg">The trend doesn't lie</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Fourteen days of your day-health score, so a good stretch is something you can actually see.
              </p>
              <div className="mt-4">
                <TrendChart values={DEMO_TREND} />
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl p-6 sm:p-8 bg-[#E9F4F1]">
              <h3 className="font-display font-semibold text-base sm:text-lg">Consistency you can point to</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Ten weeks of punches, mapped out like a punch card.
              </p>
              <div className="mt-4 overflow-x-auto">
                <ConsistencyHeatmap points={DEMO_HISTORY} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Squad: promoted scoreboard */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display font-semibold text-xl sm:text-2xl">A witness for your streak: Bronze League</h2>
            <span className="font-mono text-[10px] tracking-widest uppercase text-primary bg-primary-dim rounded-full px-2.5 py-1">
              Coming soon
            </span>
          </div>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            The whole point of going public is having someone to answer to. Next up: small squads and leagues, no
            strangers, just the people whose opinion of your consistency actually matters to you.
          </p>

          <motion.div
            className="mt-6 rounded-2xl bg-card border border-line p-5 sm:p-6 max-w-md"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
          >
            {SQUAD.map((member, i) => (
              <motion.div
                key={member.name}
                variants={fadeUp}
                whileHover={{ y: -1 }}
                className={
                  'flex items-center justify-between px-3 py-3 rounded-xl ' +
                  (member.mine ? 'bg-primary-dim' : '') +
                  (i < SQUAD.length - 1 ? ' mb-1' : '')
                }
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted w-4">{i + 1}</span>
                  <span className={'text-sm ' + (member.mine ? 'font-semibold' : 'font-medium')}>{member.name}</span>
                </div>
                <span className={'font-mono text-sm ' + (member.mine ? 'text-primary font-semibold' : '')}>
                  🔥 {member.streak}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* How it works: horizontal scroll-snap */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-10 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <h2 className="font-display font-semibold text-xl sm:text-2xl">
            Four minutes to your first punch, no sixth tracker required
          </h2>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-4 lg:overflow-visible">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                className="snap-start shrink-0 w-64 lg:w-auto rounded-2xl border border-line bg-card p-5"
              >
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <h3 className="mt-2 font-display font-semibold text-sm">{step.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Trust: calm, full-width statement */}
        <motion.section
          className="px-4 sm:px-6 xl:px-10 py-14 border-t border-line"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
        >
          <h2 className="font-display font-semibold text-xl sm:text-2xl max-w-2xl">
            There isn't a catch. Public means exactly what you choose.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed max-w-2xl">
            "Public" only ever means the domains you turn on. Your data lives under your own account, and Firestore
            security rules keep every other account out. Finances and personal health entries never appear on a
            leaderboard or a friend's feed unless you explicitly choose to share that domain. Sign-in uses Google
            OAuth, so we never see your password, and we don't sell your data.{' '}
            <a href="/privacy" className="text-primary underline">
              Read the full Privacy Policy
            </a>
            .
          </p>
        </motion.section>

        <Footer />
      </div>
    </MotionConfig>
  );
}
