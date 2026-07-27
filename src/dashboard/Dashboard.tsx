import { useDashboardData } from './useDashboardData';
import { DueNowStrip } from './DueNowStrip';
import { TrendChart } from './TrendChart';
import { ConsistencyHeatmap } from './ConsistencyHeatmap';
import { ActivityRings, RingSegment } from '../components/ActivityRings';
import { isBillDueToday } from '../domains/finances/billsApi';
import { todayId, dayOfMonth, daysInMonth, dayOfWeek } from '../domains/shared/dateUtils';
import { computeSleepDurationHours } from '../domains/health/healthLogic';
import { isWeeklyReviewDue } from '../domains/goals/goalsLogic';
import { useTutorial } from '../tutorials/useTutorial';
import { TutorialStoryboard } from '../tutorials/TutorialStoryboard';
import { tutorialContent } from '../tutorials/tutorialContent';

type Status = 'done' | 'in-progress' | 'not-started';

const STATUS_DOT: Record<Status, string> = {
  done: 'bg-ok border-ok',
  'in-progress': 'bg-white border-warn shadow-[inset_0_0_0_3px_#F4E7BE]',
  'not-started': 'bg-white border-line',
};

function fractionFor(status: Status): number {
  if (status === 'done') return 1;
  if (status === 'in-progress') return 0.5;
  return 0;
}

export function Dashboard({ uid, onNavigate }: { uid: string; onNavigate: (path: string) => void }) {
  const {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    sleepLog,
    goals,
    weeklyReview,
    dueItems,
    dueTodayChoreIds,
    streak,
    dayHealth,
    healthHistory,
  } = useDashboardData(uid);
  const tutorial = useTutorial(uid, 'dashboard');

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (loading || !completion) {
    return <p className="p-6">Loading...</p>;
  }

  const dueTodayChores = chores.filter((c) => dueTodayChoreIds.includes(c.id));
  const choresDoneCount = dueTodayChores.filter((c) => completion.chores[c.id]).length;

  const domNow = dayOfMonth(todayId());
  const dimNow = daysInMonth(todayId());
  const billsDueToday = bills.filter((b) => isBillDueToday(b, domNow, dimNow));
  const uncheckedGroceryCount = groceryItems.filter((item) => !item.checked).length;

  const sleepDuration =
    sleepLog?.bedtime && sleepLog?.wakeTime
      ? computeSleepDurationHours(sleepLog.bedtime, sleepLog.wakeTime)
      : null;
  const dow = dayOfWeek(todayId());
  const reviewDue = isWeeklyReviewDue(dow, weeklyReview);
  const activeGoalsCount = goals.filter((g) => g.status === 'active').length;

  const domains: { key: string; label: string; color: string; status: Status; detail: string; path: string }[] = [
    {
      key: 'workout',
      label: 'Workout',
      color: '#C4502D',
      status: completion.workout ? 'done' : 'not-started',
      detail: completion.workout ? 'Logged today' : 'Not logged',
      path: '/workout',
    },
    {
      key: 'learning',
      label: 'Learning',
      color: '#2E6E9E',
      status: completion.learning ? 'done' : 'not-started',
      detail: completion.learning ? 'Logged today' : 'Not logged',
      path: '/learning',
    },
    {
      key: 'chores',
      label: 'Chores',
      color: '#A8842A',
      status:
        dueTodayChores.length === 0
          ? 'not-started'
          : choresDoneCount === dueTodayChores.length
            ? 'done'
            : 'in-progress',
      detail: dueTodayChores.length === 0 ? 'None due today' : `${choresDoneCount}/${dueTodayChores.length} done`,
      path: '/chores',
    },
    {
      key: 'finances',
      label: 'Finances',
      color: '#2E7A54',
      status: billsDueToday.length > 0 ? 'in-progress' : 'done',
      detail: billsDueToday.length > 0 ? `${billsDueToday.length} bill(s) due` : 'No bills due',
      path: '/finances',
    },
    {
      key: 'meals',
      label: 'Meals',
      color: '#B4527E',
      status: uncheckedGroceryCount > 0 ? 'in-progress' : 'done',
      detail: `${uncheckedGroceryCount} to buy`,
      path: '/meals',
    },
    {
      key: 'health',
      label: 'Health',
      color: '#2E8E88',
      status: sleepDuration !== null ? 'done' : 'not-started',
      detail: sleepDuration !== null ? `${sleepDuration}h slept` : 'Not logged',
      path: '/health',
    },
    {
      key: 'goals',
      label: 'Goals',
      color: '#6C5DA0',
      status: reviewDue ? 'in-progress' : 'done',
      detail: reviewDue ? 'Review due' : `${activeGoalsCount} active`,
      path: '/goals',
    },
  ];

  const ringSegments: RingSegment[] = domains.map((d) => ({
    key: d.key,
    color: d.color,
    fraction: fractionFor(d.status),
  }));

  const trendValues = healthHistory.map((p) => p.value);

  return (
    <div className="flex justify-center px-3 sm:px-6 py-4 sm:py-8">
      <div className="w-full max-w-xl md:max-w-2xl lg:max-w-4xl bg-card border border-line rounded-2xl shadow-[0_30px_60px_-34px_rgba(21,24,26,0.28)] overflow-hidden">
        <header className="flex items-center justify-between px-4 sm:px-6 py-5 border-b border-line">
          <div className="font-display font-bold text-lg tracking-tight">
            Punch<span className="text-primary">·</span>In
          </div>
          <div className="font-mono text-[11px] text-muted bg-paper border border-line rounded-full px-3 py-1.5 tracking-wide">
            {completion.date}
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-2">
          <div className="lg:border-r lg:border-line">
            <div
              id="dashboard-rings"
              className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 px-4 sm:px-6 pt-6 pb-2 text-center sm:text-left"
            >
              <ActivityRings
                segments={ringSegments}
                className="w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] lg:w-[170px] lg:h-[170px] flex-none"
              />
              <div className="flex-1">
                <div className="font-display font-bold text-[38px] sm:text-[46px] leading-none">{dayHealth}%</div>
                <div className="font-mono text-[10.5px] tracking-widest uppercase text-muted mt-1">Day health</div>
                <div id="dashboard-streak" className="flex items-center justify-center sm:justify-start gap-1.5 mt-3 text-sm">
                  <span>🔥</span>
                  <span className="font-display font-semibold text-primary">{streak}-day streak</span>
                </div>
              </div>
            </div>

            <section id="dashboard-trend" className="px-4 sm:px-6 py-5">
              <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted mb-3">
                {trendValues.length}-day trend
              </p>
              <TrendChart values={trendValues} />
            </section>
          </div>

          <div>
            <hr className="border-line lg:hidden" />

            <section id="dashboard-heatmap" className="px-4 sm:px-6 py-5">
              <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted mb-3">Consistency</p>
              <div className="overflow-x-auto">
                <ConsistencyHeatmap points={healthHistory} />
              </div>
              <div className="flex items-center gap-1.5 mt-3 font-mono text-[10px] text-muted">
                <span>Less</span>
                <span className="w-2.5 h-2.5 rounded-full bg-line inline-block" />
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#B9C0E8' }} />
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#6C78D6' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                <span>More</span>
              </div>
            </section>

            <hr className="border-line" />

            <section id="dashboard-domains" className="px-4 sm:px-6 py-5">
              <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted mb-1">Domains</p>
              <ul>
                {domains.map((d) => (
                  <li key={d.key} className="border-b border-line last:border-b-0">
                    <button
                      onClick={() => onNavigate(d.path)}
                      className="w-full flex items-center gap-3 py-3 text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: d.color }} />
                      <span className="font-display font-semibold text-sm flex-1 min-w-0 truncate">{d.label}</span>
                      <span className="font-mono text-xs text-muted text-right">{d.detail}</span>
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex-none ${STATUS_DOT[d.status]}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section id="dashboard-duenow" className="px-4 sm:px-6 pb-6">
              <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted mb-3">Due now</p>
              <DueNowStrip items={dueItems} />
            </section>
          </div>
        </div>
      </div>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Dashboard" steps={tutorialContent.dashboard} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
