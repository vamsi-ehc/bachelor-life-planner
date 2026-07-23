export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
}

export interface ChoreConfig {
  id: string;
  name: string;
  cadence: 'daily' | 'weekly';
  weeklyDays?: number[];
}

export function isBillDueToday(bill: Bill, dayOfMonth: number, daysInMonth: number): boolean {
  return bill.dueDay === dayOfMonth || (dayOfMonth === daysInMonth && bill.dueDay > daysInMonth);
}

export function isChoreDueToday(chore: ChoreConfig, dow: number): boolean {
  if (chore.cadence === 'daily') return true;
  return chore.weeklyDays?.includes(dow) ?? false;
}

export function daysInMonthFor(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
