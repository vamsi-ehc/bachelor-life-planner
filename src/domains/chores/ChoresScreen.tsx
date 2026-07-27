import { useEffect, useState, FormEvent } from 'react';
import { listChores, saveChore, isChoreDueToday } from './choresApi';
import { getCompletion, setChoreDone } from '../shared/completionsApi';
import { ChoreConfig, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function ChoresScreen({ uid }: { uid: string }) {
  const [chores, setChores] = useState<ChoreConfig[]>([]);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [newChoreName, setNewChoreName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'chores');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listChores(uid).then(setChores).catch(handleError);
    getCompletion(uid).then(setCompletion).catch(handleError);
  }, [uid]);

  async function handleToggle(choreId: string, done: boolean) {
    await setChoreDone(uid, choreId, done);
    setCompletion((prev) =>
      prev ? { ...prev, chores: { ...prev.chores, [choreId]: done } } : prev
    );
  }

  async function handleAddChore(e: FormEvent) {
    e.preventDefault();
    if (!newChoreName.trim()) return;
    const chore: ChoreConfig = {
      id: crypto.randomUUID(),
      name: newChoreName.trim(),
      cadence: 'daily',
    };
    await saveChore(uid, chore);
    setChores((prev) => [...prev, chore]);
    setNewChoreName('');
  }

  const dow = dayOfWeek(todayId());

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
      <ScreenHeader label="Chores" />
      <ul className="flex flex-col gap-2">
        {chores.map((chore) => {
          const dueToday = isChoreDueToday(chore, dow);
          const done = completion?.chores?.[chore.id] ?? false;
          return (
            <li key={chore.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={chore.name}
                checked={done}
                disabled={!dueToday}
                onChange={(e) => handleToggle(chore.id, e.target.checked)}
              />
              <span>{chore.name}</span>
              {!dueToday && <span className="text-xs text-gray-400">(not due today)</span>}
            </li>
          );
        })}
      </ul>
      <form onSubmit={handleAddChore} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="New chore name"
          value={newChoreName}
          onChange={(e) => setNewChoreName(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
          Add chore
        </button>
      </form>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Chores" steps={tutorialContent.chores} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
