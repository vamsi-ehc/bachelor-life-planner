import { useEffect, useState, FormEvent } from 'react';
import { getSleepLog, saveSleepLog } from './sleepApi';
import { listWeightEntries, addWeightEntry } from './weightApi';
import { computeSleepDurationHours, computeWeightChange } from './healthLogic';
import { SleepLog, WeightEntry } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function HealthScreen({ uid }: { uid: string }) {
  const [sleepLog, setSleepLog] = useState<SleepLog | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  const duration =
    sleepLog?.bedtime && sleepLog?.wakeTime
      ? computeSleepDurationHours(sleepLog.bedtime, sleepLog.wakeTime)
      : null;
  const weightChange = computeWeightChange(weightEntries);

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Sleep &amp; Health</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Sleep</h2>
        {duration !== null && <p className="text-sm text-gray-600">{duration}h slept</p>}
        <form onSubmit={handleSaveSleep} className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col text-sm">
            Bedtime
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            Wake time
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Save sleep
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Weight</h2>
        {weightChange !== null && (
          <p className="text-sm text-gray-600">
            {weightChange > 0 ? '+' : ''}
            {weightChange}kg since last entry
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {weightEntries.map((entry) => (
            <li key={entry.id} className="text-sm">
              {entry.date} — {entry.weightKg}kg
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddWeight} className="flex gap-2">
          <input
            type="number"
            placeholder="Weight (kg)"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="border rounded px-3 py-2 w-32"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Log weight
          </button>
        </form>
      </section>
    </div>
  );
}
