import { useEffect, useState, FormEvent } from 'react';
import { listGroceryItems, addGroceryItem, setGroceryItemChecked } from './groceryApi';
import { getMealLog, addMealEntry } from './mealLogApi';
import { GroceryItem, MealLog } from '../shared/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

export function MealsScreen({ uid }: { uid: string }) {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [mealLog, setMealLog] = useState<MealLog | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newMealEntry, setNewMealEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'meals');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listGroceryItems(uid).then(setGroceryItems).catch(handleError);
    getMealLog(uid).then(setMealLog).catch(handleError);
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
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <ScreenHeader label="Meals & Groceries" />

      <section id="meals-grocery" className="flex flex-col gap-2">
        <h2 className="font-semibold">Grocery list</h2>
        <ul className="flex flex-col gap-2">
          {groceryItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={item.name}
                checked={item.checked}
                onChange={(e) => handleToggleItem(item.id, e.target.checked)}
              />
              <span className={item.checked ? 'line-through text-gray-400' : ''}>{item.name}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddItem} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="New grocery item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add item
          </button>
        </form>
      </section>

      <section id="meals-log" className="flex flex-col gap-2">
        <h2 className="font-semibold">Today's meals</h2>
        <ul className="flex flex-col gap-1">
          {mealLog?.entries.map((entry, i) => (
            <li key={i} className="text-sm">
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
            className="border rounded px-3 py-2 flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add entry
          </button>
        </form>
      </section>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Meals & Groceries" steps={tutorialContent.meals} onDismiss={tutorial.dismiss} />
      )}
    </div>
  );
}
