export type BudgetRowType = "income" | "expense";

export interface EditableBudgetRow {
  id: string;
  type: BudgetRowType;
  category: string;
  name: string;
  planned: number;
  actual: number;
}

export interface MonthlyBudget {
  month: string;
  rows: EditableBudgetRow[];
  updatedAt: string;
}

export interface BudgetTotals {
  totalIncome: number;
  plannedExpenses: number;
  actualExpenses: number;
  budgetBalance: number;
  plannedVsActualDifference: number;
}

export interface CategoryGroup {
  name: string;
  type: BudgetRowType;
  planned: number;
  actual: number;
  difference: number;
  rows: EditableBudgetRow[];
}

const STORAGE_PREFIX = "budget-dashboard";

export function calculateBudgetTotals(rows: EditableBudgetRow[]): BudgetTotals {
  const totalIncome = rows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + (row.actual === 0 ? row.planned : row.actual), 0);
  const plannedExpenses = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.planned, 0);
  const actualExpenses = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.actual, 0);

  return {
    totalIncome,
    plannedExpenses,
    actualExpenses,
    budgetBalance: totalIncome - actualExpenses,
    plannedVsActualDifference: plannedExpenses - actualExpenses,
  };
}

export function getRowDifference(row: EditableBudgetRow) {
  return row.type === "income" ? row.actual - row.planned : row.planned - row.actual;
}

export function groupRowsByCategory(rows: EditableBudgetRow[]): CategoryGroup[] {
  const grouped = new Map<string, EditableBudgetRow[]>();

  rows.forEach((row) => {
    const key = row.category.trim() || "Uncategorized";
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  return Array.from(grouped.entries()).map(([name, categoryRows]) => {
    const type = categoryRows.some((row) => row.type === "income") ? "income" : "expense";
    const planned = categoryRows.reduce((sum, row) => sum + row.planned, 0);
    const actual = categoryRows.reduce((sum, row) => sum + row.actual, 0);

    return {
      name,
      type,
      planned,
      actual,
      difference: categoryRows.reduce((sum, row) => sum + getRowDifference(row), 0),
      rows: categoryRows,
    };
  });
}

export function createRow(partialRow: Partial<EditableBudgetRow> = {}): EditableBudgetRow {
  const type = partialRow.type ?? "expense";

  return {
    id: partialRow.id ?? makeId(),
    type,
    category: cleanText(partialRow.category) || (type === "income" ? "Income" : "New category"),
    name: cleanText(partialRow.name) || (type === "income" ? "Income source" : "New item"),
    planned: normalizeAmount(partialRow.planned),
    actual: normalizeAmount(partialRow.actual),
  };
}

export function normalizeAmount(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value ?? "")
    .replace(/[,$\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function getBudgetStorageKey(month: string) {
  return `${STORAGE_PREFIX}:${month}`;
}

export function loadBudget(month: string): MonthlyBudget | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(getBudgetStorageKey(month));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MonthlyBudget;
    if (!Array.isArray(parsed.rows)) {
      return null;
    }

    return {
      month,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      rows: parsed.rows.map((row) => createRow(row)),
    };
  } catch {
    return null;
  }
}

export function saveBudget(month: string, budget: MonthlyBudget) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    getBudgetStorageKey(month),
    JSON.stringify({ ...budget, month, updatedAt: new Date().toISOString() }),
  );
}

export function clearBudget(month: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(getBudgetStorageKey(month));
}

export function duplicatePreviousMonth(previousBudget: MonthlyBudget): MonthlyBudget {
  return {
    month: previousBudget.month,
    updatedAt: new Date().toISOString(),
    rows: previousBudget.rows.map((row) =>
      createRow({
        type: row.type,
        category: row.category,
        name: row.name,
        planned: row.planned,
        actual: 0,
      }),
    ),
  };
}

export function createMonthlyBudget(month: string, rows: EditableBudgetRow[] = []): MonthlyBudget {
  return {
    month,
    rows: rows.map((row) => createRow(row)),
    updatedAt: new Date().toISOString(),
  };
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
