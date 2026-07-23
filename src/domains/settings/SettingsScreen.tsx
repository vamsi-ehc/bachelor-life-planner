import { useEffect, useState, FormEvent } from 'react';
import { getReminderConfig, saveReminderConfig } from './reminderConfigApi';
import { ReminderConfig } from '../shared/types';

export function SettingsScreen({ uid }: { uid: string }) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReminderConfig(uid)
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, [uid]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    await saveReminderConfig(uid, config);
    setSaved(true);
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (!config) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
        <label className="flex flex-col text-sm" htmlFor="workoutTime">
          Workout reminder
          <input
            id="workoutTime"
            type="time"
            value={config.workoutTime}
            onChange={(e) => setConfig({ ...config, workoutTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="dinnerTime">
          Dinner prep reminder
          <input
            id="dinnerTime"
            type="time"
            value={config.dinnerTime}
            onChange={(e) => setConfig({ ...config, dinnerTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="learningTime">
          Learning reminder
          <input
            id="learningTime"
            type="time"
            value={config.learningTime}
            onChange={(e) => setConfig({ ...config, learningTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="weeklyReviewTime">
          Weekly review reminder (Sunday)
          <input
            id="weeklyReviewTime"
            type="time"
            value={config.weeklyReviewTime}
            onChange={(e) => setConfig({ ...config, weeklyReviewTime: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </label>
        <p className="text-sm text-gray-600">Timezone: {config.timezone}</p>
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2 self-start">
          Save
        </button>
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </form>
    </div>
  );
}
