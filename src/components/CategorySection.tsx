import { CategoryGroup } from "../lib/budgetModel";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface CategorySectionProps {
  category: CategoryGroup;
  useActualValues: boolean;
}

export function CategorySection({ category, useActualValues }: CategorySectionProps) {
  const value = useActualValues ? category.actual : category.planned;
  const isOverPlan = category.actual > category.planned && useActualValues;
  const progress = category.planned > 0 ? Math.min((category.actual / category.planned) * 100, 100) : category.actual > 0 ? 100 : 0;

  return (
    <article className="category-card min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold text-slate-950">{category.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {category.rows.length} {category.rows.length === 1 ? "source row" : "source rows"}
          </p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${isOverPlan ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
          {formatCurrency(value)}
        </span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-3 gap-2 text-sm">
        <Metric label="Planned" value={formatCurrency(category.planned)} />
        <Metric label="Actual" value={formatCurrency(category.actual)} />
        <Metric label="Diff." value={formatSignedCurrency(category.difference)} tone={category.difference >= 0 ? "positive" : "negative"} />
      </div>

      {useActualValues ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Actual vs planned</span>
            <span>{category.planned > 0 ? `${Math.round(progress)}%` : "No plan"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${category.name} actual spending progress`}>
            <div className={`h-full rounded-full ${isOverPlan ? "bg-rose-500" : "bg-teal-600"}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : "text-slate-950";

  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
