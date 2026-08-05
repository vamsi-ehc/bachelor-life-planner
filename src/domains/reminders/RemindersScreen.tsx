import { useEffect, useState, FormEvent } from 'react';
import {
  listCustomReminders,
  saveCustomReminder,
  deleteCustomReminder,
  isCustomReminderDueToday,
} from './remindersApi';
import { getCompletion, setReminderDone } from '../shared/completionsApi';
import { CustomReminder, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cadenceSummary(reminder: CustomReminder): string {
  if (reminder.cadence === 'daily') return 'Daily';
  return (reminder.weeklyDays ?? []).map((d) => WEEKDAY_LABELS[d]).join(', ') || 'No days selected';
}

export function RemindersScreen({ uid }: { uid: string }) {
  const [reminders, setReminders] = useState<CustomReminder[]>([]);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'reminders');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listCustomReminders(uid).then(setReminders).catch(handleError);
    getCompletion(uid).then(setCompletion).catch(handleError);
  }, [uid]);

  async function handleToggle(reminderId: string, done: boolean) {
    await setReminderDone(uid, reminderId, done);
    setCompletion((prev) =>
      prev ? { ...prev, reminders: { ...prev.reminders, [reminderId]: done } } : prev
    );
  }

  function toggleWeekday(day: number) {
    setWeeklyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleAddReminder(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !time) return;
    const reminder: CustomReminder = {
      id: crypto.randomUUID(),
      label: label.trim(),
      time,
      cadence,
      ...(cadence === 'weekly' ? { weeklyDays } : {}),
    };
    await saveCustomReminder(uid, reminder);
    setReminders((prev) => [...prev, reminder]);
    setLabel('');
    setTime('');
    setCadence('daily');
    setWeeklyDays([]);
  }

  async function handleRemove(reminderId: string) {
    await deleteCustomReminder(uid, reminderId);
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  const dow = dayOfWeek(todayId());

  return (
    <PageCard>
      <ScreenHeader label="Reminders" />
      <ul id="reminders-list" className="flex flex-col gap-2">
        {reminders.map((reminder) => {
          const dueToday = isCustomReminderDueToday(reminder, dow);
          const done = completion?.reminders?.[reminder.id] ?? false;
          return (
            <li key={reminder.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
              <input
                type="checkbox"
                aria-label={reminder.label}
                checked={done}
                disabled={!dueToday}
                onChange={(e) => handleToggle(reminder.id, e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm flex-1">{reminder.label}</span>
              <span className="font-mono text-xs text-muted">{reminder.time}</span>
              <span className="font-mono text-xs text-muted">{cadenceSummary(reminder)}</span>
              {!dueToday && <span className="font-mono text-xs text-muted">not due today</span>}
              <button
                type="button"
                onClick={() => handleRemove(reminder.id)}
                className="text-xs text-muted hover:text-ink"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <form id="reminders-form" onSubmit={handleAddReminder} className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Reminder label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="reminder-time">
            Time
            <input
              id="reminder-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="reminder-cadence">
            Repeats
            <select
              id="reminder-cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as 'daily' | 'weekly')}
              className={fieldClass}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Specific weekdays</option>
            </select>
          </label>
        </div>
        {cadence === 'weekly' && (
          <div className="flex flex-wrap gap-3">
            {WEEKDAY_LABELS.map((dayLabel, day) => (
              <label key={day} className="flex items-center gap-1 text-sm text-muted">
                <input
                  type="checkbox"
                  aria-label={dayLabel}
                  checked={weeklyDays.includes(day)}
                  onChange={() => toggleWeekday(day)}
                  className="accent-primary w-4 h-4"
                />
                {dayLabel}
              </label>
            ))}
          </div>
        )}
        <button type="submit" className={buttonClass}>
          Add reminder
        </button>
      </form>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Reminders" steps={tutorialContent.reminders} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
