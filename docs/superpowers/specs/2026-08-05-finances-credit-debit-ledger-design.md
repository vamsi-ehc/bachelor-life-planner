# Finances: credit/debit ledger — design

Status: **Design approved — implementation not yet started.**

## Context

The Finances domain currently has three features: a transactions ledger (expense/income entries), per-category budgets (monthly limits with spend-percent bars), and recurring bills (due-day flagging). This design narrows it to a simple credit/debit ledger — dropping the budget/analysis layer — while leaving bills untouched.

"Reading finances" (in the sense of analyzing spend against a budget) is out of scope going forward. Auto-import of external bank/statement data was never built and remains explicitly out of scope too, unrelated to this change.

## 1. Remove budget/analysis features

- Delete `src/domains/finances/budgetsApi.ts` and `src/domains/finances/budgetsApi.test.ts`.
- Remove the `Budget` interface from `src/domains/shared/types.ts`.
- Remove `computeCategorySpend` and `computeBudgetPercent` from `src/domains/finances/financeLogic.ts`, and their corresponding tests in `financeLogic.test.ts`.
- Remove the "Budgets" section from `src/domains/finances/FinancesScreen.tsx`: the budget list (category, spend/limit, percent bar) and the "Set budget" form, along with the `budgetCategory`/`budgetLimit` state and `handleSetBudget` handler.
- Bills (`billsApi.ts`, the "Bills" section, due-today flagging) are unchanged — bills are a due-date reminder, not spend analysis, and stay separate from the ledger. No "mark as paid" action or auto-created ledger entry is added; that remains a distinct, un-scoped idea.

## 2. Ledger terminology: debit/credit, not expense/income

- `Transaction.type` in `src/domains/shared/types.ts` changes from `'expense' | 'income'` to `'debit' | 'credit'`.
- `src/domains/finances/transactionsApi.ts`: update any type references accordingly (storage is just the field value, no schema migration needed beyond the type change — existing stored documents with `type: 'expense'`/`'income'` are out of scope for migration since this is pre-launch).
- `FinancesScreen.tsx`:
  - Form's type `<select>` options become "Debit" / "Credit" (value `'debit'` / `'credit'`), replacing "Expense" / "Income".
  - List rendering keeps the same visual pattern — debit shown as `-$amount` in red, credit as `+$amount` in green (unchanged colors, just the condition checks `'debit'`/`'credit'` instead of `'expense'`/`'income'`).
  - Category field is unchanged: still a free-text input, still shown per entry, purely for labeling/scanning — no computation reads it anymore.

## 3. Running balance (current month)

- New function in `src/domains/finances/financeLogic.ts`: `computeMonthlyBalance(transactions: Transaction[]): number` — sums `+amount` for each `credit` entry and `-amount` for each `debit` entry across the given transaction list.
- `FinancesScreen.tsx` already loads the current month's transactions via `listTransactionsForMonth(uid, currentMonth())`, so no new data fetch is needed.
- Displayed at the top of the ledger section (`#finances-transactions`), above the add-transaction form, replacing the removed budgets section as the screen's top-level financial summary: label "This month" with the computed balance, styled green when non-negative and red (`#B3261E`, matching the existing debit color) when negative.

## 4. Testing

- `financeLogic.test.ts`: remove `computeCategorySpend`/`computeBudgetPercent` tests; add `computeMonthlyBalance` tests — mixed credits/debits, empty list, all-debit, all-credit.
- `FinancesScreen.test.tsx`: update existing assertions from expense/income labels to debit/credit; remove budget-form/budget-list assertions; add an assertion that the monthly balance renders with the correct computed value and color.
- `transactionsApi.test.ts`: update test fixtures from `'expense'`/`'income'` to `'debit'`/`'credit'`.

## Out of scope

- Automated bank/statement import or any external "read finances" data source.
- Linking bills to the ledger (auto-creating a debit entry when a bill is marked paid).
- Migrating existing stored transactions with the old `expense`/`income` type values.
- Any category-based reporting or analysis, per this design's removal of budgets.
