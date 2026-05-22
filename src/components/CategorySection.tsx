import { CategorySummary } from "../lib/parseBudgetWorkbook";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface CategorySectionProps {
  category: CategorySummary;
}

export function CategorySection({ category }: CategorySectionProps) {
  const isIncome = category.type === "income";
  const differenceTone = category.difference >= 0 ? "text-emerald-600" : "text-rose-600";

  return (
    <article className="min-w-0 overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-950">{category.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {category.rows.length} {category.rows.length === 1 ? "line item" : "line items"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isIncome ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {isIncome ? "Income" : "Expense"}
        </span>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
        <div className="min-w-0">
          <p className="text-slate-500">Planned</p>
          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(category.planned)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500">Actual</p>
          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(category.actual)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500">Diff.</p>
          <p className={`mt-1 font-semibold ${differenceTone}`}>{formatSignedCurrency(category.difference)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {category.rows.slice(0, 4).map((row) => (
          <div key={row.id} className="flex min-w-0 items-center justify-between gap-4 text-sm">
            <span className="min-w-0 truncate text-slate-600">{row.name}</span>
            <span className="shrink-0 font-medium text-slate-900">{formatCurrency(row.actual || row.planned)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
