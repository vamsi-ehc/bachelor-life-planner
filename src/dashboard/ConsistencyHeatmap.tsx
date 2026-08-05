import { DayHealthPoint } from './dashboardLogic';
import { dayOfWeek } from '../domains/shared/dateUtils';

const CELL = 11;
const GAP = 2.5;
const LEVEL_COLORS = ['#DCDFD5', '#B9C0E8', '#6C78D6', '#7D4DFE'];

function levelFor(value: number): number {
  if (value <= 0) return 0;
  if (value < 50) return 1;
  if (value < 100) return 2;
  return 3;
}

export function ConsistencyHeatmap({ points }: { points: DayHealthPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted">No history yet.</p>;
  }

  const leadingEmpty = dayOfWeek(points[0].date);
  const cells: (number | null)[] = [...Array(leadingEmpty).fill(null), ...points.map((p) => levelFor(p.value))];
  const weeks = Math.ceil(cells.length / 7);
  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="10-week consistency heatmap">
      {cells.map((level, i) => {
        if (level === null) return null;
        const col = Math.floor(i / 7);
        const row = i % 7;
        return (
          <circle
            key={i}
            cx={col * (CELL + GAP) + CELL / 2}
            cy={row * (CELL + GAP) + CELL / 2}
            r={CELL / 2 - 1}
            fill={LEVEL_COLORS[level]}
          />
        );
      })}
    </svg>
  );
}
