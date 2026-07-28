import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setLearningDone } from '../shared/completionsApi';
import { listLearningLogEntries, addLearningLogEntry } from './learningApi';
import { LearningLogEntry, DailyCompletion } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function LearningScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<LearningLogEntry[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'learning');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    getCompletion(uid).then(setCompletion).catch(handleError);
    listLearningLogEntries(uid).then(setEntries).catch(handleError);
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
