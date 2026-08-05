import { useEffect, useState, FormEvent } from 'react';
import { getSleepLog, saveSleepLog } from './sleepApi';
import { listWeightEntries, addWeightEntry } from './weightApi';
import { listHealthPlans, saveHealthPlan, deleteHealthPlan, isHealthPlanDueToday } from './healthPlansApi';
import { computeSleepDurationHours, computeWeightChange } from './healthLogic';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { SleepLog, WeightEntry, HealthPlan } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass, sectionLabelClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function HealthScreen({ uid }: { uid: string }) {
  const [sleepLog, setSleepLog] = useState<SleepLog | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [planLabel, setPlanLabel] = useState('');
  const [planCadence, setPlanCadence] = useState<'daily' | 'weekly'>('daily');
  const [planWeeklyDays, setPlanWeeklyDays] = useState<number[]>([]);
  const tutorial = useTutorial(uid, 'health');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    getSleepLog(uid).then((log) => {
      setSleepLog(log);
      setBedtime(log.bedtime);
      setWakeTime(log.wakeTime);
    }).catch(handleError);
    listWeightEntries(uid).then(setWeightEntries).catch(handleError);
    listHealthPlans(uid).then(setPlans).catch(handleError);
  }, [uid]);

  async function completeDuePlansToday() {
    const today = todayId();
    const dow = dayOfWeek(today);
    const duePlans = plans.filter((p) => isHealthPlanDueToday(p, dow) && p.lastCompletedDate !== today);
    for (const plan of duePlans) {
      const updated = { ...plan, ...applyCompletion(plan, today) };
      await saveHealthPlan(uid, updated);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    }
  }

  async function handleSaveSleep(e: FormEvent) {
    e.preventDefault();
    const log: SleepLog = { date: todayId(), bedtime, wakeTime };
    await saveSleepLog(uid, log);
    setSleepLog(log);
    await completeDuePlansToday();
  }

  async function handleAddWeight(e: FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(weightKg);
    if (Number.isNaN(parsed)) return;
    const entry: Omit<WeightEntry, 'id'> = { date: todayId(), weightKg: parsed };
    const id = await addWeightEntry(uid, entry);
    setWeightEntries((prev) => [{ id, ...entry }, ...prev]);
    setWeightKg('');
    await completeDuePlansToday();
  }

  async function handleAddPlan(e: FormEvent) {
    e.preventDefault();
    if (!planLabel.trim()) return;
    const plan: HealthPlan = {
      id: crypto.randomUUID(),
      label: planLabel.trim(),
      cadence: planCadence,
      ...(planCadence === 'weekly' ? { weeklyDays: planWeeklyDays } : {}),
    };
    await saveHealthPlan(uid, plan);
    setPlans((prev) => [...prev, plan]);
    setPlanLabel('');
    setPlanCadence('daily');
    setPlanWeeklyDays([]);
  }

  async function handleRemovePlan(planId: string) {
    await deleteHealthPlan(uid, planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  const duration =
    sleepLog?.bedtime && sleepLog?.wakeTime
      ? computeSleepDurationHours(sleepLog.bedtime, sleepLog.wakeTime)
      : null;
  const weightChange = computeWeightChange(weightEntries);

  return (
    <PageCard>
      <ScreenHeader label="Sleep & Health" />

      <section id="health-plans" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Plans</p>
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => {
            const dueToday = isHealthPlanDueToday(plan, dayOfWeek(todayId()));
            return (
              <li key={plan.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
                <span className="text-sm flex-1">{plan.label}</span>
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
        <form id="health-plan-form" onSubmit={handleAddPlan} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Check-in label (e.g. Weigh-in)"
            value={planLabel}
            onChange={(e) => setPlanLabel(e.target.value)}
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

      <section id="health-sleep" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Sleep</p>
        {duration !== null && <p className="text-sm text-muted">{duration}h slept</p>}
        <form onSubmit={handleSaveSleep} className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Bedtime
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Wake time
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className={fieldClass}
            />
          </label>
          <button type="submit" className={buttonClass}>
            Save sleep
          </button>
        </form>
      </section>

      <hr className="border-line" />

      <section id="health-weight" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Weight</p>
        {weightChange !== null && (
          <p className="text-sm text-muted">
            {weightChange > 0 ? '+' : ''}
            {weightChange}kg since last entry
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {weightEntries.map((entry) => (
            <li key={entry.id} className="text-sm border-b border-line last:border-b-0 pb-1.5">
              <span className="font-mono text-xs text-muted">{entry.date}</span> — {entry.weightKg}kg
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddWeight} className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Weight (kg)"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className={`${fieldClass} w-32`}
          />
          <button type="submit" className={buttonClass}>
            Log weight
          </button>
        </form>
      </section>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Sleep & Health" steps={tutorialContent.health} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
