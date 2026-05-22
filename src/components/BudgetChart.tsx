import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CategoryGroup, BudgetTotals } from "../lib/budgetModel";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface BudgetChartProps {
  categories: CategoryGroup[];
  totals: BudgetTotals;
}

type ChartMode = "comparison" | "actual" | "difference";

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#475569", "#16a34a"];

export function BudgetChart({ categories, totals }: BudgetChartProps) {
  const [mode, setMode] = useState<ChartMode>("comparison");
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const comparisonData = expenseCategories.map((category) => ({
    name: category.name,
    Planned: category.planned,
    Actual: category.actual,
    Difference: category.difference,
  }));
  const spendingData = expenseCategories
    .map((category) => ({ name: category.name, value: category.actual }))
    .filter((item) => item.value > 0);

  const insights = useMemo(() => {
    const topSpending = expenseCategories.reduce<CategoryGroup | null>(
      (top, category) => (!top || category.actual > top.actual ? category : top),
      null,
    );
    const mostOverBudget = expenseCategories.reduce<CategoryGroup | null>((top, category) => {
      const overage = category.actual - category.planned;
      const topOverage = top ? top.actual - top.planned : 0;
      return overage > topOverage ? category : top;
    }, null);
    const percentUsed = totals.plannedExpenses > 0 ? (totals.actualExpenses / totals.plannedExpenses) * 100 : 0;

    return { topSpending, mostOverBudget, percentUsed };
  }, [expenseCategories, totals.actualExpenses, totals.plannedExpenses]);

  return (
    <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <article className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Spending chart</h2>
            <p className="text-sm text-slate-500">Live totals from your edited budget rows</p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Chart mode">
            {[
              ["comparison", "Planned vs actual"],
              ["actual", "Actual only"],
              ["difference", "Difference"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as ChartMode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  mode === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {comparisonData.length === 0 ? (
          <ChartEmptyState message="Add an expense category to see spending charts." />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ left: 0, right: 4, top: 12, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(value) => shortenLabel(String(value))}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(value) => `$${Number(value) / 1000}k`}
                />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "#f1f5f9" }} />
                {mode === "comparison" ? (
                  <>
                    <Bar dataKey="Planned" fill="#0f766e" radius={[7, 7, 0, 0]} />
                    <Bar dataKey="Actual" fill="#2563eb" radius={[7, 7, 0, 0]} />
                  </>
                ) : null}
                {mode === "actual" ? <Bar dataKey="Actual" fill="#2563eb" radius={[7, 7, 0, 0]} /> : null}
                {mode === "difference" ? (
                  <Bar dataKey="Difference" radius={[7, 7, 0, 0]}>
                    {comparisonData.map((item) => (
                      <Cell key={item.name} fill={item.Difference >= 0 ? "#0f766e" : "#e11d48"} />
                    ))}
                  </Bar>
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <article className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
        <h2 className="text-xl font-semibold text-slate-950">Spending breakdown</h2>
        <p className="mt-1 text-sm text-slate-500">Actual spending by category</p>
        {spendingData.length === 0 ? (
          <ChartEmptyState message="Enter actual expense amounts to fill this chart." />
        ) : (
          <>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendingData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} paddingAngle={3}>
                    {spendingData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-3">
              {spendingData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="break-words">{item.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-slate-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Insights</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <Insight label="Top spending category" value={insights.topSpending && insights.topSpending.actual > 0 ? `${insights.topSpending.name} (${formatCurrency(insights.topSpending.actual)})` : "No actual spending yet"} />
            <Insight label="Most over-budget category" value={insights.mostOverBudget && insights.mostOverBudget.actual > insights.mostOverBudget.planned ? `${insights.mostOverBudget.name} (${formatCurrency(insights.mostOverBudget.actual - insights.mostOverBudget.planned)} over)` : "No category is over budget"} />
            <Insight label="Planned budget used" value={`${Math.round(insights.percentUsed)}%`} />
            <Insight label="Planned vs actual" value={formatSignedCurrency(totals.plannedVsActualDifference)} />
          </dl>
        </div>
      </article>
    </section>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[55%] text-right font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function shortenLabel(value: string) {
  return value.length > 14 ? `${value.slice(0, 12)}...` : value;
}
