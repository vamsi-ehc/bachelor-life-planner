import { useEffect, useState, FormEvent } from 'react';
import { addTransaction, listTransactionsForMonth } from './transactionsApi';
import { listBudgets, saveBudget } from './budgetsApi';
import { listBills, saveBill, isBillDueToday } from './billsApi';
import { computeCategorySpend, computeBudgetPercent } from './financeLogic';
import { Transaction, Budget, Bill } from '../shared/types';
import { todayId, dayOfMonth, daysInMonth } from '../shared/dateUtils';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PageCard } from '../../components/PageCard';
import { fieldClass, buttonClass, sectionLabelClass } from '../../components/ui';
import { useTutorial } from '../../tutorials/useTutorial';
import { TutorialStoryboard } from '../../tutorials/TutorialStoryboard';
import { tutorialContent } from '../../tutorials/tutorialContent';

function currentMonth(): string {
  return todayId().slice(0, 7);
}

export function FinancesScreen({ uid }: { uid: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'finances');

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [note, setNote] = useState('');

  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');

  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('');
  const [billCategory, setBillCategory] = useState('');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listTransactionsForMonth(uid, currentMonth()).then(setTransactions).catch(handleError);
    listBudgets(uid).then(setBudgets).catch(handleError);
    listBills(uid).then(setBills).catch(handleError);
  }, [uid]);

  async function handleAddTransaction(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!category.trim() || Number.isNaN(parsedAmount)) return;
    const entry: Omit<Transaction, 'id'> = {
      date: todayId(),
      amount: parsedAmount,
      category: category.trim(),
      type,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const id = await addTransaction(uid, entry);
    setTransactions((prev) => [{ id, ...entry }, ...prev]);
    setAmount('');
    setCategory('');
    setNote('');
  }

  async function handleSetBudget(e: FormEvent) {
    e.preventDefault();
    const parsedLimit = parseFloat(budgetLimit);
    if (!budgetCategory.trim() || Number.isNaN(parsedLimit)) return;
    const budget: Budget = { category: budgetCategory.trim(), monthlyLimit: parsedLimit };
    await saveBudget(uid, budget);
    setBudgets((prev) => [...prev.filter((b) => b.category !== budget.category), budget]);
    setBudgetCategory('');
    setBudgetLimit('');
  }

  async function handleAddBill(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(billAmount);
    const parsedDueDay = parseInt(billDueDay, 10);
    if (!billName.trim() || Number.isNaN(parsedAmount) || Number.isNaN(parsedDueDay)) return;
    const bill: Bill = {
      id: crypto.randomUUID(),
      name: billName.trim(),
      amount: parsedAmount,
      dueDay: parsedDueDay,
      category: billCategory.trim(),
    };
    await saveBill(uid, bill);
    setBills((prev) => [...prev, bill]);
    setBillName('');
    setBillAmount('');
    setBillDueDay('');
    setBillCategory('');
  }

  if (error) {
    return (
      <PageCard>
        <p className="text-sm text-[#B3261E]">Something went wrong: {error}</p>
      </PageCard>
    );
  }

  const dayOfMonthNow = dayOfMonth(todayId());
  const daysInMonthNow = daysInMonth(todayId());

  return (
    <PageCard>
      <ScreenHeader label="Finances" />

      <section id="finances-transactions" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Add transaction</p>
        <form onSubmit={handleAddTransaction} className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${fieldClass} w-28`}
          />
          <input
            type="text"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'expense' | 'income')}
            className={fieldClass}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
        <ul className="flex flex-col gap-1.5">
          {transactions.map((t) => (
            <li key={t.id} className="text-sm border-b border-line last:border-b-0 pb-1.5">
              <span className="font-mono text-xs text-muted">{t.date}</span>{' '}
              <span className={t.type === 'expense' ? 'text-[#B3261E]' : 'text-ok'}>
                {t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}
              </span>{' '}
              ({t.category})
              {t.note ? ` — ${t.note}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <hr className="border-line" />

      <section id="finances-budgets" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Budgets</p>
        <ul className="flex flex-col gap-3">
          {budgets.map((b) => {
            const spend = computeCategorySpend(transactions, b.category);
            const percent = computeBudgetPercent(spend, b.monthlyLimit);
            return (
              <li key={b.category}>
                <div className="flex justify-between text-sm">
                  <span>{b.category}</span>
                  <span className="font-mono text-xs text-muted">
                    ${spend.toFixed(2)} / ${b.monthlyLimit.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-1">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      background: percent >= 100 ? '#B3261E' : '#3947C4',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleSetBudget} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Budget category"
            value={budgetCategory}
            onChange={(e) => setBudgetCategory(e.target.value)}
            className={fieldClass}
          />
          <input
            type="number"
            placeholder="Monthly limit"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(e.target.value)}
            className={`${fieldClass} w-32`}
          />
          <button type="submit" className={buttonClass}>
            Set budget
          </button>
        </form>
      </section>

      <hr className="border-line" />

      <section id="finances-bills" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>Bills</p>
        <ul className="flex flex-col gap-1.5">
          {bills.map((bill) => (
            <li key={bill.id} className="text-sm flex items-center gap-2 border-b border-line last:border-b-0 pb-1.5">
              <span>
                {bill.name} — ${bill.amount.toFixed(2)} (due day {bill.dueDay})
              </span>
              {isBillDueToday(bill, dayOfMonthNow, daysInMonthNow) && (
                <span className="font-mono text-[10px] uppercase tracking-wide bg-primary-dim text-primary rounded-full px-2 py-0.5">
                  Due today
                </span>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddBill} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Bill name"
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            className={fieldClass}
          />
          <input
            type="number"
            placeholder="Bill amount"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            className={`${fieldClass} w-28`}
          />
          <input
            type="number"
            placeholder="Due day (1-31)"
            value={billDueDay}
            onChange={(e) => setBillDueDay(e.target.value)}
            className={`${fieldClass} w-32`}
          />
          <input
            type="text"
            placeholder="Bill category"
            value={billCategory}
            onChange={(e) => setBillCategory(e.target.value)}
            className={fieldClass}
          />
          <button type="submit" className={buttonClass}>
            Add bill
          </button>
        </form>
      </section>
      {tutorial.isOpen && (
        <TutorialStoryboard title="Finances" steps={tutorialContent.finances} onDismiss={tutorial.dismiss} />
      )}
    </PageCard>
  );
}
