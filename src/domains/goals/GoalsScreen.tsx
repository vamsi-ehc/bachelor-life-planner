import { useEffect, useState, FormEvent } from 'react';
import { listGoals, saveGoal } from './goalsApi';
import { getWeeklyReview, saveWeeklyReview } from './weeklyReviewApi';
import { computeMilestoneProgress, isWeeklyReviewDue } from './goalsLogic';
import { Goal, Milestone, WeeklyReview } from '../shared/types';
import { todayId, dayOfWeek, weekId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function GoalsScreen({ uid }: { uid: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'goals');

  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestonesInput, setMilestonesInput] = useState('');

  const [wentWell, setWentWell] = useState('');
  const [wentBadly, setWentBadly] = useState('');
  const [focusNext, setFocusNext] = useState('');

  const currentWeekId = weekId(todayId());

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listGoals(uid).then(setGoals).catch(handleError);
    getWeeklyReview(uid, currentWeekId).then((r) => {
      setReview(r);
      if (r) {
        setWentWell(r.wentWell);
        setWentBadly(r.wentBadly);
        setFocusNext(r.focusNext);
      }
    }).catch(handleError);
  }, [uid, currentWeekId]);

  async function handleAddGoal(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const milestones: Milestone[] = milestonesInput
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0)
      .map((label) => ({ id: crypto.randomUUID(), label, done: false }));
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: title.trim(),
      targetDate: targetDate.trim(),
      status: 'active',
      milestones,
    };
    await saveGoal(uid, goal);
    setGoals((prev) => [...prev, goal]);
    setTitle('');
    setTargetDate('');
    setMilestonesInput('');
  }

  async function handleToggleMilestone(goalId: string, milestoneId: string, done: boolean) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const updated: Goal = {
      ...goal,
      milestones: goal.milestones.map((m) => (m.id === milestoneId ? { ...m, done } : m)),
    };
    await saveGoal(uid, updated);
    setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
  }

  async function handleSaveReview(e: FormEvent) {
    e.preventDefault();
    const newReview: WeeklyReview = { weekId: currentWeekId, wentWell, wentBadly, focusNext };
    await saveWeeklyReview(uid, newReview);
    setReview(newReview);
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  const dow = dayOfWeek(todayId());
  const reviewDue = isWeeklyReviewDue(dow, review);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <ScreenHeader label="Goals & Journaling" />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Goals</h2>
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => {
            const progress = computeMilestoneProgress(goal);
            return (
              <li key={goal.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{goal.title}</span>
                  <span>{goal.targetDate}</span>
                </div>
                <div className="w-full bg-gray-200 rounded h-2">
                  <div className="h-2 rounded bg-blue-500" style={{ width: `${progress}%` }} />
                </div>
                <ul className="flex flex-col gap-1 pl-3">
                  {goal.milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={m.label}
                        checked={m.done}
                        onChange={(e) => handleToggleMilestone(goal.id, m.id, e.target.checked)}
                      />
                      <span className={m.done ? 'line-through text-gray-400' : ''}>{m.label}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleAddGoal} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Target date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Milestones (comma separated)"
            value={milestonesInput}
            onChange={(e) => setMilestonesInput(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add goal
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          Weekly review {reviewDue && <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">Due today</span>}
        </h2>
        <form onSubmit={handleSaveReview} className="flex flex-col gap-2">
          <textarea
            placeholder="What went well?"
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <textarea
            placeholder="What didn't go well?"
            value={wentBadly}
            onChange={(e) => setWentBadly(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <textarea
            placeholder="Focus for next week"
            value={focusNext}
            onChange={(e) => setFocusNext(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2 self-start">
            Save review
          </button>
        </form>
      </section>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Goals & Journaling" steps={tutorialContent.goals} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
