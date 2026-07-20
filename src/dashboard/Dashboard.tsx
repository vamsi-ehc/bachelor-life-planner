import { useDashboardData } from './useDashboardData';
import { StatusChip } from '../components/StatusChip';
import { DueNowStrip } from './DueNowStrip';

export function Dashboard({ uid, onNavigate }: { uid: string; onNavigate: (path: string) => void }) {
  const { loading, completion, chores, dueItems, streak, dayHealth } = useDashboardData(uid);

  if (loading || !completion) {
    return <p className="p-6">Loading...</p>;
  }

  const choresDoneCount = chores.filter((c) => completion.chores[c.id]).length;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <p className="text-sm text-gray-500">{completion.date}</p>
        <p className="text-3xl font-bold">Streak: {streak}</p>
        <p className="text-lg">{dayHealth}% of today done</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatusChip
          label="Workout"
          status={completion.workout ? 'done' : 'not-started'}
          onClick={() => onNavigate('/workout')}
        />
        <StatusChip
          label="Learning"
          status={completion.learning ? 'done' : 'not-started'}
          onClick={() => onNavigate('/learning')}
        />
        <StatusChip
          label="Chores"
          status={
            chores.length === 0
              ? 'not-started'
              : choresDoneCount === chores.length
                ? 'done'
                : 'in-progress'
          }
          detail={`${choresDoneCount}/${chores.length}`}
          onClick={() => onNavigate('/chores')}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Due now</h2>
        <DueNowStrip items={dueItems} />
      </div>
    </div>
  );
}
