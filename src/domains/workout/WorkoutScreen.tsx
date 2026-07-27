import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setWorkoutDone } from '../shared/completionsApi';
import { listWorkoutLogEntries, addWorkoutLogEntry } from './workoutApi';
import { WorkoutLogEntry, DailyCompletion } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function WorkoutScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [exercise, setExercise] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'workout');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    getCompletion(uid).then(setCompletion).catch(handleError);
    listWorkoutLogEntries(uid).then(setEntries).catch(handleError);
  }, [uid]);

  async function handlePunchIn() {
    const done = !(completion?.workout ?? false);
    await setWorkoutDone(uid, done);
    setCompletion((prev) => (prev ? { ...prev, workout: done } : prev));
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!exercise.trim() || !detail.trim()) return;
    const entry: Omit<WorkoutLogEntry, 'id'> = { date: todayId(), exercise, detail };
    const id = await addWorkoutLogEntry(uid, entry);
    setEntries((prev) => [{ id, ...entry }, ...prev]);
    setExercise('');
    setDetail('');
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
      <ScreenHeader label="Workout" />
      <div id="workout-punchin">
        <PunchInButton done={completion?.workout ?? false} onToggle={handlePunchIn} />
      </div>
      <form id="workout-form" onSubmit={handleAddEntry} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Exercise"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Detail (e.g. 3x10 or 30 min)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
          Add entry
        </button>
      </form>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="text-sm">
            {entry.date} — {entry.exercise} ({entry.detail})
          </li>
        ))}
      </ul>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Workout" steps={tutorialContent.workout} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
