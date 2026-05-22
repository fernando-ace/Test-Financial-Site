import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CategoryGroup, BudgetTotals } from "../lib/budgetModel";
import { formatCurrency } from "../lib/formatters";

interface BudgetChartProps {
  categories: CategoryGroup[];
  totals: BudgetTotals;
  hasActualExpenses: boolean;
}

const COLORS = ["#0f766e", "#2563eb", "#64748b", "#0891b2", "#4f46e5", "#475569", "#16a34a"];

export function BudgetChart({ categories, totals, hasActualExpenses }: BudgetChartProps) {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const comparisonData = expenseCategories
    .map((category) => ({
      name: category.name,
      Planned: category.planned,
      Actual: category.actual,
      basisValue: hasActualExpenses ? category.actual : category.planned,
    }))
    .sort((first, second) => second.basisValue - first.basisValue)
    .slice(0, 8);
  const spendingData = expenseCategories
    .map((category) => ({ name: category.name, value: hasActualExpenses ? category.actual : category.planned }))
    .filter((item) => item.value > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 7);

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <article className="chart-card min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Planned vs actual by category</h2>
            <p className="text-sm text-slate-500">Top expense categories from the current workbook.</p>
          </div>
          <p className="text-sm font-semibold text-slate-600">{formatCurrency(totals.plannedExpenses)} planned</p>
        </div>

        {comparisonData.length === 0 ? (
          <ChartEmptyState message="No expense categories were found in this workbook." />
        ) : (
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ left: 0, right: 4, top: 10, bottom: 34 }}>
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
                <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="Planned" fill="#0f766e" radius={[5, 5, 0, 0]} />
                <Bar dataKey="Actual" fill="#2563eb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <article className="chart-card min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Spending breakdown</h2>
        <p className="mt-1 text-sm text-slate-500">{hasActualExpenses ? "Actual spending by category" : "Planned spending by category"}</p>
        {spendingData.length === 0 ? (
          <ChartEmptyState message="No spending values are available for the breakdown." />
        ) : (
          <>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendingData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>
                    {spendingData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-2">
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
      </article>
    </section>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex min-h-56 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function shortenLabel(value: string) {
  return value.length > 14 ? `${value.slice(0, 12)}...` : value;
}
