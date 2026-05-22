import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Landmark, PiggyBank, ReceiptText, TrendingUp } from "lucide-react";
import { BudgetChart } from "./components/BudgetChart";
import { BudgetTable } from "./components/BudgetTable";
import { CategorySection } from "./components/CategorySection";
import { KpiCard } from "./components/KpiCard";
import { BudgetWorkbookData, parseBudgetWorkbook } from "./lib/parseBudgetWorkbook";

const workbookPath = `${import.meta.env.BASE_URL}MoneySense-monthly-budget-template.xlsx`;

function App() {
  const [budgetData, setBudgetData] = useState<BudgetWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    parseBudgetWorkbook(workbookPath)
      .then((data) => {
        if (isMounted) {
          setBudgetData(data);
          setError(null);
        }
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

  const categories = useMemo(
    () => budgetData?.categories.filter((category) => category.type !== "balance") ?? [],
    [budgetData],
  );

  return (
    <main className="min-h-screen px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 text-white shadow-soft">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-10">
            <div className="flex min-h-[270px] flex-col justify-between">
              <div className="min-w-0 max-w-3xl">
                <p className="text-sm font-medium text-teal-200">MoneySense template visualization</p>
                <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal sm:text-5xl lg:text-6xl">
                  Monthly Budget Dashboard
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Visualizes the uploaded MoneySense budget template as a clean, static personal finance dashboard.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Static GitHub Pages ready</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Client-side Excel parsing</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">No backend required</span>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Workbook</p>
                  <p className="mt-1 font-semibold text-white">MoneySense budget</p>
                </div>
                <div className="rounded-2xl bg-teal-400/15 p-3 text-teal-200">
                  <ReceiptText className="h-6 w-6" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-8 space-y-4">
                {["Income", "Expense categories", "Planned amount", "Actual amount", "Budget balance"].map((label) => (
                  <div key={label} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-b-0">
                    <span className="text-slate-300">{label}</span>
                    <span className="h-2 w-20 rounded-full bg-gradient-to-r from-teal-300 to-blue-400" />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </header>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}

        {budgetData ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Total income"
                value={budgetData.totals.totalIncome}
                icon={Landmark}
                tone="income"
                caption="Actual income from the template"
              />
              <KpiCard
                label="Planned expenses"
                value={budgetData.totals.plannedExpenses}
                icon={ReceiptText}
                tone="expense"
                caption="Planned category subtotals"
              />
              <KpiCard
                label="Actual expenses"
                value={budgetData.totals.actualExpenses}
                icon={BadgeDollarSign}
                tone="expense"
                caption="Actual category subtotals"
              />
              <KpiCard
                label="Budget balance"
                value={budgetData.totals.budgetBalance}
                icon={PiggyBank}
                tone="balance"
                signed
                caption="Income minus actual spending"
              />
              <KpiCard
                label="Planned vs actual"
                value={budgetData.totals.plannedVsActualDifference}
                icon={TrendingUp}
                tone="neutral"
                signed
                caption="Positive means under plan"
              />
            </section>

            <BudgetChart categories={budgetData.categories} />

            <section className="min-w-0">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Expense sections</h2>
                  <p className="text-sm text-slate-500">Grouped cards generated from the Summary sheet categories</p>
                </div>
                <p className="text-sm font-medium text-slate-500">{budgetData.rows.length} workbook rows parsed</p>
              </div>
              <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => (
                  <CategorySection key={category.name} category={category} />
                ))}
              </div>
            </section>

            <BudgetTable rows={budgetData.rows} />
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
      <h2 className="mt-5 text-xl font-semibold text-slate-950">Reading budget workbook</h2>
      <p className="mt-2 text-sm text-slate-500">Loading and parsing the Summary sheet from the static Excel file.</p>
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

export default App;
