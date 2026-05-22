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
import { CategorySummary } from "../lib/parseBudgetWorkbook";
import { formatCurrency } from "../lib/formatters";

interface BudgetChartProps {
  categories: CategorySummary[];
}

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#475569", "#16a34a"];

export function BudgetChart({ categories }: BudgetChartProps) {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const comparisonData = expenseCategories.map((category) => ({
    name: category.name,
    Planned: category.planned,
    Actual: category.actual,
  }));
  const spendingData = expenseCategories
    .map((category) => ({
      name: category.name,
      value: category.actual || category.planned,
    }))
    .filter((item) => item.value > 0);
  const pieData =
    spendingData.length > 0
      ? spendingData
      : expenseCategories.slice(0, 5).map((category) => ({ name: category.name, value: 1 }));

  return (
    <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <article className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Planned vs actual spending</h2>
            <p className="text-sm text-slate-500">Category totals from the Summary sheet</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
              Planned
            </span>
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              Actual
            </span>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ left: 0, right: 4, top: 12, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(value) => `$${Number(value) / 1000}k`}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="Planned" fill="#0f766e" radius={[7, 7, 0, 0]} />
              <Bar dataKey="Actual" fill="#2563eb" radius={[7, 7, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
        <h2 className="text-xl font-semibold text-slate-950">Spending breakdown</h2>
        <p className="mt-1 text-sm text-slate-500">Uses actual values, with planned values as fallback</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={3}>
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-3">
          {pieData.slice(0, 7).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                {item.name}
              </span>
              <span className="font-medium text-slate-900">{spendingData.length ? formatCurrency(item.value) : "Ready"}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
