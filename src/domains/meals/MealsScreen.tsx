import { useEffect, useState, FormEvent } from 'react';
import { listGroceryItems, addGroceryItem, setGroceryItemChecked } from './groceryApi';
import { getMealLog, addMealEntry } from './mealLogApi';
import { listMealPlans, saveMealPlan, deleteMealPlan, isMealPlanDueToday } from './mealPlansApi';
import { applyCompletion } from '../shared/streakLogic';
import { WeekdayPicker, weekdaySummary } from '../shared/WeekdayPicker';
import { GroceryItem, MealLog, MealPlan } from '../shared/types';
import { dayOfWeek, todayId } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass, sectionLabelClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function MealsScreen({ uid }: { uid: string }) {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [mealLog, setMealLog] = useState<MealLog | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newMealEntry, setNewMealEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [planName, setPlanName] = useState('');
  const [planMeal, setPlanMeal] = useState<MealPlan['meal']>('dinner');
  const [planCadence, setPlanCadence] = useState<'daily' | 'weekly'>('daily');
  const [planWeeklyDays, setPlanWeeklyDays] = useState<number[]>([]);
  const tutorial = useTutorial(uid, 'meals');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listGroceryItems(uid).then(setGroceryItems).catch(handleError);
    getMealLog(uid).then(setMealLog).catch(handleError);
    listMealPlans(uid).then(setPlans).catch(handleError);
  }, [uid]);

  async function handleToggleItem(itemId: string, checked: boolean) {
    await setGroceryItemChecked(uid, itemId, checked);
    setGroceryItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, checked } : item)));
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const id = await addGroceryItem(uid, newItemName.trim());
    setGroceryItems((prev) => [...prev, { id, name: newItemName.trim(), checked: false }]);
    setNewItemName('');
  }

  async function handleAddMealEntry(e: FormEvent) {
    e.preventDefault();
    const trimmed = newMealEntry.trim();
    if (!trimmed) return;
    await addMealEntry(uid, trimmed);
    setMealLog((prev) => (prev ? { ...prev, entries: [...prev.entries, trimmed] } : prev));
    setNewMealEntry('');

    const today = todayId();
    const dow = dayOfWeek(today);
    const duePlans = plans.filter((p) => isMealPlanDueToday(p, dow) && p.lastCompletedDate !== today);
    for (const plan of duePlans) {
      const updated = { ...plan, ...applyCompletion(plan, today) };
      await saveMealPlan(uid, updated);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    }
  }

  async function handleAddPlan(e: FormEvent) {
    e.preventDefault();
    if (!planName.trim()) return;
    const plan: MealPlan = {
      id: crypto.randomUUID(),
      name: planName.trim(),
      meal: planMeal,
      cadence: planCadence,
      ...(planCadence === 'weekly' ? { weeklyDays: planWeeklyDays } : {}),
    };
    await saveMealPlan(uid, plan);
    setPlans((prev) => [...prev, plan]);
    setPlanName('');
    setPlanMeal('dinner');
    setPlanCadence('daily');
    setPlanWeeklyDays([]);
  }

  async function handleRemovePlan(planId: string) {
    await deleteMealPlan(uid, planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
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
      <ScreenHeader label="Meals & Groceries" />

      <section id="meals-plans" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Meal plans</p>
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => {
            const dueToday = isMealPlanDueToday(plan, dayOfWeek(todayId()));
            return (
              <li key={plan.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
                <span className="text-sm flex-1">{plan.name}</span>
                <span className="font-mono text-xs text-muted">{plan.meal}</span>
                <span className="font-mono text-xs text-muted">
                  {plan.cadence === 'daily' ? 'Daily' : weekdaySummary(plan.weeklyDays)}
                </span>
                <span className="font-mono text-xs text-muted">
                  🔥{plan.currentStreak ?? 0} · {plan.points ?? 0} pts
                </span>
                {dueToday && <span className="font-mono text-xs text-primary">Due today</span>}
                <button
                  type="button"
                  onClick={() => handleRemovePlan(plan.id)}
                  className="text-xs text-muted hover:text-ink"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <form id="meal-plan-form" onSubmit={handleAddPlan} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Meal name (e.g. Grilled chicken)"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className={fieldClass}
          />
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="meal-plan-meal">
            Meal
            <select
              id="meal-plan-meal"
              value={planMeal}
              onChange={(e) => setPlanMeal(e.target.value as MealPlan['meal'])}
              className={fieldClass}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
          <select
            value={planCadence}
            onChange={(e) => setPlanCadence(e.target.value as 'daily' | 'weekly')}
            className={fieldClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Specific weekdays</option>
          </select>
          {planCadence === 'weekly' && <WeekdayPicker value={planWeeklyDays} onChange={setPlanWeeklyDays} />}
          <button type="submit" className={buttonClass}>
            Add plan
          </button>
        </form>
      </section>

      <hr className="border-line" />

      <section id="meals-grocery" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Grocery list</p>
        <ul className="flex flex-col gap-2">
          {groceryItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 border-b border-line last:border-b-0 pb-2">
              <input
                type="checkbox"
                aria-label={item.name}
                checked={item.checked}
                onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className={`text-sm ${item.checked ? 'line-through text-muted' : ''}`}>{item.name}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddItem} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="New grocery item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add item
          </button>
        </form>
      </section>

      <hr className="border-line" />

      <section id="meals-log" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Today's meals</p>
        <ul className="flex flex-col gap-1.5">
          {mealLog?.entries.map((entry, i) => (
            <li key={i} className="text-sm border-b border-line last:border-b-0 pb-1.5">
              {entry}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddMealEntry} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="What did you eat?"
            value={newMealEntry}
            onChange={(e) => setNewMealEntry(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add entry
          </button>
        </form>
      </section>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Meals & Groceries" steps={tutorialContent.meals} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
