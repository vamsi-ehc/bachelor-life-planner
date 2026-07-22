import { Transaction } from '../shared/types';

export function computeCategorySpend(transactions: Transaction[], category: string): number {
  return transactions
    .filter((t) => t.category === category && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
}

export function computeBudgetPercent(spend: number, monthlyLimit: number): number {
  if (monthlyLimit <= 0) return 0;
  return Math.min(100, Math.round((spend / monthlyLimit) * 100));
}
