const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdaySummary(weeklyDays: number[] | undefined): string {
  return (weeklyDays ?? []).map((d) => WEEKDAY_LABELS[d]).join(', ') || 'No days selected';
}

export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  function toggleDay(day: number) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-wrap gap-3">
      {WEEKDAY_LABELS.map((dayLabel, day) => (
        <label key={day} className="flex items-center gap-1 text-sm text-muted">
          <input
            type="checkbox"
            aria-label={dayLabel}
            checked={value.includes(day)}
            onChange={() => toggleDay(day)}
            className="accent-primary w-4 h-4"
          />
          {dayLabel}
        </label>
      ))}
    </div>
  );
}
