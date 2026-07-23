import { describe, it, expect } from 'vitest';
import { isBillDueToday, isChoreDueToday, daysInMonthFor, Bill, ChoreConfig } from './dueChecks';

describe('isBillDueToday', () => {
  const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'housing' };

  it('is due when dueDay matches the day of month', () => {
    expect(isBillDueToday(bill, 1, 31)).toBe(true);
    expect(isBillDueToday(bill, 2, 31)).toBe(false);
  });

  it('clamps to the last day of a short month', () => {
    const lateBill: Bill = { ...bill, dueDay: 31 };
    expect(isBillDueToday(lateBill, 28, 28)).toBe(true); // Feb, non-leap
    expect(isBillDueToday(lateBill, 27, 28)).toBe(false);
  });
});

describe('isChoreDueToday', () => {
  it('is always due for a daily chore', () => {
    const chore: ChoreConfig = { id: 'c1', name: 'Dishes', cadence: 'daily' };
    expect(isChoreDueToday(chore, 3)).toBe(true);
  });

  it('is due only on configured weekdays for a weekly chore', () => {
    const chore: ChoreConfig = { id: 'c2', name: 'Trash', cadence: 'weekly', weeklyDays: [1, 4] };
    expect(isChoreDueToday(chore, 1)).toBe(true);
    expect(isChoreDueToday(chore, 4)).toBe(true);
    expect(isChoreDueToday(chore, 2)).toBe(false);
  });

  it('is not due when a weekly chore has no configured days', () => {
    const chore: ChoreConfig = { id: 'c3', name: 'Laundry', cadence: 'weekly' };
    expect(isChoreDueToday(chore, 1)).toBe(false);
  });
});

describe('daysInMonthFor', () => {
  it('returns 28 for February of a non-leap year', () => {
    expect(daysInMonthFor(2026, 2)).toBe(28);
  });

  it('returns 31 for July', () => {
    expect(daysInMonthFor(2026, 7)).toBe(31);
  });
});
