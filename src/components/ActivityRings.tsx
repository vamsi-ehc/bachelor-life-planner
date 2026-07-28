export interface RingSegment {
  key: string;
  color: string;
  fraction: number;
}

const RADII = [92, 80, 68, 56, 44, 32, 20];
const STROKE = 7;
const CENTER = 110;

export function ActivityRings({
  segments,
  size = 150,
  className,
}: {
  segments: RingSegment[];
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Today's completion by domain"
    >
      <g fill="none" strokeLinecap="round">
        {segments.map((s, i) => (
          <circle
            key={`track-${s.key}`}
            cx={CENTER}
            cy={CENTER}
            r={RADII[i]}
            stroke="#DCDFD5"
            strokeWidth={STROKE}
          />
        ))}
        {segments.map((s, i) => {
          const r = RADII[i];
          const circumference = 2 * Math.PI * r;
          const dash = Math.max(circumference * Math.min(s.fraction, 1), 0);
          return (
            <circle
              key={`prog-${s.key}`}
              cx={CENTER}
              cy={CENTER}
              r={r}
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circumference}`}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          );
        })}
      </g>
    </svg>
  );
}
