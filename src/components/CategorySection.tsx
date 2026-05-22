import { useState } from "react";
import { Plus } from "lucide-react";
import { CategoryGroup, EditableBudgetRow, createRow } from "../lib/budgetModel";
import { formatCurrency, formatSignedCurrency } from "../lib/formatters";

interface CategorySectionProps {
  category: CategoryGroup;
  rows: EditableBudgetRow[];
  onRowsChange: (rows: EditableBudgetRow[]) => void;
}

export function CategorySection({ category, rows, onRowsChange }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isIncome = category.type === "income";
  const isOverBudget = !isIncome && category.actual > category.planned;
  const progress = category.planned > 0 ? Math.min((category.actual / category.planned) * 100, 100) : category.actual > 0 ? 100 : 0;
  const visibleRows = isExpanded ? category.rows : category.rows.slice(0, 4);

  function addItem() {
    onRowsChange([...rows, createRow({ type: category.type, category: category.name })]);
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft shadow-slate-200/70">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold text-slate-950">{category.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {category.rows.length} {category.rows.length === 1 ? "line item" : "line items"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isIncome ? "bg-emerald-50 text-emerald-700" : isOverBudget ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {isIncome ? "Income" : isOverBudget ? "Over budget" : "Under budget"}
        </span>
      </div>

      {!isIncome ? (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Progress</span>
            <span>{category.planned > 0 ? `${Math.round(progress)}% used` : "No planned amount"}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${category.name} spending progress`}>
            <div className={`h-full rounded-full ${isOverBudget ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
        <div className="min-w-0">
          <p className="text-slate-500">Planned</p>
          <p className="mt-1 truncate font-semibold text-slate-950">{formatCurrency(category.planned)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500">Actual</p>
          <p className="mt-1 truncate font-semibold text-slate-950">{formatCurrency(category.actual)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500">Diff.</p>
          <p className={`mt-1 truncate font-semibold ${category.difference >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatSignedCurrency(category.difference)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visibleRows.map((row) => (
          <div key={row.id} className="flex min-w-0 items-center justify-between gap-4 text-sm">
            <span className="min-w-0 break-words text-slate-600">{row.name}</span>
            <span className="shrink-0 font-medium text-slate-900">{formatCurrency(row.actual || row.planned)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add item
        </button>
        {category.rows.length > 4 ? (
          <button type="button" onClick={() => setIsExpanded((value) => !value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
            {isExpanded ? "Show fewer" : `Show all ${category.rows.length}`}
          </button>
        ) : null}
      </div>
    </article>
  );
}
