export function todayId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayOfWeek(dateId: string): number {
  return new Date(`${dateId}T00:00:00`).getDay();
}

export function dayOfMonth(dateId: string): number {
  return new Date(`${dateId}T00:00:00`).getDate();
}

export function daysInMonth(dateId: string): number {
  const d = new Date(`${dateId}T00:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function weekId(dateId: string): string {
  const d = new Date(`${dateId}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
