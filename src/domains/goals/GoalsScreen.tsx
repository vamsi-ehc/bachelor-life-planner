import { useEffect, useState, FormEvent } from 'react';
import { listGoals, saveGoal } from './goalsApi';
import { getWeeklyReview, saveWeeklyReview } from './weeklyReviewApi';
import { computeMilestoneProgress, isWeeklyReviewDue } from './goalsLogic';
import { Goal, Milestone, WeeklyReview } from '../shared/types';
import { todayId, dayOfWeek, weekId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass, sectionLabelClass } from '../../components/ui';
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
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  const dow = dayOfWeek(todayId());
  const reviewDue = isWeeklyReviewDue(dow, review);

  return (
    <PageCard>
      <ScreenHeader label="Goals & Journaling" />

      <section className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Goals</p>
        <ul id="goals-list" className="flex flex-col gap-4">
          {goals.map((goal) => {
            const progress = computeMilestoneProgress(goal);
            return (
              <li key={goal.id} className="flex flex-col gap-1.5 border-b border-line last:border-b-0 pb-3">
                <div className="flex justify-between text-sm">
                  <span className="font-display font-semibold">{goal.title}</span>
                  <span className="font-mono text-xs text-muted">{goal.targetDate}</span>
                </div>
                <div className="w-full bg-line rounded-full h-2">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <ul className="flex flex-col gap-1 pl-1">
                  {goal.milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={m.label}
                        checked={m.done}
                        onChange={(e) => handleToggleMilestone(goal.id, m.id, e.target.checked)}
                        className="accent-primary w-4 h-4"
                      />
                      <span className={m.done ? 'line-through text-muted' : ''}>{m.label}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <form id="goals-add" onSubmit={handleAddGoal} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
          <input
            type="text"
            placeholder="Target date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={fieldClass}
          />
          <input
            type="text"
            placeholder="Milestones (comma separated)"
            value={milestonesInput}
            onChange={(e) => setMilestonesInput(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add goal
          </button>
        </form>
      </section>

      <hr className="border-line" />

      <section id="goals-review" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <p className={sectionLabelClass}>Weekly review</p>
          {reviewDue && (
            <span className="font-mono text-[10px] uppercase tracking-wide bg-primary-dim text-primary rounded-full px-2 py-0.5">
              Due today
            </span>
          )}
        </div>
        <form onSubmit={handleSaveReview} className="flex flex-col gap-2">
          <textarea
            placeholder="What went well?"
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            className={fieldClass}
          />
          <textarea
            placeholder="What didn't go well?"
            value={wentBadly}
            onChange={(e) => setWentBadly(e.target.value)}
            className={fieldClass}
          />
          <textarea
            placeholder="Focus for next week"
            value={focusNext}
            onChange={(e) => setFocusNext(e.target.value)}
            className={fieldClass}
          />
          <button type="submit" className={buttonClass}>
            Save review
          </button>
        </form>
      </section>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Goals & Journaling" steps={tutorialContent.goals} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
