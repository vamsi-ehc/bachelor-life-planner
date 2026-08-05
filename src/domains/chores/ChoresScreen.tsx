import { useEffect, useState, FormEvent } from 'react';
import { listChores, saveChore, isChoreDueToday } from './choresApi';
import { getCompletion, setChoreDone } from '../shared/completionsApi';
import { applyCompletion } from '../shared/streakLogic';
import { ChoreConfig, DailyCompletion } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass } from '../../components/ui';
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

  async function handleToggle(chore: ChoreConfig, done: boolean) {
    await setChoreDone(uid, chore, done);
    setCompletion((prev) =>
      prev ? { ...prev, chores: { ...prev.chores, [chore.id]: done } } : prev
    );
    if (done && chore.lastCompletedDate !== todayId()) {
      const updated = applyCompletion(chore, todayId());
      setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, ...updated } : c)));
    }
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
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  return (
    <PageCard>
      <ScreenHeader label="Chores" />
      <ul id="chores-list" className="flex flex-col gap-2">
        {chores.map((chore) => {
          const dueToday = isChoreDueToday(chore, dow);
          const done = completion?.chores?.[chore.id] ?? false;
          return (
            <li key={chore.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
              <input
                type="checkbox"
                aria-label={chore.name}
                checked={done}
                disabled={!dueToday}
                onChange={(e) => handleToggle(chore, e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm flex-1">{chore.name}</span>
              <span className="font-mono text-xs text-muted">
                🔥{chore.currentStreak ?? 0} · {chore.points ?? 0} pts
              </span>
              {!dueToday && <span className="font-mono text-xs text-muted">not due today</span>}
            </li>
          );
        })}
      </ul>
      <form id="chores-form" onSubmit={handleAddChore} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="New chore name"
          value={newChoreName}
          onChange={(e) => setNewChoreName(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" className={buttonClass}>
          Add chore
        </button>
      </form>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Chores" steps={tutorialContent.chores} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
