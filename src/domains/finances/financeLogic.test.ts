import { describe, it, expect } from 'vitest';
import { computeCategorySpend, computeBudgetPercent } from './financeLogic';
import { Transaction } from '../shared/types';

describe('computeCategorySpend', () => {
  it('sums expense amounts for the given category, ignoring income and other categories', () => {
    const transactions: Transaction[] = [
      { id: 't1', date: '2026-07-01', amount: 30, category: 'Groceries', type: 'expense' },
      { id: 't2', date: '2026-07-02', amount: 20, category: 'Groceries', type: 'expense' },
      { id: 't3', date: '2026-07-03', amount: 100, category: 'Groceries', type: 'income' },
      { id: 't4', date: '2026-07-04', amount: 15, category: 'Transport', type: 'expense' },
    ];
    expect(computeCategorySpend(transactions, 'Groceries')).toBe(50);
  });

  it('returns 0 when no transactions match the category', () => {
    expect(computeCategorySpend([], 'Groceries')).toBe(0);
  });
});

describe('computeBudgetPercent', () => {
  it('computes a rounded percentage of spend against the limit', () => {
    expect(computeBudgetPercent(50, 200)).toBe(25);
  });

  it('caps the percentage at 100 when spend exceeds the limit', () => {
    expect(computeBudgetPercent(250, 200)).toBe(100);
  });

  it('returns 0 when the limit is zero or negative, avoiding division by zero', () => {
    expect(computeBudgetPercent(50, 0)).toBe(0);
  });
});
