# Finances Credit/Debit Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Finances domain's expense/income + budget-limits model with a simpler debit/credit ledger that shows a current-month running balance, dropping budget/spend analysis entirely.

**Architecture:** Rename `Transaction.type` from `'expense' | 'income'` to `'debit' | 'credit'` throughout the shared type, the Firestore read/write layer, and the screen. Delete the budgets feature (type, API, UI) wholesale. Add one new pure function, `computeMonthlyBalance`, and surface it at the top of the existing ledger screen. Bills stay untouched.

**Tech Stack:** React + TypeScript, Firebase Firestore (`firebase/firestore` client SDK), Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies — every change uses packages already in `package.json`.
- Follow existing code style in `src/domains/finances/*`: named exports, no default exports, Tailwind utility classes from `src/components/ui.ts` (`fieldClass`, `buttonClass`, `sectionLabelClass`).
- Existing stored Firestore documents with `type: 'expense'` or `type: 'income'` are not migrated — this is pre-launch data, per the design spec.
- Run `npx vitest run <file>` (not the full suite) after each task's implementation step, and run the full suite (`npm test`) before the final commit of the plan.

---

### Task 1: Rename `Transaction.type` to debit/credit

**Files:**
- Modify: `src/domains/shared/types.ts:118-138`
- Modify: `src/domains/finances/transactionsApi.ts`
- Test: `src/domains/finances/transactionsApi.test.ts`

**Interfaces:**
- Produces: `Transaction.type: 'debit' | 'credit'` (was `'expense' | 'income'`) — consumed by Task 3 (`financeLogic.ts`) and Task 4 (`FinancesScreen.tsx`).
- Produces: `Budget` interface removed from `src/domains/shared/types.ts` — Task 2 deletes the last file that imports it.

- [ ] **Step 1: Update the test file to expect debit/credit**

Replace the full contents of `src/domains/finances/transactionsApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockQuery = vi.fn((..._args: unknown[]) => ({}));
const mockWhere = vi.fn((..._args: unknown[]) => ({}));
const mockOrderBy = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { addTransaction, listTransactionsForMonth } from './transactionsApi';

describe('transactionsApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('addTransaction writes the entry and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'tx1' });
    const id = await addTransaction('user1', {
      date: '2026-07-20',
      amount: 42.5,
      category: 'Groceries',
      type: 'debit',
    });
    expect(id).toBe('tx1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      amount: 42.5,
      category: 'Groceries',
      type: 'debit',
    });
  });

  it('listTransactionsForMonth maps docs to Transaction objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'tx1',
          data: () => ({ date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'debit' }),
        },
      ],
    });
    const result = await listTransactionsForMonth('user1', '2026-07');
    expect(result).toEqual([
      { id: 'tx1', date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'debit' },
    ]);
  });

  it('listTransactionsForMonth defaults missing fields', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'tx2',
          data: () => ({ category: 'Food' }),
        },
        {
          id: 'tx3',
          data: () => ({ date: '2026-07-19', amount: 15.0, type: 'credit', note: 'Bonus' }),
        },
      ],
    });
    const result = await listTransactionsForMonth('user1', '2026-07');
    expect(result).toEqual([
      { id: 'tx2', date: '', amount: 0, category: 'Food', type: 'debit' },
      { id: 'tx3', date: '2026-07-19', amount: 15.0, category: '', type: 'credit', note: 'Bonus' },
    ]);
  });

});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/finances/transactionsApi.test.ts`
Expected: FAIL — the `type: 'debit'`/`'credit'` fixtures don't match the current `'expense'`/`'income'` decode logic in `listTransactionsForMonth`.

- [ ] **Step 3: Update `Transaction` in the shared types**

In `src/domains/shared/types.ts`, replace:

```typescript
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
  note?: string;
}
```

with:

```typescript
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  type: 'debit' | 'credit';
  note?: string;
}
```

Also delete the `Budget` interface (currently `types.ts:135-138`):

```typescript
export interface Budget {
  category: string;
  monthlyLimit: number;
}
```

- [ ] **Step 4: Update `transactionsApi.ts`**

Replace the full contents of `src/domains/finances/transactionsApi.ts`:

```typescript
import { collection, query, where, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Transaction } from '../shared/types';

function decodeTransaction(id: string, data: Partial<Omit<Transaction, 'id'>>): Transaction {
  return {
    id,
    date: data.date ?? '',
    amount: typeof data.amount === 'number' ? data.amount : 0,
    category: data.category ?? '',
    type: data.type === 'credit' ? 'credit' : 'debit',
    ...(data.note !== undefined && { note: data.note }),
  };
}

export async function addTransaction(uid: string, entry: Omit<Transaction, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'transactions'), entry);
  return ref.id;
}

export async function listTransactionsForMonth(uid: string, month: string): Promise<Transaction[]> {
  const q = query(
    collection(db, 'users', uid, 'transactions'),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => decodeTransaction(d.id, d.data() as Partial<Omit<Transaction, 'id'>>));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/domains/finances/transactionsApi.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/domains/shared/types.ts src/domains/finances/transactionsApi.ts src/domains/finances/transactionsApi.test.ts
git commit -m "refactor: rename Transaction.type to debit/credit, add listAllTransactions"
```

---

### Task 2: Remove the Budget feature

**Files:**
- Delete: `src/domains/finances/budgetsApi.ts`
- Delete: `src/domains/finances/budgetsApi.test.ts`

**Interfaces:**
- Consumes: nothing (this task only removes code).
- Produces: nothing new — confirms no remaining references to `Budget`, `listBudgets`, or `saveBudget` outside `FinancesScreen.tsx` (updated in Task 4).

- [ ] **Step 1: Delete the budget API files**

```bash
git rm src/domains/finances/budgetsApi.ts src/domains/finances/budgetsApi.test.ts
```

- [ ] **Step 2: Verify nothing else references the deleted module**

Run: `grep -rn "budgetsApi\|listBudgets\|saveBudget" src --include=*.ts --include=*.tsx`
Expected: Only `src/domains/finances/FinancesScreen.tsx` and `src/domains/finances/FinancesScreen.test.tsx` match — both are rewritten in Task 4. If any other file matches, stop and investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove the budgets feature"
```

---

### Task 3: Add `computeMonthlyBalance`, remove budget math

**Files:**
- Modify: `src/domains/finances/financeLogic.ts`
- Test: `src/domains/finances/financeLogic.test.ts`

**Interfaces:**
- Consumes: `Transaction` from `../shared/types` (Task 1's `'debit' | 'credit'` shape).
- Produces: `computeMonthlyBalance(transactions: Transaction[]): number` — consumed by Task 4 (`FinancesScreen.tsx`).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/domains/finances/financeLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeMonthlyBalance } from './financeLogic';
import { Transaction } from '../shared/types';

describe('computeMonthlyBalance', () => {
  it('sums credits and subtracts debits', () => {
    const transactions: Transaction[] = [
      { id: 't1', date: '2026-07-01', amount: 500, category: 'Salary', type: 'credit' },
      { id: 't2', date: '2026-07-02', amount: 120, category: 'Groceries', type: 'debit' },
      { id: 't3', date: '2026-07-03', amount: 40, category: 'Transport', type: 'debit' },
    ];
    expect(computeMonthlyBalance(transactions)).toBe(340);
  });

  it('returns 0 for an empty list', () => {
    expect(computeMonthlyBalance([])).toBe(0);
  });

  it('returns a negative number when debits exceed credits', () => {
    const transactions: Transaction[] = [
      { id: 't1', date: '2026-07-01', amount: 50, category: 'Rent', type: 'debit' },
      { id: 't2', date: '2026-07-02', amount: 10, category: 'Gift', type: 'credit' },
    ];
    expect(computeMonthlyBalance(transactions)).toBe(-40);
  });

  it('returns the full sum when all entries are credits', () => {
    const transactions: Transaction[] = [
      { id: 't1', date: '2026-07-01', amount: 100, category: 'Salary', type: 'credit' },
      { id: 't2', date: '2026-07-02', amount: 25, category: 'Refund', type: 'credit' },
    ];
    expect(computeMonthlyBalance(transactions)).toBe(125);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/finances/financeLogic.test.ts`
Expected: FAIL — `computeMonthlyBalance` is not defined (current file only exports `computeCategorySpend`/`computeBudgetPercent`).

- [ ] **Step 3: Implement `computeMonthlyBalance`**

Replace the full contents of `src/domains/finances/financeLogic.ts`:

```typescript
import { Transaction } from '../shared/types';

export function computeMonthlyBalance(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/finances/financeLogic.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/finances/financeLogic.ts src/domains/finances/financeLogic.test.ts
git commit -m "refactor: replace budget spend math with computeMonthlyBalance"
```

---

### Task 4: Rewrite `FinancesScreen` — drop budgets UI, add balance, debit/credit labels

**Files:**
- Modify: `src/domains/finances/FinancesScreen.tsx`
- Test: `src/domains/finances/FinancesScreen.test.tsx`

**Interfaces:**
- Consumes: `computeMonthlyBalance` (Task 3), `Transaction`/`Bill` types (Task 1, unchanged for `Bill`), `addTransaction`/`listTransactionsForMonth` (Task 1), `listBills`/`saveBill`/`isBillDueToday` (unchanged, from `./billsApi`).
- Produces: no new exports consumed elsewhere — this is the leaf UI component for the Finances route.

- [ ] **Step 1: Write the updated test file**

Replace the full contents of `src/domains/finances/FinancesScreen.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockListTransactions = vi.fn();
const mockAddTransaction = vi.fn().mockResolvedValue('tx1');
const mockListBills = vi.fn();
const mockSaveBill = vi.fn().mockResolvedValue(undefined);

vi.mock('./transactionsApi', () => ({
  listTransactionsForMonth: (...args: [string, string]) => mockListTransactions(...args),
  addTransaction: (...args: [string, unknown]) => mockAddTransaction(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('./billsApi', async () => {
  const actual = await vi.importActual<typeof import('./billsApi')>('./billsApi');
  return {
    ...actual,
    listBills: (...args: [string]) => mockListBills(...args),
    saveBill: (...args: [string, unknown]) => mockSaveBill(...args),
  };
});
vi.mock('../../tutorials/useTutorial', () => ({
  useTutorial: () => ({ isOpen: false, dismiss: vi.fn() }),
}));

import { FinancesScreen } from './FinancesScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <FinancesScreen uid="user1" />
    </MemoryRouter>
  );
}

describe('FinancesScreen', () => {
  beforeEach(() => {
    mockListTransactions.mockReset();
    mockAddTransaction.mockClear();
    mockListBills.mockReset();
    mockSaveBill.mockClear();
  });

  it('adds a transaction as a debit by default', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListTransactions).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Amount'), '42.5');
    await user.type(screen.getByPlaceholderText('Category'), 'Groceries');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockAddTransaction).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ amount: 42.5, category: 'Groceries', type: 'debit' })
    );
  });

  it('shows the monthly balance from credits minus debits', async () => {
    mockListTransactions.mockResolvedValue([
      { id: 't1', date: '2026-07-20', amount: 500, category: 'Salary', type: 'credit' },
      { id: 't2', date: '2026-07-21', amount: 200, category: 'Groceries', type: 'debit' },
    ]);
    mockListBills.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('+$300.00')).toBeInTheDocument());
  });

  it('shows a negative monthly balance in red when debits exceed credits', async () => {
    mockListTransactions.mockResolvedValue([
      { id: 't1', date: '2026-07-20', amount: 50, category: 'Rent', type: 'debit' },
    ]);
    mockListBills.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('-$50.00')).toBeInTheDocument());
  });

  it('does not render a budgets section', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);

    renderScreen();
    await waitFor(() => expect(mockListTransactions).toHaveBeenCalled());

    expect(screen.queryByText('Budgets')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Budget category')).not.toBeInTheDocument();
  });

  it('flags a bill as due today', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBills.mockResolvedValue([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate(), category: 'Housing' },
    ]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('Due today')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domains/finances/FinancesScreen.test.tsx`
Expected: FAIL — the current component still renders a "Budgets" section, defaults the transaction type to `'expense'`, and has no balance display.

- [ ] **Step 3: Rewrite `FinancesScreen.tsx`**

Replace the full contents of `src/domains/finances/FinancesScreen.tsx`:

```typescript
import { useEffect, useState, FormEvent } from 'react';
import { addTransaction, listTransactionsForMonth } from './transactionsApi';
import { listBills, saveBill, isBillDueToday } from './billsApi';
import { computeMonthlyBalance } from './financeLogic';
import { Transaction, Bill } from '../shared/types';
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tutorial = useTutorial(uid, 'finances');

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [note, setNote] = useState('');

  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('');
  const [billCategory, setBillCategory] = useState('');

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listTransactionsForMonth(uid, currentMonth()).then(setTransactions).catch(handleError);
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
  const monthlyBalance = computeMonthlyBalance(transactions);

  return (
    <PageCard>
      <ScreenHeader label="Finances" />

      <section id="finances-transactions" className="flex flex-col gap-3">
        <p className={sectionLabelClass}>This month</p>
        <p className={`font-display font-bold text-2xl ${monthlyBalance < 0 ? 'text-[#B3261E]' : 'text-ok'}`}>
          {monthlyBalance < 0 ? '-' : '+'}${Math.abs(monthlyBalance).toFixed(2)}
        </p>

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
            onChange={(e) => setType(e.target.value as 'debit' | 'credit')}
            className={fieldClass}
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
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
              <span className={t.type === 'debit' ? 'text-[#B3261E]' : 'text-ok'}>
                {t.type === 'debit' ? '-' : '+'}${t.amount.toFixed(2)}
              </span>{' '}
              ({t.category})
              {t.note ? ` — ${t.note}` : ''}
            </li>
          ))}
        </ul>
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domains/finances/FinancesScreen.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, no failures anywhere in the repo (confirms no other file still imports `Budget`, `computeCategorySpend`, or `computeBudgetPercent`).

- [ ] **Step 6: Commit**

```bash
git add src/domains/finances/FinancesScreen.tsx src/domains/finances/FinancesScreen.test.tsx
git commit -m "feat: rewrite Finances screen as a debit/credit ledger with monthly balance"
```

---

## Self-review notes

- **Spec coverage:** §1 (remove budgets) → Tasks 2, 4. §2 (debit/credit rename) → Task 1, 4. §3 (monthly balance) → Task 3, 4. §4 (testing) → covered inline in every task. §5 (out of scope: bank import, bills-linking, migration) → nothing in this plan does any of those.
- **Placeholder scan:** none found — every step has full code, no "TBD"/"similar to above".
- **Type consistency:** `computeMonthlyBalance(transactions: Transaction[]): number` (Task 3) matches its only call site in Task 4.
- **Cross-plan note:** the multiuser/account-lifecycle plan (`docs/superpowers/plans/2026-08-05-multiuser-positioning.md`) also modifies `src/domains/finances/transactionsApi.ts` to add a `listAllTransactions` export for data-export purposes. That plan is written against the state this plan leaves `transactionsApi.ts` in (post debit/credit rename) — **run this Finances plan first**, then the multiuser plan.
