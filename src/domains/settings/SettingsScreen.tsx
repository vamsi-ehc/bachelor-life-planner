import { useEffect, useState, FormEvent } from 'react';
import { getReminderConfig, saveReminderConfig } from './reminderConfigApi';
import { ReminderConfig } from '../shared/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';
import { resetAllTutorialFlags } from '../../tutorials/tutorialFlagsApi';

export function SettingsScreen({ uid }: { uid: string }) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tutorialsReset, setTutorialsReset] = useState(false);
  const tutorial = useTutorial(uid, 'settings');

  useEffect(() => {
    getReminderConfig(uid)
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, [uid]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    try {
      await saveReminderConfig(uid, config);
      setSaveError(null);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }

  async function handleReplayTutorials() {
    await resetAllTutorialFlags(uid);
    setTutorialsReset(true);
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (!config) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <ScreenHeader label="Settings" />
      <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
        <label className="flex flex-col text-sm" htmlFor="workoutTime">
          Workout reminder
          <input
            id="workoutTime"
            type="time"
            value={config.workoutTime}
            onChange={(e) => {
              setConfig({ ...config, workoutTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="dinnerTime">
          Dinner prep reminder
          <input
            id="dinnerTime"
            type="time"
            value={config.dinnerTime}
            onChange={(e) => {
              setConfig({ ...config, dinnerTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="learningTime">
          Learning reminder
          <input
            id="learningTime"
            type="time"
            value={config.learningTime}
            onChange={(e) => {
              setConfig({ ...config, learningTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm" htmlFor="weeklyReviewTime">
          Weekly review reminder (Sunday)
          <input
            id="weeklyReviewTime"
            type="time"
            value={config.weeklyReviewTime}
            onChange={(e) => {
              setConfig({ ...config, weeklyReviewTime: e.target.value });
              setSaved(false);
              setSaveError(null);
            }}
            className="border rounded px-3 py-2"
          />
        </label>
        <p className="text-sm text-gray-600">Timezone: {config.timezone}</p>
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2 self-start">
          Save
        </button>
        {saveError && <p className="text-sm text-red-700">{saveError}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </form>

      <section className="flex flex-col gap-2 max-w-sm">
        <h2 className="font-semibold">Tutorials</h2>
        <button
          type="button"
          onClick={handleReplayTutorials}
          className="bg-blue-600 text-white rounded px-3 py-2 self-start"
        >
          Replay all tutorials
        </button>
        {tutorialsReset && (
          <p className="text-sm text-green-700">Tutorials will show again next time you visit each screen.</p>
        )}
      </section>

      {tutorial.isOpen && (
        <TutorialStoryboard title="Settings" steps={tutorialContent.settings} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
