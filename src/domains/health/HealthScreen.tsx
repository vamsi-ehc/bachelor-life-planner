import { useEffect, useState, FormEvent } from 'react';
import { getSleepLog, saveSleepLog } from './sleepApi';
import { listWeightEntries, addWeightEntry } from './weightApi';
import { computeSleepDurationHours, computeWeightChange } from './healthLogic';
import { SleepLog, WeightEntry } from '../shared/types';
import { todayId } from '../shared/dateUtils';
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
  }, [uid]);

  async function handleSaveSleep(e: FormEvent) {
    e.preventDefault();
    const log: SleepLog = { date: todayId(), bedtime, wakeTime };
    await saveSleepLog(uid, log);
    setSleepLog(log);
  }

  async function handleAddWeight(e: FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(weightKg);
    if (Number.isNaN(parsed)) return;
    const entry: Omit<WeightEntry, 'id'> = { date: todayId(), weightKg: parsed };
    const id = await addWeightEntry(uid, entry);
    setWeightEntries((prev) => [{ id, ...entry }, ...prev]);
    setWeightKg('');
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
