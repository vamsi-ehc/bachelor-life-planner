# Punch In — Phase 2: Finances + Meals & Groceries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Finances domain (manual expense/income log, per-category monthly budget bars, recurring bills with due-day flagging) and the Meals & Groceries domain (grocery checklist, daily "what did I eat" log) to Punch In, and wire both into the existing Dashboard and routing from Phase 1.

**Architecture:** Follows the exact pattern established in Phase 1 — one Firestore API module per concern, one screen component per domain, pure computation functions kept separate from I/O, all Firestore paths scoped under `users/{uid}/...`. The Dashboard gains two more status chips (Finances, Meals) and the due-now strip gains two more due-item sources (bills due today, groceries still needed), extending the pure functions in `src/dashboard/dashboardLogic.ts` and the fetch/compose logic in `src/dashboard/useDashboardData.ts` rather than restructuring them.

**Tech Stack:** Same as Phase 1 — Vite, React 18, TypeScript, Tailwind CSS, react-router-dom, Firebase (Auth + Firestore) client SDK v9+ modular API, Vitest, React Testing Library. No new dependencies.

## Global Constraints

- All Firestore paths are scoped under `users/{uid}/...` — no top-level collections (per spec §2, §7). New collections this phase: `users/{uid}/transactions`, `users/{uid}/budgets`, `users/{uid}/bills`, `users/{uid}/groceryItems`, `users/{uid}/mealLog`.
- No bank sync, no receipt scanning — transactions are entered manually (per spec §1, "Manual expense log" approved during brainstorming).
- No recipes — meal tracking is a free-text daily log only, groceries are a flat checklist (per spec §1, "Grocery list + simple meal log" approved during brainstorming).
- Reminder times, Settings UI, and Cloud Functions/push remain out of scope (Phase 5 per spec §8) — bills-due and groceries-needed surface only in the Dashboard's due-now strip in this phase, not as push notifications.
- Every new Firestore read must default missing/partial fields rather than trust the raw doc shape — Phase 1's smoke test found a real crash (`ChoresScreen` indexing `completion.chores[id]` when an older partial write omitted the `chores` field) caused by skipping this. Any `getDoc`-based fetch in this phase (`getMealLog`) must apply the same "doc exists but fields may be missing" defaulting as `completionsApi.getCompletion` does.
- Test suite must remain at zero warnings (no React `act()` warnings, no console noise) and `npm run build` must succeed after every task — both established as hard bars in Phase 1.
- Follow the established test-environment fixes discovered repeatedly in Phase 1: mock `../../firebase/config` (or `../firebase/config`, depending on file depth) in any test that transitively imports it, and type mock functions invoked via spread args as `vi.fn((..._args: unknown[]) => ...)` to satisfy `tsc`'s TS2556 check (`vitest` alone won't catch this — only `npm run build` will).

---

## File Structure

```
src/domains/shared/types.ts       — MODIFY: extend DomainKey union, add Transaction/Bill/Budget/GroceryItem/MealLog types
src/domains/shared/dateUtils.ts   — MODIFY: add dayOfMonth(dateId)
src/domains/finances/
  transactionsApi.ts               — addTransaction, listTransactionsForMonth
  financeLogic.ts                  — computeCategorySpend, computeBudgetPercent (pure)
  budgetsApi.ts                    — listBudgets, saveBudget
  billsApi.ts                      — listBills, saveBill, isBillDueToday (pure)
  FinancesScreen.tsx                — add-transaction form + list, budget bars + set-budget form, bills list + add-bill form
src/domains/meals/
  groceryApi.ts                    — listGroceryItems, addGroceryItem, setGroceryItemChecked
  mealLogApi.ts                    — getMealLog, addMealEntry
  MealsScreen.tsx                   — grocery checklist + add-item form, daily meal log + add-entry form
src/dashboard/dashboardLogic.ts   — MODIFY: add computeBillDueItems, computeGroceryDueItem (pure)
src/dashboard/useDashboardData.ts — MODIFY: fetch bills + groceryItems, merge into dueItems, return bills/groceryItems
src/dashboard/Dashboard.tsx       — MODIFY: add Finances + Meals status chips
src/App.tsx                       — MODIFY: add /finances and /meals routes
```

---

### Task 1: Extend shared types and date utilities

**Files:**
- Modify: `src/domains/shared/types.ts`
- Modify: `src/domains/shared/dateUtils.ts`
- Test: `src/domains/shared/dateUtils.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `DomainKey`, `DueItem` already defined)
- Produces:
  - `types.ts`: `DomainKey` extended to `'workout' | 'learning' | 'chores' | 'finances' | 'meals'`; `Transaction { id: string; date: string; amount: number; category: string; type: 'expense' | 'income'; note?: string }`; `Bill { id: string; name: string; amount: number; dueDay: number; category: string }`; `Budget { category: string; monthlyLimit: number }`; `GroceryItem { id: string; name: string; checked: boolean }`; `MealLog { date: string; entries: string[] }`
  - `dateUtils.ts`: `dayOfMonth(dateId: string): number`

- [ ] **Step 1: Write the failing test for dayOfMonth**

Add to `src/domains/shared/dateUtils.test.ts` (append a new `describe` block after the existing `dayOfWeek` block):

```ts
describe('dayOfMonth', () => {
  it('returns the day-of-month number for a date id', () => {
    expect(dayOfMonth('2026-07-20')).toBe(20);
  });

  it('returns single-digit days without padding', () => {
    expect(dayOfMonth('2026-07-05')).toBe(5);
  });
});
```

Update the import line at the top of the file to include `dayOfMonth`:

```ts
import { todayId, dayOfWeek, dayOfMonth } from './dateUtils';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/shared/dateUtils.test.ts`
Expected: FAIL — `dayOfMonth is not a function` (or similar, since it's not exported yet)

- [ ] **Step 3: Implement dayOfMonth**

Append to `src/domains/shared/dateUtils.ts`:

```ts
export function dayOfMonth(dateId: string): number {
  return new Date(`${dateId}T00:00:00`).getDate();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/shared/dateUtils.test.ts`
Expected: PASS (6 tests: 2 existing `todayId` + 2 existing `dayOfWeek` + 2 new `dayOfMonth`)

- [ ] **Step 5: Extend the shared types (no test — pure type declarations)**

Replace the `DomainKey` line in `src/domains/shared/types.ts`:

```ts
export type DomainKey = 'workout' | 'learning' | 'chores' | 'finances' | 'meals';
```

Append to the end of `src/domains/shared/types.ts`:

```ts
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
  note?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
}

export interface Budget {
  category: string;
  monthlyLimit: number;
}

export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface MealLog {
  date: string;
  entries: string[];
}
```

- [ ] **Step 6: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (all existing Phase 1 tests still pass — `DomainKey`'s new union members are additive and don't invalidate existing `'chores'`/`'workout'`/`'learning'` usages)

- [ ] **Step 7: Commit**

```bash
git add src/domains/shared/types.ts src/domains/shared/dateUtils.ts src/domains/shared/dateUtils.test.ts
git commit -m "feat: add Finances/Meals shared types and dayOfMonth util"
```

---

### Task 2: Transactions API and finance pure logic

**Files:**
- Create: `src/domains/finances/transactionsApi.ts`
- Create: `src/domains/finances/financeLogic.ts`
- Test: `src/domains/finances/transactionsApi.test.ts`
- Test: `src/domains/finances/financeLogic.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `Transaction` from `../shared/types`
- Produces: `addTransaction(uid: string, entry: Omit<Transaction, 'id'>): Promise<string>`, `listTransactionsForMonth(uid: string, month: string): Promise<Transaction[]>` (month is `'YYYY-MM'`); `computeCategorySpend(transactions: Transaction[], category: string): number`, `computeBudgetPercent(spend: number, monthlyLimit: number): number`

- [ ] **Step 1: Write the failing test for transactionsApi**

Create `src/domains/finances/transactionsApi.test.ts`:

```ts
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
      type: 'expense',
    });
    expect(id).toBe('tx1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      amount: 42.5,
      category: 'Groceries',
      type: 'expense',
    });
  });

  it('listTransactionsForMonth maps docs to Transaction objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'tx1',
          data: () => ({ date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'expense' }),
        },
      ],
    });
    const result = await listTransactionsForMonth('user1', '2026-07');
    expect(result).toEqual([
      { id: 'tx1', date: '2026-07-20', amount: 42.5, category: 'Groceries', type: 'expense' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/finances/transactionsApi.test.ts`
Expected: FAIL with "Cannot find module './transactionsApi'"

- [ ] **Step 3: Implement transactionsApi**

Create `src/domains/finances/transactionsApi.ts`:

```ts
import { collection, query, where, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Transaction } from '../shared/types';

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
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/finances/transactionsApi.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for financeLogic**

Create `src/domains/finances/financeLogic.test.ts`:

```ts
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/domains/finances/financeLogic.test.ts`
Expected: FAIL with "Cannot find module './financeLogic'"

- [ ] **Step 7: Implement financeLogic**

Create `src/domains/finances/financeLogic.ts`:

```ts
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/domains/finances/financeLogic.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Commit**

```bash
git add src/domains/finances/transactionsApi.ts src/domains/finances/transactionsApi.test.ts src/domains/finances/financeLogic.ts src/domains/finances/financeLogic.test.ts
git commit -m "feat: add transactions Firestore API and finance pure logic"
```

---

### Task 3: Budgets API

**Files:**
- Create: `src/domains/finances/budgetsApi.ts`
- Test: `src/domains/finances/budgetsApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `Budget` from `../shared/types`
- Produces: `listBudgets(uid: string): Promise<Budget[]>`, `saveBudget(uid: string, budget: Budget): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/domains/finances/budgetsApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listBudgets, saveBudget } from './budgetsApi';

describe('budgetsApi', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
  });

  it('listBudgets maps docs to Budget objects using the doc id as category', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'Groceries', data: () => ({ monthlyLimit: 200 }) }],
    });
    const result = await listBudgets('user1');
    expect(result).toEqual([{ category: 'Groceries', monthlyLimit: 200 }]);
  });

  it('saveBudget writes the monthly limit keyed by category', async () => {
    await saveBudget('user1', { category: 'Groceries', monthlyLimit: 200 });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { monthlyLimit: 200 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/finances/budgetsApi.test.ts`
Expected: FAIL with "Cannot find module './budgetsApi'"

- [ ] **Step 3: Implement budgetsApi**

Create `src/domains/finances/budgetsApi.ts`:

```ts
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Budget } from '../shared/types';

export async function listBudgets(uid: string): Promise<Budget[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'budgets'));
  return snap.docs.map((d) => ({ category: d.id, ...(d.data() as Omit<Budget, 'category'>) }));
}

export async function saveBudget(uid: string, budget: Budget): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'budgets', budget.category), { monthlyLimit: budget.monthlyLimit });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/finances/budgetsApi.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/finances/budgetsApi.ts src/domains/finances/budgetsApi.test.ts
git commit -m "feat: add budgets Firestore API"
```

---

### Task 4: Bills API

**Files:**
- Create: `src/domains/finances/billsApi.ts`
- Test: `src/domains/finances/billsApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `Bill` from `../shared/types`
- Produces: `listBills(uid: string): Promise<Bill[]>`, `saveBill(uid: string, bill: Bill): Promise<void>`, `isBillDueToday(bill: Bill, dayOfMonth: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domains/finances/billsApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bill } from '../shared/types';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listBills, saveBill, isBillDueToday } from './billsApi';

describe('isBillDueToday', () => {
  it('is due when the bill\'s dueDay matches the given day of month', () => {
    const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' };
    expect(isBillDueToday(bill, 1)).toBe(true);
  });

  it('is not due when the days differ', () => {
    const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' };
    expect(isBillDueToday(bill, 15)).toBe(false);
  });
});

describe('billsApi CRUD', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
  });

  it('listBills maps docs to Bill objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' }) }],
    });
    const result = await listBills('user1');
    expect(result).toEqual([{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' }]);
  });

  it('saveBill writes the bill fields', async () => {
    const bill: Bill = { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' };
    await saveBill('user1', bill);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Rent',
      amount: 1200,
      dueDay: 1,
      category: 'Housing',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/finances/billsApi.test.ts`
Expected: FAIL with "Cannot find module './billsApi'"

- [ ] **Step 3: Implement billsApi**

Create `src/domains/finances/billsApi.ts`:

```ts
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Bill } from '../shared/types';

export async function listBills(uid: string): Promise<Bill[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'bills'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bill, 'id'>) }));
}

export async function saveBill(uid: string, bill: Bill): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'bills', bill.id), {
    name: bill.name,
    amount: bill.amount,
    dueDay: bill.dueDay,
    category: bill.category,
  });
}

export function isBillDueToday(bill: Bill, dayOfMonth: number): boolean {
  return bill.dueDay === dayOfMonth;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/finances/billsApi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/finances/billsApi.ts src/domains/finances/billsApi.test.ts
git commit -m "feat: add bills Firestore API and due-today check"
```

---

### Task 5: FinancesScreen

**Files:**
- Create: `src/domains/finances/FinancesScreen.tsx`
- Test: `src/domains/finances/FinancesScreen.test.tsx`

**Interfaces:**
- Consumes: `addTransaction`, `listTransactionsForMonth` from `./transactionsApi`; `listBudgets`, `saveBudget` from `./budgetsApi`; `listBills`, `saveBill`, `isBillDueToday` from `./billsApi`; `computeCategorySpend`, `computeBudgetPercent` from `./financeLogic`; `Transaction`, `Budget`, `Bill` from `../shared/types`; `todayId` from `../shared/dateUtils`
- Produces: `<FinancesScreen uid: string />`

- [ ] **Step 1: Write the failing tests (three rounds in one file — transactions, budgets, bills)**

Create `src/domains/finances/FinancesScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockListTransactions = vi.fn();
const mockAddTransaction = vi.fn().mockResolvedValue('tx1');
const mockListBudgets = vi.fn();
const mockSaveBudget = vi.fn().mockResolvedValue(undefined);
const mockListBills = vi.fn();
const mockSaveBill = vi.fn().mockResolvedValue(undefined);

vi.mock('./transactionsApi', () => ({
  listTransactionsForMonth: (...args: [string, string]) => mockListTransactions(...args),
  addTransaction: (...args: [string, unknown]) => mockAddTransaction(...args),
}));
vi.mock('./budgetsApi', () => ({
  listBudgets: (...args: [string]) => mockListBudgets(...args),
  saveBudget: (...args: [string, unknown]) => mockSaveBudget(...args),
}));
vi.mock('./billsApi', async () => {
  const actual = await vi.importActual<typeof import('./billsApi')>('./billsApi');
  return {
    ...actual,
    listBills: (...args: [string]) => mockListBills(...args),
    saveBill: (...args: [string, unknown]) => mockSaveBill(...args),
  };
});

import { FinancesScreen } from './FinancesScreen';

describe('FinancesScreen', () => {
  beforeEach(() => {
    mockListTransactions.mockReset();
    mockAddTransaction.mockClear();
    mockListBudgets.mockReset();
    mockSaveBudget.mockClear();
    mockListBills.mockReset();
    mockSaveBill.mockClear();
  });

  it('adds a transaction', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBudgets.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);

    render(<FinancesScreen uid="user1" />);
    await waitFor(() => expect(mockListTransactions).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Amount'), '42.5');
    await user.type(screen.getByPlaceholderText('Category'), 'Groceries');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockAddTransaction).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ amount: 42.5, category: 'Groceries', type: 'expense' })
    );
  });

  it('renders a budget bar showing spend against the limit', async () => {
    mockListTransactions.mockResolvedValue([
      { id: 't1', date: '2026-07-20', amount: 50, category: 'Groceries', type: 'expense' },
    ]);
    mockListBudgets.mockResolvedValue([{ category: 'Groceries', monthlyLimit: 200 }]);
    mockListBills.mockResolvedValue([]);

    render(<FinancesScreen uid="user1" />);

    await waitFor(() => expect(screen.getByText('$50.00 / $200.00')).toBeInTheDocument());
  });

  it('flags a bill as due today', async () => {
    mockListTransactions.mockResolvedValue([]);
    mockListBudgets.mockResolvedValue([]);
    mockListBills.mockResolvedValue([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate(), category: 'Housing' },
    ]);

    render(<FinancesScreen uid="user1" />);

    await waitFor(() => expect(screen.getByText('Due today')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/finances/FinancesScreen.test.tsx`
Expected: FAIL with "Cannot find module './FinancesScreen'"

- [ ] **Step 3: Implement FinancesScreen**

Create `src/domains/finances/FinancesScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { addTransaction, listTransactionsForMonth } from './transactionsApi';
import { listBudgets, saveBudget } from './budgetsApi';
import { listBills, saveBill, isBillDueToday } from './billsApi';
import { computeCategorySpend, computeBudgetPercent } from './financeLogic';
import { Transaction, Budget, Bill } from '../shared/types';
import { todayId, dayOfMonth } from '../shared/dateUtils';

function currentMonth(): string {
  return todayId().slice(0, 7);
}

export function FinancesScreen({ uid }: { uid: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  const dayOfMonthNow = dayOfMonth(todayId());

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Finances</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add transaction</h2>
        <form onSubmit={handleAddTransaction} className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border rounded px-3 py-2 w-28"
          />
          <input
            type="text"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'expense' | 'income')}
            className="border rounded px-3 py-2"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add
          </button>
        </form>
        <ul className="flex flex-col gap-1">
          {transactions.map((t) => (
            <li key={t.id} className="text-sm">
              {t.date} — {t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)} ({t.category})
              {t.note ? ` — ${t.note}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Budgets</h2>
        <ul className="flex flex-col gap-2">
          {budgets.map((b) => {
            const spend = computeCategorySpend(transactions, b.category);
            const percent = computeBudgetPercent(spend, b.monthlyLimit);
            return (
              <li key={b.category}>
                <div className="flex justify-between text-sm">
                  <span>{b.category}</span>
                  <span>
                    ${spend.toFixed(2)} / ${b.monthlyLimit.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded h-2">
                  <div
                    className={`h-2 rounded ${percent >= 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleSetBudget} className="flex gap-2">
          <input
            type="text"
            placeholder="Category"
            value={budgetCategory}
            onChange={(e) => setBudgetCategory(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Monthly limit"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(e.target.value)}
            className="border rounded px-3 py-2 w-32"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Set budget
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Bills</h2>
        <ul className="flex flex-col gap-1">
          {bills.map((bill) => (
            <li key={bill.id} className="text-sm flex items-center gap-2">
              <span>
                {bill.name} — ${bill.amount.toFixed(2)} (due day {bill.dueDay})
              </span>
              {isBillDueToday(bill, dayOfMonthNow) && (
                <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">Due today</span>
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
            className="border rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Amount"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            className="border rounded px-3 py-2 w-28"
          />
          <input
            type="number"
            placeholder="Due day (1-31)"
            value={billDueDay}
            onChange={(e) => setBillDueDay(e.target.value)}
            className="border rounded px-3 py-2 w-32"
          />
          <input
            type="text"
            placeholder="Category"
            value={billCategory}
            onChange={(e) => setBillCategory(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add bill
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/finances/FinancesScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, and `grep -c "not wrapped in act\|Warning:"` against the captured output is `0`

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/finances/FinancesScreen.tsx src/domains/finances/FinancesScreen.test.tsx
git commit -m "feat: add FinancesScreen with transactions, budgets, and bills"
```

---

### Task 6: Grocery API

**Files:**
- Create: `src/domains/meals/groceryApi.ts`
- Test: `src/domains/meals/groceryApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `GroceryItem` from `../shared/types`
- Produces: `listGroceryItems(uid: string): Promise<GroceryItem[]>`, `addGroceryItem(uid: string, name: string): Promise<string>`, `setGroceryItemChecked(uid: string, itemId: string, checked: boolean): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/domains/meals/groceryApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listGroceryItems, addGroceryItem, setGroceryItemChecked } from './groceryApi';

describe('groceryApi', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockAddDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('listGroceryItems maps docs to GroceryItem objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ name: 'Milk', checked: false }) }],
    });
    const result = await listGroceryItems('user1');
    expect(result).toEqual([{ id: 'g1', name: 'Milk', checked: false }]);
  });

  it('addGroceryItem writes an unchecked item and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'g1' });
    const id = await addGroceryItem('user1', 'Milk');
    expect(id).toBe('g1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Milk', checked: false });
  });

  it('setGroceryItemChecked merges the checked flag', async () => {
    await setGroceryItemChecked('user1', 'g1', true);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { checked: true }, { merge: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/meals/groceryApi.test.ts`
Expected: FAIL with "Cannot find module './groceryApi'"

- [ ] **Step 3: Implement groceryApi**

Create `src/domains/meals/groceryApi.ts`:

```ts
import { collection, doc, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { GroceryItem } from '../shared/types';

export async function listGroceryItems(uid: string): Promise<GroceryItem[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'groceryItems'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroceryItem, 'id'>) }));
}

export async function addGroceryItem(uid: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'groceryItems'), { name, checked: false });
  return ref.id;
}

export async function setGroceryItemChecked(uid: string, itemId: string, checked: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'groceryItems', itemId), { checked }, { merge: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/meals/groceryApi.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/meals/groceryApi.ts src/domains/meals/groceryApi.test.ts
git commit -m "feat: add grocery list Firestore API"
```

---

### Task 7: Meal log API

**Files:**
- Create: `src/domains/meals/mealLogApi.ts`
- Test: `src/domains/meals/mealLogApi.test.ts`

**Interfaces:**
- Consumes: `db` from `../../firebase/config`; `MealLog` from `../shared/types`; `todayId` from `../shared/dateUtils`
- Produces: `getMealLog(uid: string, date?: string): Promise<MealLog>`, `addMealEntry(uid: string, entry: string, date?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/domains/meals/mealLogApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { getMealLog, addMealEntry } from './mealLogApi';

describe('mealLogApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns an empty entries list when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: [] });
  });

  it('defaults entries to an empty array when the doc exists but has no entries field', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ date: '2026-07-20' }) });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: [] });
  });

  it('returns the stored entries when present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ date: '2026-07-20', entries: ['Oatmeal'] }),
    });
    const result = await getMealLog('user1', '2026-07-20');
    expect(result).toEqual({ date: '2026-07-20', entries: ['Oatmeal'] });
  });

  it('addMealEntry appends to the existing entries and writes the full list', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ date: '2026-07-20', entries: ['Oatmeal'] }),
    });
    await addMealEntry('user1', 'Salad', '2026-07-20');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
      date: '2026-07-20',
      entries: ['Oatmeal', 'Salad'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/meals/mealLogApi.test.ts`
Expected: FAIL with "Cannot find module './mealLogApi'"

- [ ] **Step 3: Implement mealLogApi**

Create `src/domains/meals/mealLogApi.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MealLog } from '../shared/types';
import { todayId } from '../shared/dateUtils';

export function mealLogDocRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'mealLog', date);
}

export async function getMealLog(uid: string, date: string = todayId()): Promise<MealLog> {
  const snap = await getDoc(mealLogDocRef(uid, date));
  const data = snap.exists() ? (snap.data() as Partial<MealLog>) : {};
  return { date, entries: data.entries ?? [] };
}

export async function addMealEntry(uid: string, entry: string, date: string = todayId()): Promise<void> {
  const current = await getMealLog(uid, date);
  await setDoc(mealLogDocRef(uid, date), { date, entries: [...current.entries, entry] });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/meals/mealLogApi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domains/meals/mealLogApi.ts src/domains/meals/mealLogApi.test.ts
git commit -m "feat: add meal log Firestore API"
```

---

### Task 8: MealsScreen

**Files:**
- Create: `src/domains/meals/MealsScreen.tsx`
- Test: `src/domains/meals/MealsScreen.test.tsx`

**Interfaces:**
- Consumes: `listGroceryItems`, `addGroceryItem`, `setGroceryItemChecked` from `./groceryApi`; `getMealLog`, `addMealEntry` from `./mealLogApi`; `GroceryItem`, `MealLog` from `../shared/types`
- Produces: `<MealsScreen uid: string />`

- [ ] **Step 1: Write the failing tests (two rounds — groceries, meal log)**

Create `src/domains/meals/MealsScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockListItems = vi.fn();
const mockAddItem = vi.fn().mockResolvedValue('g1');
const mockSetItemChecked = vi.fn().mockResolvedValue(undefined);
const mockGetMealLog = vi.fn();
const mockAddMealEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('./groceryApi', () => ({
  listGroceryItems: (...args: [string]) => mockListItems(...args),
  addGroceryItem: (...args: [string, string]) => mockAddItem(...args),
  setGroceryItemChecked: (...args: [string, string, boolean]) => mockSetItemChecked(...args),
}));
vi.mock('./mealLogApi', () => ({
  getMealLog: (...args: [string]) => mockGetMealLog(...args),
  addMealEntry: (...args: [string, string]) => mockAddMealEntry(...args),
}));

import { MealsScreen } from './MealsScreen';

describe('MealsScreen', () => {
  beforeEach(() => {
    mockListItems.mockReset();
    mockAddItem.mockClear();
    mockSetItemChecked.mockClear();
    mockGetMealLog.mockReset();
    mockAddMealEntry.mockClear();
  });

  it('lists grocery items and lets you check one off', async () => {
    mockListItems.mockResolvedValue([{ id: 'g1', name: 'Milk', checked: false }]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    render(<MealsScreen uid="user1" />);
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Milk' }));

    expect(mockSetItemChecked).toHaveBeenCalledWith('user1', 'g1', true);
  });

  it('adds a new grocery item', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    render(<MealsScreen uid="user1" />);
    await waitFor(() => expect(mockListItems).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('New grocery item'), 'Eggs');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(mockAddItem).toHaveBeenCalledWith('user1', 'Eggs');
  });

  it('adds a meal log entry', async () => {
    mockListItems.mockResolvedValue([]);
    mockGetMealLog.mockResolvedValue({ date: '2026-07-20', entries: [] });

    render(<MealsScreen uid="user1" />);
    await waitFor(() => expect(mockGetMealLog).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('What did you eat?'), 'Oatmeal');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(mockAddMealEntry).toHaveBeenCalledWith('user1', 'Oatmeal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/meals/MealsScreen.test.tsx`
Expected: FAIL with "Cannot find module './MealsScreen'"

- [ ] **Step 3: Implement MealsScreen**

Create `src/domains/meals/MealsScreen.tsx`:

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { listGroceryItems, addGroceryItem, setGroceryItemChecked } from './groceryApi';
import { getMealLog, addMealEntry } from './mealLogApi';
import { GroceryItem, MealLog } from '../shared/types';

export function MealsScreen({ uid }: { uid: string }) {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [mealLog, setMealLog] = useState<MealLog | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newMealEntry, setNewMealEntry] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    };
    listGroceryItems(uid).then(setGroceryItems).catch(handleError);
    getMealLog(uid).then(setMealLog).catch(handleError);
  }, [uid]);

  async function handleToggleItem(itemId: string, checked: boolean) {
    await setGroceryItemChecked(uid, itemId, checked);
    setGroceryItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, checked } : item)));
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const id = await addGroceryItem(uid, newItemName.trim());
    setGroceryItems((prev) => [...prev, { id, name: newItemName.trim(), checked: false }]);
    setNewItemName('');
  }

  async function handleAddMealEntry(e: FormEvent) {
    e.preventDefault();
    const trimmed = newMealEntry.trim();
    if (!trimmed) return;
    await addMealEntry(uid, trimmed);
    setMealLog((prev) => (prev ? { ...prev, entries: [...prev.entries, trimmed] } : prev));
    setNewMealEntry('');
  }

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Meals &amp; Groceries</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Grocery list</h2>
        <ul className="flex flex-col gap-2">
          {groceryItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={item.name}
                checked={item.checked}
                onChange={(e) => handleToggleItem(item.id, e.target.checked)}
              />
              <span className={item.checked ? 'line-through text-gray-400' : ''}>{item.name}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            type="text"
            placeholder="New grocery item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add item
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Today's meals</h2>
        <ul className="flex flex-col gap-1">
          {mealLog?.entries.map((entry, i) => (
            <li key={i} className="text-sm">
              {entry}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddMealEntry} className="flex gap-2">
          <input
            type="text"
            placeholder="What did you eat?"
            value={newMealEntry}
            onChange={(e) => setNewMealEntry(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
            Add entry
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/meals/MealsScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, and `grep -c "not wrapped in act\|Warning:"` against the captured output is `0`

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/meals/MealsScreen.tsx src/domains/meals/MealsScreen.test.tsx
git commit -m "feat: add MealsScreen with grocery checklist and meal log"
```

---

### Task 9: Extend dashboard pure logic with bill and grocery due-items

**Files:**
- Modify: `src/dashboard/dashboardLogic.ts`
- Modify: `src/dashboard/dashboardLogic.test.ts`

**Interfaces:**
- Consumes: `isBillDueToday` from `../domains/finances/billsApi`; `Bill`, `GroceryItem`, `DueItem` from `../domains/shared/types`
- Produces: `computeBillDueItems(bills: Bill[], dayOfMonth: number): DueItem[]`, `computeGroceryDueItem(groceryItems: GroceryItem[]): DueItem[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/dashboard/dashboardLogic.test.ts` (add these two new `describe` blocks, and add `Bill, GroceryItem` to the existing type import from `'../domains/shared/types'`):

```ts
describe('computeBillDueItems', () => {
  it('lists bills due today by dueDay match', () => {
    const bills: Bill[] = [
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' },
      { id: 'b2', name: 'Internet', amount: 60, dueDay: 15, category: 'Utilities' },
    ];
    expect(computeBillDueItems(bills, 1)).toEqual([{ id: 'b1', label: 'Rent due', domain: 'finances' }]);
  });

  it('returns an empty array when no bills are due', () => {
    const bills: Bill[] = [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: 1, category: 'Housing' }];
    expect(computeBillDueItems(bills, 10)).toEqual([]);
  });
});

describe('computeGroceryDueItem', () => {
  it('returns one summary item with the unchecked count when items are pending', () => {
    const items: GroceryItem[] = [
      { id: 'g1', name: 'Milk', checked: false },
      { id: 'g2', name: 'Eggs', checked: true },
      { id: 'g3', name: 'Bread', checked: false },
    ];
    expect(computeGroceryDueItem(items)).toEqual([
      { id: 'groceries-needed', label: '2 grocery items needed', domain: 'meals' },
    ]);
  });

  it('uses singular phrasing for exactly one pending item', () => {
    const items: GroceryItem[] = [{ id: 'g1', name: 'Milk', checked: false }];
    expect(computeGroceryDueItem(items)).toEqual([
      { id: 'groceries-needed', label: '1 grocery item needed', domain: 'meals' },
    ]);
  });

  it('returns an empty array when everything is checked off', () => {
    const items: GroceryItem[] = [{ id: 'g1', name: 'Milk', checked: true }];
    expect(computeGroceryDueItem(items)).toEqual([]);
  });
});
```

Update the import line at the top of `src/dashboard/dashboardLogic.test.ts`:

```ts
import { computeStreak, computeDueItems, computeDayHealth, computeBillDueItems, computeGroceryDueItem } from './dashboardLogic';
import { ChoreConfig, DailyCompletion, Bill, GroceryItem } from '../domains/shared/types';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: FAIL — `computeBillDueItems`/`computeGroceryDueItem` are not exported yet

- [ ] **Step 3: Implement the two new functions**

Update the top of `src/dashboard/dashboardLogic.ts` — change the import line:

```ts
import { ChoreConfig, DailyCompletion, DueItem, Bill, GroceryItem } from '../domains/shared/types';
import { isChoreDueToday } from '../domains/chores/choresApi';
import { isBillDueToday } from '../domains/finances/billsApi';
```

Append to the end of `src/dashboard/dashboardLogic.ts`:

```ts
export function computeBillDueItems(bills: Bill[], dayOfMonth: number): DueItem[] {
  return bills
    .filter((b) => isBillDueToday(b, dayOfMonth))
    .map((b) => ({ id: b.id, label: `${b.name} due`, domain: 'finances' as const }));
}

export function computeGroceryDueItem(groceryItems: GroceryItem[]): DueItem[] {
  const uncheckedCount = groceryItems.filter((item) => !item.checked).length;
  if (uncheckedCount === 0) return [];
  const noun = uncheckedCount === 1 ? 'item' : 'items';
  return [
    {
      id: 'groceries-needed',
      label: `${uncheckedCount} grocery ${noun} needed`,
      domain: 'meals' as const,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dashboard/dashboardLogic.test.ts`
Expected: PASS (11 tests: 5 existing + 6 new)

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/dashboardLogic.ts src/dashboard/dashboardLogic.test.ts
git commit -m "feat: add bill-due and grocery-needed due-item calculations"
```

---

### Task 10: Extend useDashboardData with bills and groceries

**Files:**
- Modify: `src/dashboard/useDashboardData.ts`
- Modify: `src/dashboard/useDashboardData.test.ts`

**Interfaces:**
- Consumes: `listBills` from `../domains/finances/billsApi`; `listGroceryItems` from `../domains/meals/groceryApi`; `computeBillDueItems`, `computeGroceryDueItem` from `./dashboardLogic`; `dayOfMonth` from `../domains/shared/dateUtils`; `Bill`, `GroceryItem` from `../domains/shared/types`
- Produces: `DashboardData` extended with `bills: Bill[]` and `groceryItems: GroceryItem[]`; `dueItems` now also includes bill-due and grocery-needed items

- [ ] **Step 1: Write the failing test**

Read the current `src/dashboard/useDashboardData.test.ts` first — it mocks `../domains/shared/completionsApi` and `../domains/chores/choresApi`. Add two more `vi.mock` calls and extend the existing test's mock resolutions and assertions. Replace the full file with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetCompletion = vi.fn();
const mockListRecentCompletions = vi.fn();
const mockListChores = vi.fn();
const mockListBills = vi.fn();
const mockListGroceryItems = vi.fn();

vi.mock('../domains/shared/completionsApi', () => ({
  getCompletion: (...args: [string]) => mockGetCompletion(...args),
  listRecentCompletions: (...args: [string, number]) => mockListRecentCompletions(...args),
}));
vi.mock('../domains/chores/choresApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/chores/choresApi')>(
    '../domains/chores/choresApi'
  );
  return { ...actual, listChores: (...args: [string]) => mockListChores(...args) };
});
vi.mock('../domains/finances/billsApi', async () => {
  const actual = await vi.importActual<typeof import('../domains/finances/billsApi')>(
    '../domains/finances/billsApi'
  );
  return { ...actual, listBills: (...args: [string]) => mockListBills(...args) };
});
vi.mock('../domains/meals/groceryApi', () => ({
  listGroceryItems: (...args: [string]) => mockListGroceryItems(...args),
}));

import { useDashboardData } from './useDashboardData';

describe('useDashboardData', () => {
  beforeEach(() => {
    mockGetCompletion.mockReset();
    mockListRecentCompletions.mockReset();
    mockListChores.mockReset();
    mockListBills.mockReset();
    mockListGroceryItems.mockReset();
  });

  it('loads completion, history, chores, bills, and groceries, then computes streak, due items, and day health', async () => {
    mockGetCompletion.mockResolvedValue({
      date: '2026-07-20',
      workout: true,
      learning: true,
      chores: { c1: true },
    });
    mockListRecentCompletions.mockResolvedValue([
      { date: '2026-07-20', workout: true, learning: true, chores: { c1: true } },
      { date: '2026-07-19', workout: true, learning: true, chores: {} },
      { date: '2026-07-18', workout: false, learning: true, chores: {} },
    ]);
    mockListChores.mockResolvedValue([
      { id: 'c1', name: 'Dishes', cadence: 'daily' },
      { id: 'c2', name: 'Laundry', cadence: 'daily' },
    ]);
    mockListBills.mockResolvedValue([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 20, category: 'Housing' },
    ]);
    mockListGroceryItems.mockResolvedValue([{ id: 'g1', name: 'Milk', checked: false }]);

    const { result } = renderHook(() => useDashboardData('user1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListBills).toHaveBeenCalledWith('user1');
    expect(mockListGroceryItems).toHaveBeenCalledWith('user1');
    expect(result.current.bills).toEqual([
      { id: 'b1', name: 'Rent', amount: 1200, dueDay: 20, category: 'Housing' },
    ]);
    expect(result.current.groceryItems).toEqual([{ id: 'g1', name: 'Milk', checked: false }]);
    expect(result.current.streak).toBe(2);
    expect(result.current.dueItems).toEqual(
      expect.arrayContaining([
        { id: 'c2', label: 'Laundry', domain: 'chores' },
        { id: 'groceries-needed', label: '1 grocery item needed', domain: 'meals' },
      ])
    );
    expect(result.current.dayHealth).toBe(75);
  });

  it('sets an error and clears loading when a read fails', async () => {
    mockGetCompletion.mockRejectedValue(new Error('offline'));
    mockListRecentCompletions.mockResolvedValue([]);
    mockListChores.mockResolvedValue([]);
    mockListBills.mockResolvedValue([]);
    mockListGroceryItems.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardData('user1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('offline');
  });
});
```

Note: `mockListBills.mockResolvedValue([...{ dueDay: 20 }])` is deliberately set to `20` — this test asserts on `dueItems` via `expect.arrayContaining`, not exact-match, so it doesn't need to know today's real day-of-month to avoid a bill-due assertion; the Rent bill exists only to prove `bills` round-trips correctly, not to assert it's due.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: FAIL — `result.current.bills` is `undefined` (not yet returned by the hook)

- [ ] **Step 3: Implement the extension**

Replace `src/dashboard/useDashboardData.ts` in full:

```ts
import { useEffect, useState } from 'react';
import { getCompletion, listRecentCompletions } from '../domains/shared/completionsApi';
import { listChores, isChoreDueToday } from '../domains/chores/choresApi';
import { listBills } from '../domains/finances/billsApi';
import { listGroceryItems } from '../domains/meals/groceryApi';
import {
  ChoreConfig,
  DailyCompletion,
  DueItem,
  Bill,
  GroceryItem,
} from '../domains/shared/types';
import { todayId, dayOfWeek, dayOfMonth } from '../domains/shared/dateUtils';
import {
  computeStreak,
  computeDueItems,
  computeDayHealth,
  computeBillDueItems,
  computeGroceryDueItem,
} from './dashboardLogic';

const STREAK_HISTORY_DAYS = 30;

export interface DashboardData {
  loading: boolean;
  error: string | null;
  completion: DailyCompletion | null;
  chores: ChoreConfig[];
  bills: Bill[];
  groceryItems: GroceryItem[];
  dueItems: DueItem[];
  dueTodayChoreIds: string[];
  streak: number;
  dayHealth: number;
}

export function useDashboardData(uid: string): DashboardData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [history, setHistory] = useState<DailyCompletion[]>([]);
  const [chores, setChores] = useState<ChoreConfig[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);

  useEffect(() => {
    Promise.all([
      getCompletion(uid),
      listRecentCompletions(uid, STREAK_HISTORY_DAYS),
      listChores(uid),
      listBills(uid),
      listGroceryItems(uid),
    ])
      .then(([todayCompletion, recentHistory, choreList, billList, groceryList]) => {
        setCompletion(todayCompletion);
        setHistory(recentHistory);
        setChores(choreList);
        setBills(billList);
        setGroceryItems(groceryList);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      });
  }, [uid]);

  if (!completion) {
    return {
      loading,
      error,
      completion: null,
      chores: [],
      bills: [],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 0,
      dayHealth: 0,
    };
  }

  const dow = dayOfWeek(todayId());
  const domNow = dayOfMonth(todayId());
  const dueItems = [
    ...computeDueItems(chores, completion, dow),
    ...computeBillDueItems(bills, domNow),
    ...computeGroceryDueItem(groceryItems),
  ];
  const dueTodayChoreIds = chores.filter((c) => isChoreDueToday(c, dow)).map((c) => c.id);
  const streak = computeStreak(history);
  const dayHealth = computeDayHealth(completion, dueTodayChoreIds);

  return {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    dueItems,
    dueTodayChoreIds,
    streak,
    dayHealth,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dashboard/useDashboardData.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/useDashboardData.ts src/dashboard/useDashboardData.test.ts
git commit -m "feat: fetch bills and groceries into dashboard data and due items"
```

---

### Task 11: Add Finances and Meals chips to the Dashboard

**Files:**
- Modify: `src/dashboard/Dashboard.tsx`
- Modify: `src/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `bills`, `groceryItems` from `useDashboardData`'s return value; `isBillDueToday` from `../domains/finances/billsApi`; `dayOfMonth` from `../domains/shared/dateUtils`
- Produces: Dashboard renders 5 chips total (Workout, Learning, Chores, Finances, Meals)

- [ ] **Step 1: Write the failing test**

Read the current `src/dashboard/Dashboard.test.tsx` first — it uses a mutable `mockUseDashboardData` function (set per-test via `mockReturnValue`), not a static factory, and already has working tests for the error path and the chores-denominator behavior from Phase 1. Preserve every existing test; add `bills: []` and `groceryItems: []` to each existing `mockReturnValue(...)` call (the `DashboardData` shape now requires them), and add the new tests below. Replace the file in full:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseDashboardData = vi.fn();
vi.mock('./useDashboardData', () => ({
  useDashboardData: () => mockUseDashboardData(),
}));

import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders the streak, day health, chips, and due-now strip', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      dueItems: [{ id: 'c1', label: 'Laundry', domain: 'chores' }],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Chores')).toBeInTheDocument();
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText('Meals')).toBeInTheDocument();
    expect(screen.getByText('Laundry')).toBeInTheDocument();
  });

  it('navigates when a chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Workout'));
    expect(onNavigate).toHaveBeenCalledWith('/workout');
  });

  it('navigates to /finances when the Finances chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Finances'));
    expect(onNavigate).toHaveBeenCalledWith('/finances');
  });

  it('navigates to /meals when the Meals chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Meals'));
    expect(onNavigate).toHaveBeenCalledWith('/meals');
  });

  it('shows the Finances chip as in-progress with a due-bill count when a bill is due today', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate(), category: 'Housing' }],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1 bill(s) due')).toBeInTheDocument();
  });

  it('shows the Finances chip as done with no bills due when nothing is due today', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate() === 1 ? 2 : 1, category: 'Housing' }],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('No bills due')).toBeInTheDocument();
  });

  it('shows the Meals chip with the unchecked grocery count', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [
        { id: 'g1', name: 'Milk', checked: false },
        { id: 'g2', name: 'Eggs', checked: true },
      ],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1 to buy')).toBeInTheDocument();
  });

  it('shows an error message instead of hanging when data fails to load', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: 'permission denied',
      completion: null,
      chores: [],
      bills: [],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 0,
      dayHealth: 0,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('Something went wrong: permission denied')).toBeInTheDocument();
  });

  it('computes the Chores chip denominator using only chores due today', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: {
        date: '2026-07-20',
        workout: true,
        learning: true,
        chores: { c1: true, c2: true },
      },
      chores: [
        { id: 'c1', name: 'Dishes', cadence: 'daily' },
        { id: 'c2', name: 'Weekly report', cadence: 'weekly', weeklyDays: [1] },
      ],
      bills: [],
      groceryItems: [],
      dueItems: [],
      dueTodayChoreIds: ['c1'],
      streak: 3,
      dayHealth: 100,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/Dashboard.test.tsx`
Expected: FAIL — no "Finances" or "Meals" text found in the rendered output

- [ ] **Step 3: Implement the extension**

Replace `src/dashboard/Dashboard.tsx` in full:

```tsx
import { useDashboardData } from './useDashboardData';
import { StatusChip } from '../components/StatusChip';
import { DueNowStrip } from './DueNowStrip';
import { isBillDueToday } from '../domains/finances/billsApi';
import { todayId, dayOfMonth } from '../domains/shared/dateUtils';

export function Dashboard({ uid, onNavigate }: { uid: string; onNavigate: (path: string) => void }) {
  const {
    loading,
    error,
    completion,
    chores,
    bills,
    groceryItems,
    dueItems,
    dueTodayChoreIds,
    streak,
    dayHealth,
  } = useDashboardData(uid);

  if (error) {
    return <p className="p-6">Something went wrong: {error}</p>;
  }

  if (loading || !completion) {
    return <p className="p-6">Loading...</p>;
  }

  const dueTodayChores = chores.filter((c) => dueTodayChoreIds.includes(c.id));
  const choresDoneCount = dueTodayChores.filter((c) => completion.chores[c.id]).length;

  const domNow = dayOfMonth(todayId());
  const billsDueToday = bills.filter((b) => isBillDueToday(b, domNow));
  const uncheckedGroceryCount = groceryItems.filter((item) => !item.checked).length;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <p className="text-sm text-gray-500">{completion.date}</p>
        <p className="text-3xl font-bold">Streak: {streak}</p>
        <p className="text-lg">{dayHealth}% of today done</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <StatusChip
          label="Workout"
          status={completion.workout ? 'done' : 'not-started'}
          onClick={() => onNavigate('/workout')}
        />
        <StatusChip
          label="Learning"
          status={completion.learning ? 'done' : 'not-started'}
          onClick={() => onNavigate('/learning')}
        />
        <StatusChip
          label="Chores"
          status={
            dueTodayChores.length === 0
              ? 'not-started'
              : choresDoneCount === dueTodayChores.length
                ? 'done'
                : 'in-progress'
          }
          detail={`${choresDoneCount}/${dueTodayChores.length}`}
          onClick={() => onNavigate('/chores')}
        />
        <StatusChip
          label="Finances"
          status={billsDueToday.length > 0 ? 'in-progress' : 'done'}
          detail={billsDueToday.length > 0 ? `${billsDueToday.length} bill(s) due` : 'No bills due'}
          onClick={() => onNavigate('/finances')}
        />
        <StatusChip
          label="Meals"
          status={uncheckedGroceryCount > 0 ? 'in-progress' : 'done'}
          detail={`${uncheckedGroceryCount} to buy`}
          onClick={() => onNavigate('/meals')}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Due now</h2>
        <DueNowStrip items={dueItems} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dashboard/Dashboard.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, and `grep -c "not wrapped in act\|Warning:"` against the captured output is `0`

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/Dashboard.tsx src/dashboard/Dashboard.test.tsx
git commit -m "feat: add Finances and Meals status chips to the Dashboard"
```

---

### Task 12: Wire /finances and /meals routes into App shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `FinancesScreen` from `./domains/finances/FinancesScreen`; `MealsScreen` from `./domains/meals/MealsScreen`
- Produces: routes `/finances` and `/meals` added to `AuthedRoutes`

- [ ] **Step 1: Write the failing test**

Replace `src/App.test.tsx` in full (this preserves every existing Phase 1 test — loading state, Login screen, Dashboard render, sign-out — and adds a `beforeEach` that resets the URL to `/` so the two new route tests below can't leak their pushed URL into any other test regardless of run order):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseAuth = vi.fn();
const mockSignOutUser = vi.fn();
vi.mock('./auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  signOutUser: (...args: unknown[]) => mockSignOutUser(...args),
}));
vi.mock('./auth/Login', () => ({ Login: () => <div>Login screen</div> }));
vi.mock('./dashboard/Dashboard', () => ({
  Dashboard: ({ uid }: { uid: string }) => <div>Dashboard for {uid}</div>,
}));
vi.mock('./domains/finances/FinancesScreen', () => ({
  FinancesScreen: ({ uid }: { uid: string }) => <div>Finances for {uid}</div>,
}));
vi.mock('./domains/meals/MealsScreen', () => ({
  MealsScreen: ({ uid }: { uid: string }) => <div>Meals for {uid}</div>,
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));

import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('shows a loading state while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the Login screen when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('shows the Dashboard when signed in', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    render(<App />);
    expect(screen.getByText('Dashboard for user1')).toBeInTheDocument();
  });

  it('signs out when the Sign out button is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockSignOutUser).toHaveBeenCalled();
  });

  it('renders FinancesScreen at /finances', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/finances');
    render(<App />);
    expect(screen.getByText('Finances for user1')).toBeInTheDocument();
  });

  it('renders MealsScreen at /meals', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/meals');
    render(<App />);
    expect(screen.getByText('Meals for user1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no route matches `/finances` or `/meals`, so `Navigate to="/"` fires instead and the mocked screen text is never rendered

- [ ] **Step 3: Implement the route additions**

In `src/App.tsx`, add two imports alongside the existing domain-screen imports:

```tsx
import { FinancesScreen } from './domains/finances/FinancesScreen';
import { MealsScreen } from './domains/meals/MealsScreen';
```

In the `<Routes>` block inside `AuthedRoutes`, add two routes alongside the existing `/workout`, `/learning`, `/chores` routes (before the catch-all `*` route):

```tsx
<Route path="/finances" element={<FinancesScreen uid={uid} />} />
<Route path="/meals" element={<MealsScreen uid={uid} />} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (all App tests, including the 2 new ones)

- [ ] **Step 5: Run the full suite and confirm zero warnings**

Run: `npm test`
Expected: PASS, and `grep -c "not wrapped in act\|Warning:"` against the captured output is `0`

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire /finances and /meals routes into the app shell"
```

---

### Task 13: Manual smoke test against a live Firebase project

**Files:** none (verification-only task)

**Interfaces:** none — this task exercises the Finances and Meals domains built in Tasks 1-12 against a real Firebase project (the same one used for Phase 1's smoke test).

- [ ] **Step 1: Run the app locally**

```bash
npm run dev
```

Reuse the `.env` file already configured for Phase 1's smoke test (same Firebase project). No new Firebase console setup is required — Firestore, Auth, and Hosting are already enabled from Phase 1.

- [ ] **Step 2: Manually verify the golden path in a browser**

Sign in with the account created during Phase 1's smoke test (or create a new one), then confirm:

1. The Dashboard now shows 5 chips: Workout, Learning, Chores, Finances, Meals.
2. Click the Finances chip → navigates to `/finances`. Add a transaction (amount, category, expense). Confirm it appears in the list.
3. Set a budget for the same category (e.g. limit `100`). Confirm a budget bar appears showing the transaction's amount against the limit.
4. Add a bill with today's day-of-month as the due day. Confirm it shows a "Due today" badge.
5. Go back to `/` — confirm the Finances chip now shows "1 bill(s) due" and the due-now strip lists `"<bill name> due"`.
6. Click the Meals chip → navigates to `/meals`. Add a grocery item. Confirm it appears, unchecked.
7. Add a "what did you eat" entry. Confirm it appears in the meal log list.
8. Go back to `/` — confirm the Meals chip shows "1 to buy" and the due-now strip lists a "1 grocery item needed" entry.
9. Check off the grocery item on `/meals`, go back to `/` — confirm the Meals chip now shows "0 to buy" and the grocery due-now item disappears.
10. Refresh the page — confirm all Finances/Meals data persisted (Firestore-backed).

- [ ] **Step 3: Record the result**

If any step in Step 2 fails, treat it as a bug to fix (write a regression test first, following the same TDD pattern as the rest of this plan) before considering Phase 2 complete — do not proceed with a broken golden path, matching how Phase 1's smoke test caught and fixed a real `getCompletion` defaulting bug before that phase was called done.
