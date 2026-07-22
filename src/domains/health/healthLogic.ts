import { WeightEntry } from '../shared/types';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function computeSleepDurationHours(bedtime: string, wakeTime: string): number {
  const bedMinutes = toMinutes(bedtime);
  let wakeMinutes = toMinutes(wakeTime);
  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += 24 * 60;
  }
  const hours = (wakeMinutes - bedMinutes) / 60;
  return Math.round(hours * 10) / 10;
}

export function computeWeightChange(entries: WeightEntry[]): number | null {
  if (entries.length < 2) return null;
  return Math.round((entries[0].weightKg - entries[1].weightKg) * 10) / 10;
}
