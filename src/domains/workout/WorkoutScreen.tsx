import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setWorkoutDone } from '../shared/completionsApi';
import { listWorkoutLogEntries, addWorkoutSession } from './workoutApi';
import { WorkoutLogEntry, WorkoutSession, DailyCompletion, isLegacyWorkoutEntry } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

interface DraftSet {
  reps: string;
  weightKg: string;
}

interface DraftExercise {
  id: string;
  name: string;
  sets: DraftSet[];
}

function emptyExercise(): DraftExercise {
  return { id: crypto.randomUUID(), name: '', sets: [{ reps: '', weightKg: '' }] };
}

export function WorkoutScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [moduleName, setModuleName] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const [formError, setFormError] = useState<string | null>(null);
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

  function updateExerciseName(exerciseId: string, name: string) {
    setDraftExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, name } : ex)));
  }

  function updateSet(exerciseId: string, setIndex: number, field: keyof DraftSet, value: string) {
    setDraftExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, [field]: value } : s)) }
          : ex
      )
    );
  }

  function addSet(exerciseId: string) {
    setDraftExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, sets: [...ex.sets, { reps: '', weightKg: '' }] } : ex))
    );
  }

  function removeSet(exerciseId: string, setIndex: number) {
    setDraftExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) } : ex))
    );
  }

  function addExercise() {
    setDraftExercises((prev) => [...prev, emptyExercise()]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!moduleName.trim()) {
      setFormError('Enter a workout name.');
      return;
    }

    const exercises: WorkoutSession['exercises'] = [];
    for (const draft of draftExercises) {
      if (!draft.name.trim()) {
        setFormError('Every exercise needs a name.');
        return;
      }
      const sets = draft.sets
        .filter((s) => s.reps.trim() !== '')
        .map((s) => ({ reps: Number(s.reps), weightKg: Number(s.weightKg) || 0 }));
      if (sets.length === 0 || sets.some((s) => s.reps <= 0)) {
        setFormError('Every exercise needs at least one set with reps.');
        return;
      }
      exercises.push({ id: draft.id, name: draft.name.trim(), sets });
    }

    const session: Omit<WorkoutSession, 'id'> = { date: todayId(), moduleName: moduleName.trim(), exercises };
    const id = await addWorkoutSession(uid, session);
    setEntries((prev) => [{ id, ...session }, ...prev]);
    setModuleName('');
    setDraftExercises([emptyExercise()]);
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
      <ScreenHeader label="Workout" />
      <div id="workout-punchin">
        <PunchInButton done={completion?.workout ?? false} onToggle={handlePunchIn} />
      </div>
      <form id="workout-form" onSubmit={handleSave} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Workout name (e.g. Chest Workout)"
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
          className={fieldClass}
        />
        {draftExercises.map((exercise) => (
          <div key={exercise.id} className="flex flex-col gap-2 border border-line rounded-lg p-3">
            <input
              type="text"
              placeholder="Exercise name"
              value={exercise.name}
              onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
              className={fieldClass}
            />
            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted w-12">Set {setIndex + 1}</span>
                <input
                  type="number"
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(e) => updateSet(exercise.id, setIndex, 'reps', e.target.value)}
                  className={fieldClass}
                />
                <input
                  type="number"
                  placeholder="Weight (kg)"
                  value={set.weightKg}
                  onChange={(e) => updateSet(exercise.id, setIndex, 'weightKg', e.target.value)}
                  className={fieldClass}
                />
                {exercise.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(exercise.id, setIndex)}
                    className="text-xs text-muted"
                  >
                    Remove set
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addSet(exercise.id)} className="text-sm text-primary self-start">
              Add set
            </button>
          </div>
        ))}
        <button type="button" onClick={addExercise} className="text-sm text-primary self-start">
          Add exercise
        </button>
        <button type="submit" className={buttonClass}>
          Save workout
        </button>
        {formError && <p className="text-sm text-[#B3261E]">{formError}</p>}
      </form>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) =>
          isLegacyWorkoutEntry(entry) ? (
            <li key={entry.id} className="text-sm border-b border-line last:border-b-0 pb-1.5">
              <span className="font-mono text-xs text-muted">{entry.date}</span> — {entry.exercise} (
              {entry.detail})
            </li>
          ) : (
            <li key={entry.id} className="flex flex-col gap-1.5 border-b border-line last:border-b-0 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-semibold">{entry.moduleName}</span>
                <span className="font-mono text-xs text-muted">{entry.date}</span>
              </div>
              {entry.exercises.map((exercise) => (
                <div key={exercise.id} className="flex flex-col gap-0.5 pl-1">
                  <span className="text-sm font-medium">{exercise.name}</span>
                  {exercise.sets.map((set, i) => (
                    <span key={i} className="text-sm text-muted">
                      Set {i + 1} – {set.reps} reps – {set.weightKg} kg
                    </span>
                  ))}
                </div>
              ))}
            </li>
          )
        )}
      </ul>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Workout" steps={tutorialContent.workout} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
