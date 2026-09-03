import { useEffect, useState, FormEvent } from 'react';
import { getReminderConfig, saveReminderConfig } from './reminderConfigApi';
import { ReminderConfig } from '../shared/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass, sectionLabelClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';
import { resetAllTutorialFlags } from '../../tutorials/tutorialFlagsApi';
import { useNotificationPermission } from '../../notifications/useNotificationPermission';

export function SettingsScreen({ uid }: { uid: string }) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tutorialsReset, setTutorialsReset] = useState(false);
  const tutorial = useTutorial(uid, 'settings');
  const { status: notificationStatus, enable: enableNotifications } = useNotificationPermission(uid);
  const [notifError, setNotifError] = useState<string | null>(null);

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

  async function handleNotificationsToggle(nextEnabled: boolean) {
    if (!config) return;
    setNotifError(null);
    if (nextEnabled) {
      await enableNotifications();
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        setNotifError('Enable notifications in your browser to turn this on.');
        return;
      }
    }
    const updated = { ...config, notificationsEnabled: nextEnabled };
    setConfig(updated);
    try {
      await saveReminderConfig(uid, updated);
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Failed to save notification preference');
    }
  }

  async function handleReplayTutorials() {
    await resetAllTutorialFlags(uid);
    setTutorialsReset(true);
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  if (!config) {
    return (
      <PageCard>
        <p className="text-sm text-muted">Loading...</p>
      </PageCard>
    );
  }

  return (
    <PageCard>
      <ScreenHeader label="Settings" />
      <section className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Reminders</p>
        <form id="settings-reminders" onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="workoutTime">
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
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="dinnerTime">
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
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="learningTime">
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
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="weeklyReviewTime">
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
              className={fieldClass}
            />
          </label>
          <p className="font-mono text-xs text-muted">Timezone: {config.timezone}</p>
          <button type="submit" className={buttonClass}>
            Save
          </button>
          {saveError && <p className="text-sm text-[#B3261E]">{saveError}</p>}
          {saved && <p className="text-sm text-ok">Saved.</p>}
        </form>
      </section>

      <hr className="border-line" />

      <section className="flex flex-col gap-3 max-w-sm">
        <p className={sectionLabelClass}>Notifications</p>
        {notificationStatus === 'denied' ? (
          <p className="text-sm text-muted">
            Blocked by your browser. Enable notifications for this site in your browser settings, then reload.
          </p>
        ) : (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={config.notificationsEnabled}
              onChange={(e) => handleNotificationsToggle(e.target.checked)}
            />
            Enable reminder notifications
          </label>
        )}
        {notifError && <p className="text-sm text-[#B3261E]">{notifError}</p>}
      </section>

      <hr className="border-line" />

      <section id="settings-replay" className="flex flex-col gap-3 max-w-sm">
        <p className={sectionLabelClass}>Tutorials</p>
        <button type="button" onClick={handleReplayTutorials} className={buttonClass}>
          Replay all tutorials
        </button>
        {tutorialsReset && (
          <p className="text-sm text-ok">Tutorials will show again next time you visit each screen.</p>
        )}
      </section>

      {tutorial.isOpen && (
        <TutorialStoryboard title="Settings" steps={tutorialContent.settings} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
