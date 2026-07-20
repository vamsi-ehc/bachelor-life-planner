import { useEffect, useState, FormEvent } from 'react';
import { getCompletion, setLearningDone } from '../shared/completionsApi';
import { listLearningLogEntries, addLearningLogEntry } from './learningApi';
import { LearningLogEntry, DailyCompletion } from '../shared/types';
import { todayId } from '../shared/dateUtils';
import { PunchInButton } from '../../components/PunchInButton';

export function LearningScreen({ uid }: { uid: string }) {
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [entries, setEntries] = useState<LearningLogEntry[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    getCompletion(uid).then(setCompletion);
    listLearningLogEntries(uid).then(setEntries);
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

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Learning</h1>
      <PunchInButton done={completion?.learning ?? false} onToggle={handlePunchIn} />
      <form onSubmit={handleAddEntry} className="flex gap-2">
        <input
          type="text"
          placeholder="What did you study?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
          Add entry
        </button>
      </form>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="text-sm">
            {entry.date} — {entry.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
