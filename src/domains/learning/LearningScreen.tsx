import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setLearningDone } from '../shared/completionsApi';
import { listLearningLogEntries, addLearningLogEntry } from './learningApi';
import {
  listLearningPlans,
  saveLearningPlan,
  deleteLearningPlan,
  isLearningPlanDueToday,
} from './learningPlansApi';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { LearningLogEntry, LearningPlan, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass, sectionLabelClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function LearningScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<LearningLogEntry[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [planTopic, setPlanTopic] = useState('');
  const [planCadence, setPlanCadence] = useState<'daily' | 'weekly'>('daily');
  const [planWeeklyDays, setPlanWeeklyDays] = useState<number[]>([]);
  const tutorial = useTutorial(uid, 'learning');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    getCompletion(uid).then(setCompletion).catch(handleError);
    listLearningLogEntries(uid).then(setEntries).catch(handleError);
    listLearningPlans(uid).then(setPlans).catch(handleError);
  }, [uid]);

  async function handlePunchIn() {
    const done = !(completion?.learning ?? false);
    await setLearningDone(uid, done);
    setCompletion((prev) => (prev ? { ...prev, learning: done } : prev));
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const entry: Omit<LearningLogEntry, 'id'> = { date: todayId(), note };
    const id = await addLearningLogEntry(uid, entry);
    setEntries((prev) => [{ id, ...entry }, ...prev]);
    setNote('');

    const today = todayId();
    const dow = dayOfWeek(today);
    const duePlans = plans.filter((p) => isLearningPlanDueToday(p, dow) && p.lastCompletedDate !== today);
    for (const plan of duePlans) {
      const updated = { ...plan, ...applyCompletion(plan, today) };
      await saveLearningPlan(uid, updated);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    }
  }

  async function handleAddPlan(e: FormEvent) {
    e.preventDefault();
    if (!planTopic.trim()) return;
    const plan: LearningPlan = {
      id: crypto.randomUUID(),
      topic: planTopic.trim(),
      cadence: planCadence,
      ...(planCadence === 'weekly' ? { weeklyDays: planWeeklyDays } : {}),
    };
    await saveLearningPlan(uid, plan);
    setPlans((prev) => [...prev, plan]);
    setPlanTopic('');
    setPlanCadence('daily');
    setPlanWeeklyDays([]);
  }

  async function handleRemovePlan(planId: string) {
    await deleteLearningPlan(uid, planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  return (
    <PageCard>
      <ScreenHeader label="Learning" />
      <div id="learning-punchin">
        <PunchInButton done={completion?.learning ?? false} onToggle={handlePunchIn} />
      </div>
      <section id="learning-plans" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Plans</p>
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => {
            const dueToday = isLearningPlanDueToday(plan, dayOfWeek(todayId()));
            return (
              <li key={plan.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
                <span className="text-sm flex-1">{plan.topic}</span>
                <span className="font-mono text-xs text-muted">
                  {plan.cadence === 'daily' ? 'Daily' : weekdaySummary(plan.weeklyDays)}
                </span>
                <span className="font-mono text-xs text-muted">
                  🔥{plan.currentStreak ?? 0} · {plan.points ?? 0} pts
                </span>
                {dueToday && <span className="font-mono text-xs text-primary">Due today</span>}
                <button
                  type="button"
                  onClick={() => handleRemovePlan(plan.id)}
                  className="text-xs text-muted hover:text-ink"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <form id="learning-plan-form" onSubmit={handleAddPlan} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Topic (e.g. Spanish)"
            value={planTopic}
            onChange={(e) => setPlanTopic(e.target.value)}
            className={fieldClass}
          />
          <select
            value={planCadence}
            onChange={(e) => setPlanCadence(e.target.value as 'daily' | 'weekly')}
            className={fieldClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Specific weekdays</option>
          </select>
          {planCadence === 'weekly' && <WeekdayPicker value={planWeeklyDays} onChange={setPlanWeeklyDays} />}
          <button type="submit" className={buttonClass}>
            Add plan
          </button>
        </form>
      </section>
      <hr className="border-line" />
      <form id="learning-form" onSubmit={handleAddEntry} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="What did you study?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" className={buttonClass}>
          Add entry
        </button>
      </form>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li key={entry.id} className="text-sm border-b border-line last:border-b-0 pb-1.5">
            <span className="font-mono text-xs text-muted">{entry.date}</span> — {entry.note}
          </li>
        ))}
      </ul>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Learning" steps={tutorialContent.learning} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
