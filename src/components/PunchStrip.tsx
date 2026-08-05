export type PunchState = 'filled' | 'today' | 'empty';

export function buildPunchDays(filledCount: number, totalDays: number): PunchState[] {
  return Array.from({ length: totalDays }, (_, i) => {
    if (i < filledCount) return 'filled';
    if (i === filledCount) return 'today';
    return 'empty';
  });
}

export function PunchStrip({ days, className }: { days: PunchState[]; className?: string }) {
  return (
    <div className={`flex gap-2 sm:gap-2.5 ${className ?? ''}`} role="img" aria-label={`Streak strip: ${days.filter((d) => d !== 'empty').length} of ${days.length} days`}>
      {days.map((state, i) => (
        <span
          key={i}
          style={{ animationDelay: `${0.4 + i * 0.07}s` }}
          className={
            'w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-none ' +
            (state === 'filled'
              ? 'bg-ink animate-pop-in'
              : state === 'today'
                ? 'bg-gradient-to-br from-primary to-primary-dark animate-pop-breathe'
                : 'border-[1.5px] border-line animate-pop-in')
          }
        />
      ))}
    </div>
  );
}
