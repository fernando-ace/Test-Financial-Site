import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CalendarDays, Landmark, PiggyBank, ReceiptText, TrendingUp } from "lucide-react";
import { BudgetChart } from "./components/BudgetChart";
import { BudgetEditor } from "./components/BudgetEditor";
import { BudgetTable } from "./components/BudgetTable";
import { CategorySection } from "./components/CategorySection";
import { DataTools } from "./components/DataTools";
import { KpiCard } from "./components/KpiCard";
import {
  EditableBudgetRow,
  MonthlyBudget,
  calculateBudgetTotals,
  clearBudget,
  createMonthlyBudget,
  duplicatePreviousMonth,
  groupRowsByCategory,
  loadBudget,
  saveBudget,
} from "./lib/budgetModel";
import { formatCurrency } from "./lib/formatters";
import { convertWorkbookRowsToEditableRows, parseBudgetWorkbook } from "./lib/parseBudgetWorkbook";

const workbookPath = `${import.meta.env.BASE_URL}MoneySense-monthly-budget-template-v1.xlsx`;

function App() {
  const [templateRows, setTemplateRows] = useState<EditableBudgetRow[]>([]);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [hasSavedBudget, setHasSavedBudget] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading template");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    parseBudgetWorkbook(workbookPath)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const editableRows = convertWorkbookRowsToEditableRows(data.rows);
        setTemplateRows(editableRows);
        const savedBudget = loadBudget(month);
        setBudget(savedBudget ?? createMonthlyBudget(month, editableRows));
        setHasSavedBudget(Boolean(savedBudget));
        setStatusMessage(savedBudget ? "Saved locally" : "Template loaded");
        setError(null);
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "The workbook could not be loaded.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (templateRows.length === 0) {
      return;
    }

    const savedBudget = loadBudget(month);
    setBudget(savedBudget ?? createMonthlyBudget(month, templateRows));
    setHasSavedBudget(Boolean(savedBudget));
    setStatusMessage(savedBudget ? "Saved locally" : "Template loaded");
  }, [month, templateRows]);

  const totals = useMemo(() => calculateBudgetTotals(budget?.rows ?? []), [budget]);
  const categories = useMemo(() => groupRowsByCategory(budget?.rows ?? []), [budget]);
  const expenseCategories = categories.filter((category) => category.type === "expense");

  const updateRows = useCallback(
    (rows: EditableBudgetRow[]) => {
      const nextBudget = createMonthlyBudget(month, rows);
      setBudget(nextBudget);
      saveBudget(month, nextBudget);
      setHasSavedBudget(true);
      setStatusMessage("Saved locally");
    },
    [month],
  );

  function resetToTemplate() {
    if (!window.confirm("Reset this month to the original Excel template? Your saved edits for this month will be removed.")) {
      return;
    }

    clearBudget(month);
    setBudget(createMonthlyBudget(month, templateRows));
    setHasSavedBudget(false);
    setStatusMessage("Template loaded");
  }

  function clearAllData() {
    if (!window.confirm("Clear every row for this month? This will save an empty budget for the selected month.")) {
      return;
    }

    const nextBudget = createMonthlyBudget(month, []);
    setBudget(nextBudget);
    saveBudget(month, nextBudget);
    setHasSavedBudget(true);
    setStatusMessage("Saved locally");
  }

  function importBudget(nextBudget: MonthlyBudget) {
    saveBudget(month, nextBudget);
    setBudget(nextBudget);
    setHasSavedBudget(true);
    setStatusMessage("Saved locally");
  }

  function duplicatePrevious() {
    const previousMonthKey = getPreviousMonth(month);
    const previousBudget = loadBudget(previousMonthKey);

    if (!previousBudget) {
      setStatusMessage(`No saved budget found for ${formatMonthLabel(previousMonthKey)}.`);
      return;
    }

    const duplicated = duplicatePreviousMonth(previousBudget);
    const nextBudget = createMonthlyBudget(month, duplicated.rows);
    saveBudget(month, nextBudget);
    setBudget(nextBudget);
    setHasSavedBudget(true);
    setStatusMessage(`Copied planned values from ${formatMonthLabel(previousMonthKey)}.`);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 text-white shadow-soft">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-10">
            <div className="flex min-h-[220px] flex-col justify-between">
              <div className="min-w-0 max-w-3xl">
                <p className="text-sm font-medium text-teal-200">Personal budget workspace</p>
                <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-normal sm:text-5xl lg:text-6xl">
                  Monthly Budget Planner
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Enter your income, plan your expenses, and track how your actual spending compares throughout the month.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Plan your month</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Track actual spending</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Spot over-budget categories</span>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-300">Budget month</p>
                  <p className="mt-1 font-semibold text-white">{formatMonthLabel(month)}</p>
                </div>
                <div className="rounded-2xl bg-teal-400/15 p-3 text-teal-200">
                  <CalendarDays className="h-6 w-6" aria-hidden="true" />
                </div>
              </div>
              <label className="mt-6 block text-sm font-medium text-slate-300">
                Select month
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value || getCurrentMonth())}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </label>
              <button
                type="button"
                onClick={duplicatePrevious}
                className="mt-4 w-full rounded-xl bg-teal-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Duplicate previous month
              </button>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-slate-200" role="status">
                {statusMessage}
              </div>
            </aside>
          </div>
        </header>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}

        {!isLoading && budget ? (
          <>
            {!hasSavedBudget ? <OnboardingCard /> : null}
            <BudgetStatusBanner totals={totals} />

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Total income" value={totals.totalIncome} icon={Landmark} tone="income" caption="Money available this month" />
              <KpiCard label="Planned expenses" value={totals.plannedExpenses} icon={ReceiptText} tone="expense" caption="What you expected to spend" />
              <KpiCard label="Actual expenses" value={totals.actualExpenses} icon={BadgeDollarSign} tone="expense" caption="What you have spent so far" />
              <KpiCard label="Budget balance" value={totals.budgetBalance} icon={PiggyBank} tone="balance" signed caption="Income minus actual spending" />
              <KpiCard label="Planned vs actual" value={totals.plannedVsActualDifference} icon={TrendingUp} tone="neutral" signed caption="Positive means under budget" />
            </section>

            <BudgetEditor rows={budget.rows} onRowsChange={updateRows} />
            <BudgetChart categories={categories} totals={totals} />

            <section className="min-w-0">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Expense categories</h2>
                  <p className="text-sm text-slate-500">Progress and differences update as you edit your line items.</p>
                </div>
                <p className="text-sm font-medium text-slate-500">{budget.rows.length} editable rows</p>
              </div>
              <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {expenseCategories.length === 0 ? (
                  <p className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-500">
                    Add an expense category to see category cards.
                  </p>
                ) : null}
                {expenseCategories.map((category) => (
                  <CategorySection key={category.name} category={category} rows={budget.rows} onRowsChange={updateRows} />
                ))}
              </div>
            </section>

            <BudgetTable rows={budget.rows} onRowsChange={updateRows} />
            <DataTools budget={budget} templateRows={templateRows} onImportBudget={importBudget} onResetTemplate={resetToTemplate} onClearAll={clearAllData} />
          </>
        ) : null}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/90 p-8 text-center shadow-soft">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      <h2 className="mt-5 text-xl font-semibold text-slate-950">Reading budget template</h2>
      <p className="mt-2 text-sm text-slate-500">Loading starter rows from the static Excel file.</p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-rose-900 shadow-soft">
      <h2 className="text-lg font-semibold">Workbook could not be loaded</h2>
      <p className="mt-2 text-sm text-rose-700">{message}</p>
    </section>
  );
}

function OnboardingCard() {
  return (
    <section className="rounded-3xl border border-teal-100 bg-teal-50 p-5 text-teal-950 shadow-soft">
      <p className="max-w-3xl text-sm sm:text-base">
        Start by entering your income, then add planned expenses. As the month goes on, update actual spending to see where your money is going.
      </p>
      <ol className="mt-4 grid gap-3 text-sm font-semibold sm:grid-cols-3">
        <li className="rounded-2xl bg-white/80 p-3">1. Enter income</li>
        <li className="rounded-2xl bg-white/80 p-3">2. Plan expenses</li>
        <li className="rounded-2xl bg-white/80 p-3">3. Track actuals</li>
      </ol>
    </section>
  );
}

function BudgetStatusBanner({ totals }: { totals: ReturnType<typeof calculateBudgetTotals> }) {
  const balanceMessage =
    totals.budgetBalance >= 0
      ? `You have ${formatCurrency(totals.budgetBalance)} left this month.`
      : `You are ${formatCurrency(Math.abs(totals.budgetBalance))} over your monthly budget.`;
  const planMessage =
    totals.actualExpenses > totals.plannedExpenses
      ? `You are over your planned spending by ${formatCurrency(totals.actualExpenses - totals.plannedExpenses)}.`
      : `You are under planned spending by ${formatCurrency(totals.plannedExpenses - totals.actualExpenses)}.`;

  return (
    <section className={`rounded-3xl border p-5 shadow-soft ${totals.budgetBalance >= 0 ? "border-emerald-100 bg-emerald-50 text-emerald-950" : "border-rose-100 bg-rose-50 text-rose-950"}`}>
      <p className="text-lg font-semibold">{balanceMessage}</p>
      <p className="mt-1 text-sm opacity-80">{planMessage}</p>
    </section>
  );
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

export default App;
