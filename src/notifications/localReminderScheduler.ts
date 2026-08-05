export function parseHHMM(hhmm: string): { hours: number; minutes: number } {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return { hours, minutes };
}

export function todayFireTime(configuredTime: string, now: Date): Date | null {
  const { hours, minutes } = parseHHMM(configuredTime);
  const fireDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  return fireDate.getTime() > now.getTime() ? fireDate : null;
}

export function localDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
